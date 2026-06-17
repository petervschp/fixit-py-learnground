import http from "node:http";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";

const ROOT = process.cwd();

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js") || file.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json") || file.endsWith(".webmanifest")) return "application/json; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".md")) return "text/markdown; charset=utf-8";
  return "application/octet-stream";
}

function startStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = "/index.html";
      const target = path.normalize(path.join(ROOT, pathname));
      if (!target.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const data = await fs.readFile(target);
      res.writeHead(200, { "content-type": contentType(target), "cache-control": "no-store" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_BIN,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ].filter(Boolean);
  return candidates.find(p => existsSync(p));
}

async function hasManagedUrlBlocklistAll() {
  const policyDirs = [
    "/etc/chromium/policies/managed",
    "/etc/opt/chrome/policies/managed"
  ];
  for (const dir of policyDirs) {
    try {
      const names = await fs.readdir(dir);
      for (const name of names) {
        if (!name.endsWith(".json")) continue;
        const raw = await fs.readFile(path.join(dir, name), "utf8");
        const json = JSON.parse(raw);
        if (Array.isArray(json.URLBlocklist) && json.URLBlocklist.includes("*")) return true;
      }
    } catch {}
  }
  return false;
}

async function waitForJson(url, timeoutMs = 8000) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw lastErr || new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async waitForEvent(method, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const idx = this.events.findIndex(e => e.method === method);
      if (idx >= 0) return this.events.splice(idx, 1)[0];
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error(`Timed out waiting for CDP event ${method}`);
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      const msg = details.exception?.description || details.text || "Runtime evaluation failed";
      throw new Error(msg);
    }
    return result.result?.value;
  }
}

async function waitForCondition(cdp, expression, label, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await cdp.eval(`Boolean(${expression})`);
    if (ok) return;
    await new Promise(r => setTimeout(r, 100));
  }
  const body = await cdp.eval(`document.body ? document.body.innerText.slice(0, 1800) : "NO_BODY"`).catch(e => `BODY_EVAL_FAILED: ${e.message}`);
  const appHtml = await cdp.eval(`document.querySelector("#app") ? document.querySelector("#app").innerHTML.slice(0, 1800) : "NO_APP"`).catch(e => `APP_EVAL_FAILED: ${e.message}`);
  const exceptions = cdp.events.filter(e => e.method === "Runtime.exceptionThrown").slice(0, 5);
  throw new Error(`Browser smoke failed: ${label}\nBODY:\n${body}\nAPP:\n${appHtml}\nEXCEPTIONS:\n${JSON.stringify(exceptions)}`);
}

async function assertCondition(cdp, expression, label) {
  const ok = await cdp.eval(`Boolean(${expression})`);
  if (!ok) throw new Error(`Browser smoke assertion failed: ${label}`);
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await cdp.waitForEvent("Page.loadEventFired", 10000);
}

async function clearFixItState(cdp) {
  await cdp.eval(`(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("fixit.")) localStorage.removeItem(k);
    for (const k of Object.keys(sessionStorage)) if (k.startsWith("fixit.")) sessionStorage.removeItem(k);
    return true;
  })()`);
}

async function testPwaOfflineShellMetadata(cdp, base) {
  await navigate(cdp, `${base}/index.html`);
  await waitForCondition(cdp, `document.querySelector('link[rel="manifest"]') && document.querySelector('#pwaStatus')`, "PWA manifest and status panel render");
  await assertCondition(cdp, `document.querySelector('link[rel="manifest"]').getAttribute('href') === 'manifest.webmanifest'`, "manifest link is relative and present");
  await assertCondition(cdp, `document.body.textContent.includes('Offline shell')`, "offline shell wording is visible");
  const manifest = await cdp.eval(`fetch('/manifest.webmanifest').then(r => r.json()).then(m => ({ name: m.name, display: m.display, start_url: m.start_url }))`);
  if (!manifest || manifest.name !== 'FixIt Student Path' || manifest.display !== 'standalone' || manifest.start_url !== './index.html') {
    throw new Error(`Browser smoke assertion failed: manifest has unexpected shape ${JSON.stringify(manifest)}`);
  }
  await assertCondition(cdp, `'serviceWorker' in navigator`, "service worker API is available on localhost Chromium");
}

async function setBrowserOffline(cdp, offline) {
  await cdp.send("Network.emulateNetworkConditions", {
    offline: Boolean(offline),
    latency: 0,
    downloadThroughput: offline ? 0 : -1,
    uploadThroughput: offline ? 0 : -1
  });
}

