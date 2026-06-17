#!/usr/bin/env node
// Optional Playwright fallback smoke test.
// The default smoke test uses Chromium CDP without npm dependencies. Use this script only
// when Playwright is already available in the environment, for example:
//   npm install -D playwright
//   npx playwright install chromium
//   npm run smoke:browser:playwright

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("Playwright smoke skipped: optional dependency 'playwright' is not installed. Use npm run smoke:browser for the dependency-free CDP smoke test, or install Playwright locally.");
  process.exit(0);
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js") || file.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
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
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function expectVisible(page, selector, label) {
  await page.waitForSelector(selector, { timeout: 8000 });
  const ok = await page.locator(selector).first().isVisible();
  if (!ok) throw new Error(`Expected visible: ${label}`);
}

async function expectText(page, text, label = text) {
  const ok = await page.locator("body").evaluate((body, expected) => body.innerText.includes(expected), text);
  if (!ok) throw new Error(`Expected page text: ${label}`);
}

async function main() {
  const server = await startStaticServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));

  try {
    await page.goto(`${base}/index.html`);
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith("fixit.")) localStorage.removeItem(k);
      for (const k of Object.keys(sessionStorage)) if (k.startsWith("fixit.")) sessionStorage.removeItem(k);
    });

    await page.goto(`${base}/index.html`);
    await expectVisible(page, ".routes-home", "routes home");
    await expectText(page, "Moje trasy");

    await page.goto(`${base}/index.html?route=Y2_most_cli_dom&problem=L7-026&simple=1`);
    await expectVisible(page, "#code", "route editor");
    await expectText(page, "add_task");
    if (await page.locator("#btnExport").count()) throw new Error("Simple mode should hide teacher export controls.");

    await page.goto(`${base}/index.html?level=1&problem=L1-P01`);
    await expectVisible(page, "#levelSelect", "free-practice level select");
    await expectVisible(page, "#mapBox button.tile", "free-practice map tile");

    await page.goto(`${base}/index.html?route=Y2_brython_event_render&problem=L7-P29`);
    await expectVisible(page, "#predictGuess", "predict textarea");
    await page.fill("#predictGuess", "True\n2\n");
    await page.click("#btnLockGuess");
    if (!(await page.locator("#predictGuess").isDisabled())) throw new Error("Predict guess was not locked.");

    await page.goto(`${base}/index.html?route=Y2_brython_event_render&problem=L7-F30`);
    await expectVisible(page, "#buggySelect", "fix selector");
    await page.selectOption("#buggySelect", "B2");
    const code = await page.locator("#code").inputValue();
    if (!code.includes("new_task")) throw new Error("Fix variant B2 did not load into editor.");

    await page.goto(`${base}/index.html?route=Y2_most_cli_dom&problem=L7-026`);
    await expectVisible(page, "#btnExport", "anonymous export button");
    await expectVisible(page, "#btnBackup", "private backup button");
    const exportResult = await page.evaluate(async () => {
      const m = await import("/storage.js");
      const routes = await fetch("/student_routes.json").then(r => r.json());
      const route = routes.find(r => r.id === "Y2_most_cli_dom");
      const state = m.loadState();
      const entry = m.ensureProblemEntry(state, "L7-026");
      entry.draftCode = "SECRET_CODE_SHOULD_NOT_BE_IN_TEACHER_SUMMARY";
      entry.runInput = "SECRET_STDIN_SHOULD_NOT_BE_IN_TEACHER_SUMMARY";
      entry.lastResult = "PASS";
      entry.status = "explained";
      m.saveState(state);
      const anon = await m.buildAnonymousSummaryExport(state, route, { currentProblem: { id: "L7-026", title: "Y2 most: add_task(tasks, text)", level: 7 }, routeMode: true });
      const backup = await m.buildPrivateBackupExport(state, { currentProblem: { id: "L7-026", title: "Y2 most: add_task(tasks, text)", level: 7 }, route: { id: route.id, title: route.title } });
      return {
        anonType: anon.type,
        backupType: backup.type,
        anonLeaks: JSON.stringify(anon).includes("SECRET_CODE_SHOULD_NOT_BE_IN_TEACHER_SUMMARY") || JSON.stringify(anon).includes("SECRET_STDIN_SHOULD_NOT_BE_IN_TEACHER_SUMMARY"),
        backupIncludes: JSON.stringify(backup).includes("SECRET_CODE_SHOULD_NOT_BE_IN_TEACHER_SUMMARY") && JSON.stringify(backup).includes("SECRET_STDIN_SHOULD_NOT_BE_IN_TEACHER_SUMMARY")
      };
    });
    if (exportResult.anonType !== "fixit-anonymous-summary" || exportResult.backupType !== "fixit-private-backup" || exportResult.anonLeaks || !exportResult.backupIncludes) {
      throw new Error(`Export/backup privacy model failed: ${JSON.stringify(exportResult)}`);
    }

    await page.goto(`${base}/index.html?route=Y2_most_cli_dom&problem=L7-026`);
    await page.evaluate(async () => {
      const m = await import("/storage.js");
      const state = m.loadState();
      m.setResult(state, "L7-026", "PASS");
    });
    await page.goto(`${base}/index.html?route=Y2_most_cli_dom&problem=L7-026`);
    await page.click('.btnMicroDefense[data-rating="3"]');
    await expectText(page, "VYSVETLENÉ");

    if (errors.length) throw new Error(`Runtime page errors: ${errors.join("\n")}`);
    console.log("Playwright browser smoke OK: core v0.6 flows passed.");
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
