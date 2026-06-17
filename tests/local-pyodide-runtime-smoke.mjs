#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";

const ROOT = process.cwd();
const TMP_RUNTIME = path.join(ROOT, ".tmp-local-pyodide-runtime");
const MOCK_BASE_PATH = "/.tmp-local-pyodide-runtime/vendor/pyodide/v0.25.1/full/";

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js") || file.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json") || file.endsWith(".webmanifest")) return "application/json; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".wasm")) return "application/wasm";
  if (file.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
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
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
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
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
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
      const msg = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime evaluation failed";
      throw new Error(msg);
    }
    return result.result?.value;
  }
}

async function waitForCondition(cdp, expression, label, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await cdp.eval(`Boolean(${expression})`);
    if (ok) return;
    await new Promise(r => setTimeout(r, 100));
  }
  const body = await cdp.eval(`document.body ? document.body.innerText.slice(0, 1800) : "NO_BODY"`).catch(e => `BODY_EVAL_FAILED: ${e.message}`);
  throw new Error(`Local Pyodide runtime smoke failed: ${label}\nBODY:\n${body}`);
}

async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await cdp.waitForEvent("Page.loadEventFired", 10000);
}

async function writeMockPyodideRuntime() {
  const full = path.join(TMP_RUNTIME, "vendor/pyodide/v0.25.1/full");
  await fs.rm(TMP_RUNTIME, { recursive: true, force: true });
  await fs.mkdir(full, { recursive: true });
  await fs.writeFile(path.join(full, "pyodide.js"), `
self.__FIXIT_MOCK_PYODIDE_SCRIPT_LOADED__ = true;
self.loadPyodide = async function loadPyodide(options = {}) {
  self.__FIXIT_MOCK_INDEX_URL__ = options.indexURL || "";
  const globals = new Map();
  return {
    globals: {
      set(k, v) { globals.set(k, v); },
      delete(k) { globals.delete(k); }
    },
    async runPythonAsync(code) {
      const src = String(code || "");
      if (src.includes("__run(__USER_CODE")) {
        return { toJs: () => ({ ok: true, stdout: "local runtime smoke\\n", stderr: "" }) };
      }
      if (src.includes("__ast_check")) {
        return { toJs: () => ({ ok: true, violations: [] }) };
      }
      if (src.includes("__run_function")) {
        return { toJs: () => ({ ok: true, kind: "ok", return_json: "null", mutation_check: false, mutation_ok: true, mutation_failed_indices: [], stdout: "", stderr: "" }) };
      }
      if (src.includes("__gen_function_cases")) {
        return { toJs: () => ({ ok: true, cases: [] }) };
      }
      return undefined;
    }
  };
};
`, "utf8");
  await fs.writeFile(path.join(full, "pyodide.asm.wasm"), "mock-wasm", "utf8");
  await fs.writeFile(path.join(full, "python_stdlib.zip"), "mock-stdlib", "utf8");
  await fs.writeFile(path.join(full, "pyodide-lock.json"), JSON.stringify({ info: { version: "0.25.1" }, mock: true }, null, 2));
}

async function main() {
  if (await hasManagedUrlBlocklistAll()) {
    console.log("Local Pyodide runtime smoke skipped: this Chromium installation has a managed URLBlocklist=* policy.");
    return;
  }

  const chrome = findChromium();
  if (!chrome) {
    console.log("Local Pyodide runtime smoke skipped: Chromium/Chrome not found. Set CHROMIUM_BIN to run it.");
    return;
  }

  await writeMockPyodideRuntime();
  const server = await startStaticServer();
  const appPort = server.address().port;
  const debugPort = await freePort();
  const profile = path.join(ROOT, ".tmp-local-pyodide-smoke-profile");
  await fs.rm(profile, { recursive: true, force: true });

  const proc = spawn(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "about:blank"
  ], { stdio: ["ignore", "pipe", "pipe"] });

  try {
    const meta = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`, 10000);
    const ws = new WebSocket(meta.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const cdp = new CdpClient(ws);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");

    const base = `http://127.0.0.1:${appPort}`;
    const configuredBase = `.${MOCK_BASE_PATH}`;
    await navigate(cdp, `${base}/index.html?level=1&problem=L1-001&simple=1&pyodideBaseUrl=${encodeURIComponent(configuredBase)}`);
    await waitForCondition(cdp, `document.querySelector('#code') && document.querySelector('#btnRun')`, "L1 task renders with local pyodideBaseUrl");
    await cdp.eval(`document.querySelector('#btnRun').click()`);
    await waitForCondition(cdp, `document.querySelector('#runtimeStatusState') && (document.querySelector('#runtimeStatusState').textContent.includes('pripravený') || document.querySelector('#runtimeStatusState').textContent.includes('ready'))`, "mock local runtime reaches ready status", 12000);
    await waitForCondition(cdp, `document.querySelector('#out') && document.querySelector('#out').textContent.includes('local runtime smoke')`, "Run output came from mock local Pyodide runtime", 12000);
    const text = await cdp.eval(`document.body.innerText`);
    if (!text.includes("Python je pripravený") && !text.includes("Python runtime je pripravený")) {
      throw new Error("Ready runtime wording not found after local runtime smoke.");
    }
    await cdp.ws.close?.();
    console.log(`Local Pyodide runtime smoke OK: app used ${configuredBase} via Worker mock runtime.`);
  } finally {
    proc.kill("SIGTERM");
    server.close();
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
    await fs.rm(TMP_RUNTIME, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch(async (err) => {
  await fs.rm(TMP_RUNTIME, { recursive: true, force: true }).catch(() => {});
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