async function testOfflineReloadAfterServiceWorkerCache(cdp, base) {
  await setBrowserOffline(cdp, false);
  await navigate(cdp, `${base}/index.html?route=Y2_most_cli_dom&problem=L7-026&simple=1&pwaSmoke=online`);
  await waitForCondition(cdp, `document.querySelector('#code') && document.body.textContent.includes('add_task')`, "online route renders before offline PWA smoke");

  const cacheInfo = await cdp.eval(`(async () => {
    if (!('serviceWorker' in navigator) || !('caches' in window)) return { ok: false, reason: 'missing_api' };
    await navigator.serviceWorker.ready;
    const names = await caches.keys();
    const name = names.find(n => n.startsWith('fixit-student-path-v0.9-shell')) || names.find(n => n.startsWith('fixit-student-path-'));
    if (!name) return { ok: false, reason: 'missing_cache', names };
    const cache = await caches.open(name);
    const reqs = await cache.keys();
    const paths = reqs.map(r => new URL(r.url).pathname).sort();
    return {
      ok: paths.some(p => p.endsWith('/index.html')) &&
          paths.some(p => p.endsWith('/student_routes.json')) &&
          paths.some(p => p.endsWith('/problems/level-07.json')) &&
          paths.some(p => p.endsWith('/src/task-renderer.js')) &&
          paths.some(p => p.endsWith('/src/pyodide-config.js')),
      name,
      paths
    };
  })()`);

  if (!cacheInfo.ok) throw new Error(`PWA cache not populated enough for offline reload: ${JSON.stringify(cacheInfo)}`);

  await setBrowserOffline(cdp, true);
  try {
    await navigate(cdp, `${base}/index.html?route=Y2_most_cli_dom&problem=L7-026&simple=1&pwaSmoke=offline`);
    await waitForCondition(cdp, `document.querySelector('#code') && document.body.textContent.includes('add_task')`, "offline reload renders route from service worker cache", 10000);
    await assertCondition(cdp, `document.body.textContent.includes('Zadanie a trasy') || document.body.textContent.includes('Offline shell') || document.body.textContent.includes('Stav appky')`, "offline status is visible after offline reload");
    await assertCondition(cdp, `document.querySelector('#runtimeStatusPanel') && document.querySelector('#runtimeStatusMessage').textContent.includes('Python')`, "runtime status panel survives offline reload");
  } finally {
    await setBrowserOffline(cdp, false);
  }
}

async function testRoutesHome(cdp, base) {
  await navigate(cdp, `${base}/index.html`);
  await waitForCondition(cdp, `document.querySelector('.routes-home') && document.body.textContent.includes('Moje trasy')`, "routes home renders");
  await assertCondition(cdp, `document.querySelectorAll('.route-card').length >= 8`, "route cards are visible");
  await assertCondition(cdp, `document.body.textContent.includes('trasa nie je domáca úloha celá naraz')`, "classroom guidance is visible");
}

async function testRouteMode(cdp, base) {
  await navigate(cdp, `${base}/index.html?route=Y2_most_cli_dom&problem=L7-026&simple=1`);
  await waitForCondition(cdp, `document.querySelector('#code') && document.querySelector('#btnRun') && document.body.textContent.includes('add_task')`, "route problem renders");
  await assertCondition(cdp, `document.querySelector('#problemSelect') && document.querySelector('#problemSelect').value === 'L7-026'`, "route problem select is set");
  await assertCondition(cdp, `!document.querySelector('#btnExport') && !document.querySelector('#btnBackup')`, "simple mode hides export and backup controls");
  await assertCondition(cdp, `document.body.textContent.includes('Jednoduchý režim')`, "simple mode note is visible");
}

async function testFreePracticeMode(cdp, base) {
  await navigate(cdp, `${base}/index.html?level=1&problem=L1-P01`);
  await waitForCondition(cdp, `document.querySelector('#levelSelect') && document.querySelector('#problemSelect') && document.querySelector('#mapBox button.tile')`, "free-practice problem map renders");
  await assertCondition(cdp, `document.querySelector('#levelSelect').value === '1'`, "free-practice level select is set");
  await assertCondition(cdp, `document.body.textContent.includes('Voľné precvičovanie')`, "free-practice context is visible");
}

async function testPredictLockFlow(cdp, base) {
  await navigate(cdp, `${base}/index.html?route=Y2_brython_event_render&problem=L7-P29`);
  await waitForCondition(cdp, `document.querySelector('#predictGuess') && document.querySelector('#btnLockGuess')`, "predict panel renders");
  await cdp.eval(`(() => {
    const guess = document.querySelector('#predictGuess');
    guess.value = 'True\\n2\\n';
    guess.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#btnLockGuess').click();
    return true;
  })()`);
  await waitForCondition(cdp, `document.querySelector('#predictGuess').disabled && document.querySelector('#btnLockGuess').disabled`, "predict guess is locked");
  await assertCondition(cdp, `document.querySelector('#btnTest').disabled`, "predict disables regular tests button");
  await assertCondition(cdp, `document.querySelector('#predictStatus').textContent.includes('Odhad uzamknutý')`, "predict lock status is visible");
}

async function testFixBuggySolutionFlow(cdp, base) {
  await navigate(cdp, `${base}/index.html?route=Y2_brython_event_render&problem=L7-F30`);
  await waitForCondition(cdp, `document.querySelector('#buggySelect') && document.querySelector('#code')`, "fix panel renders");
  await assertCondition(cdp, `document.querySelector('#buggySelect').options.length >= 2`, "fix has multiple buggy variants");
  await cdp.eval(`(() => {
    const sel = document.querySelector('#buggySelect');
    sel.value = 'B2';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await waitForCondition(cdp, `document.querySelector('#buggySelect').value === 'B2' && document.querySelector('#code').value.includes('new_task')`, "fix buggy variant B2 loads into editor");
  await assertCondition(cdp, `document.querySelector('#status').textContent.includes('Načítané chybné riešenie')`, "fix selection status is visible");
}

async function testExportBackupPrivacyModel(cdp, base) {
  await navigate(cdp, `${base}/index.html?route=Y2_most_cli_dom&problem=L7-026`);
  await waitForCondition(cdp, `document.querySelector('#btnExport') && document.querySelector('#btnBackup') && document.querySelector('#btnImport')`, "full mode export and backup controls render");
  await assertCondition(cdp, `document.body.textContent.includes('Anonymné odovzdanie') || document.body.textContent.includes('Odovzdať učiteľovi anonymné')`, "anonymous teacher export section is visible");
  await assertCondition(cdp, `document.body.textContent.includes('súkromná záloha')`, "private backup wording is visible");

  const result = await cdp.eval(`(async () => {
    const m = await import('/storage.js');
    const routes = await fetch('/student_routes.json').then(r => r.json());
    const route = routes.find(r => r.id === 'Y2_most_cli_dom');
    const state = m.loadState();
    const e = m.ensureProblemEntry(state, 'L7-026');
    e.draftCode = 'SECRET_CODE_SHOULD_NOT_BE_IN_TEACHER_SUMMARY';
    e.runInput = 'SECRET_STDIN_SHOULD_NOT_BE_IN_TEACHER_SUMMARY';
    e.lastResult = 'PASS';
    e.status = 'explained';
    e.attempts = 2;
    e.hintsUsed = 1;
    m.saveState(state);
    const anon = await m.buildAnonymousSummaryExport(state, route, { currentProblem: { id: 'L7-026', title: 'Y2 most: add_task(tasks, text)', level: 7 }, routeMode: true });
    const backup = await m.buildPrivateBackupExport(state, { currentProblem: { id: 'L7-026', title: 'Y2 most: add_task(tasks, text)', level: 7 }, route: { id: route.id, title: route.title } });
    const anonJson = JSON.stringify(anon);
    const backupJson = JSON.stringify(backup);
    return {
      anonType: anon.type,
      backupType: backup.type,
      anonContainsCodeFlag: anon.privacy.containsCode,
      backupContainsCodeFlag: backup.privacy.containsCode,
      anonLeaksDraftCode: anonJson.includes('SECRET_CODE_SHOULD_NOT_BE_IN_TEACHER_SUMMARY'),
      anonLeaksRunInput: anonJson.includes('SECRET_STDIN_SHOULD_NOT_BE_IN_TEACHER_SUMMARY'),
      backupIncludesDraftCode: backupJson.includes('SECRET_CODE_SHOULD_NOT_BE_IN_TEACHER_SUMMARY'),
      backupIncludesRunInput: backupJson.includes('SECRET_STDIN_SHOULD_NOT_BE_IN_TEACHER_SUMMARY'),
      anonCanRestore: anon.privacy.note.includes('cannot restore') || anon.privacy.note.includes('nedá')
    };
  })()`);

  if (result.anonType !== "fixit-anonymous-summary") throw new Error("Anonymous export has wrong type");
  if (result.backupType !== "fixit-private-backup") throw new Error("Private backup has wrong type");
  if (result.anonContainsCodeFlag !== false) throw new Error("Anonymous export privacy flag should say containsCode=false");
  if (result.backupContainsCodeFlag !== true) throw new Error("Private backup privacy flag should say containsCode=true");
  if (result.anonLeaksDraftCode || result.anonLeaksRunInput) throw new Error("Anonymous summary leaks draft code or run input");
  if (!result.backupIncludesDraftCode || !result.backupIncludesRunInput) throw new Error("Private backup does not include draft code/run input");
}

async function testPassMicroDefenseFlow(cdp, base) {
  await navigate(cdp, `${base}/index.html?route=Y2_most_cli_dom&problem=L7-026`);
  await waitForCondition(cdp, `document.querySelector('#code') && document.querySelector('#microDefenseCard')`, "microdefense card renders before seeding pass");
  await cdp.eval(`(async () => {
    const m = await import('/storage.js');
    const state = m.loadState();
    m.setResult(state, 'L7-026', 'PASS');
    return true;
  })()`);
  await navigate(cdp, `${base}/index.html?route=Y2_most_cli_dom&problem=L7-026`);
  await waitForCondition(cdp, `document.querySelector('#microDefenseCard') && !document.querySelector('.btnMicroDefense[data-rating="3"]').disabled`, "microdefense enabled after PASS state");
  await cdp.eval(`document.querySelector('.btnMicroDefense[data-rating="3"]').click()`);
  await waitForCondition(cdp, `document.querySelector('#microDefenseStatus').textContent.includes('samostatne') && document.body.textContent.includes('VYSVETLENÉ')`, "microdefense explained badge is visible");
  const status = await cdp.eval(`JSON.parse(localStorage.getItem('fixit.student.v3')).progress.problems['L7-026'].status`);
  if (status !== "explained") throw new Error(`Expected L7-026 status explained after microdefense, got ${status}`);
}

async function assertNoRuntimeExceptions(cdp) {
  const exceptionEvents = cdp.events.filter(e => e.method === "Runtime.exceptionThrown");
  if (exceptionEvents.length > 0) {
    throw new Error(`Runtime exceptions during browser smoke test: ${JSON.stringify(exceptionEvents.slice(0, 5))}`);
  }
}

async function main() {
  const chromium = findChromium();
  if (!chromium) {
    throw new Error("Chromium binary not found. Set CHROMIUM_BIN or install Chromium/Chrome to run browser smoke tests.");
  }

  if (await hasManagedUrlBlocklistAll()) {
    console.log("Browser smoke skipped: this Chromium installation has a managed URLBlocklist=* policy. The test file is included and will run in an unrestricted local/CI Chromium environment.");
    return;
  }

  const server = await startStaticServer();
  const appPort = server.address().port;
  const debugPort = await freePort();
  const userDataDir = path.join(ROOT, ".tmp-browser-smoke-profile");
  await fs.rm(userDataDir, { recursive: true, force: true });

  const chrome = spawn(chromium, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--proxy-server=direct://",
    "--proxy-bypass-list=*",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let stderr = "";
  chrome.stderr.on("data", d => { stderr += String(d); });

  try {
    await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
    const newTarget = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
    const target = newTarget.ok ? await newTarget.json() : (await waitForJson(`http://127.0.0.1:${debugPort}/json`))[0];
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const cdp = new CdpClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Network.enable");

    const base = `http://localhost:${appPort}`;

    await navigate(cdp, `${base}/index.html`);
    await clearFixItState(cdp);

    await testPwaOfflineShellMetadata(cdp, base);
    await testOfflineReloadAfterServiceWorkerCache(cdp, base);
    await testRoutesHome(cdp, base);
    await testRouteMode(cdp, base);
    await testFreePracticeMode(cdp, base);
    await testPredictLockFlow(cdp, base);
    await testFixBuggySolutionFlow(cdp, base);
    await testExportBackupPrivacyModel(cdp, base);
    await testPassMicroDefenseFlow(cdp, base);
    await assertNoRuntimeExceptions(cdp);

    ws.close();
    console.log("Browser smoke OK: PWA metadata/offline reload, routes home, route mode, free-practice mode, Predict lock, Fix buggy-solution, export/backup privacy and PASS microdefense flow passed without runtime exceptions.");
  } finally {
    chrome.kill("SIGTERM");
    server.close();
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    if (stderr.includes("ERROR")) {
      console.error(stderr.split("\n").filter(line => line.includes("ERROR")).slice(0, 5).join("\n"));
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
