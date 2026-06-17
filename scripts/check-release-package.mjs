#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const required = [
  "index.html",
  "app.js",
  "storage.js",
  "py-worker.js",
  "style.css",
  "manifest.webmanifest",
  "sw.js",
  "assets/icon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "student_routes.json",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "PRIVACY.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "package.json",
  ".gitignore",
  ".github/workflows/ci.yml",
  ".github/workflows/release-zip.yml",
  "docs/RELEASE_CHECKLIST.md",
  "docs/GITHUB_PAGES.md",
  "docs/CHROMIUM_BROWSER_SMOKE.md",
  "docs/PWA_OFFLINE.md",
  "docs/PYODIDE_RUNTIME.md",
  "docs/VENDOR_PYODIDE.md",
  "docs/vendor-pyodide/README.md",
  "docs/MODULAR_ARCHITECTURE.md",
  "tests/browser-smoke.mjs",
  "tests/module-import-smoke.mjs",
  "tests/MANUAL_SMOKE_TEST_FIXIT_V09.md",
  "scripts/audit-level.mjs",
  "scripts/validate-fixit-content.mjs",
  "scripts/check-release-package.mjs",
  "scripts/check-pwa-cache-manifest.mjs",
  "scripts/check-vendor-pyodide.mjs",
  "scripts/print-smoke-test.mjs",
  "src/task-renderer.js",
  "src/runner-client.js",
  "src/pyodide-config.js",
  "tests/local-pyodide-runtime-smoke.mjs",
  "src/test-engine.js",
  "problems/level-01.json",
  "problems/level-07.json"
];

const forbiddenNames = new Set([
  "node_modules",
  ".tmp-browser-smoke-profile",
  ".tmp-local-pyodide-runtime",
  ".tmp-local-pyodide-smoke-profile",
  ".DS_Store",
  "Thumbs.db"
]);

const forbiddenPatterns = [
  /^fixit-private-backup-.*\.json$/,
  /^fixit-anonymous-summary-.*\.json$/,
  /^.*\.log$/,
  /^.*\.tmp$/
];

const errors = [];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`Missing required release file: ${rel}`);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replaceAll(path.sep, "/");
    if (forbiddenNames.has(entry.name)) {
      errors.push(`Forbidden release artifact present: ${rel}`);
      continue;
    }
    if (forbiddenPatterns.some(rx => rx.test(entry.name))) {
      errors.push(`Forbidden release file present: ${rel}`);
    }
    if (entry.isDirectory()) walk(full);
  }
}

walk(root);

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJson.private !== false) errors.push("package.json must remain publishable/private=false for public GitHub metadata.");
if (!packageJson.scripts?.validate || !packageJson.scripts?.audit || !packageJson.scripts?.["smoke:browser"] || !packageJson.scripts?.["pwa:check"] || !packageJson.scripts?.["vendor:check"] || !packageJson.scripts?.["smoke:local-pyodide"]) {
  errors.push("package.json is missing required validate/audit/smoke:browser/pwa:check/vendor:check/smoke:local-pyodide scripts.");
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const needle of ["Nie je to LMS", "CHROMIUM_BIN", "GitHub Actions", "Pyodide cez CDN", "offline shell", "PYODIDE_BASE_URL", "vendor/pyodide"]) {
  if (!readme.includes(needle)) errors.push(`README.md is missing expected public-release wording: ${needle}`);
}

const privacy = fs.readFileSync(path.join(root, "PRIVACY.md"), "utf8");
for (const needle of ["localStorage", "Anonymné zhrnutie", "Súkromná záloha", "GitHub Pages"]) {
  if (!privacy.includes(needle)) errors.push(`PRIVACY.md is missing expected privacy wording: ${needle}`);
}

const security = fs.readFileSync(path.join(root, "SECURITY.md"), "utf8");
for (const needle of ["nie o bezpečnostný sandbox", "Pyodide", "CHROMIUM_BIN", "Import JSON", "service worker", "PYODIDE_BASE_URL", "vendor/pyodide"]) {
  if (!security.includes(needle)) errors.push(`SECURITY.md is missing expected security wording: ${needle}`);
}

if (errors.length) {
  console.error("Release package check failed:");
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log(`Release package check OK: ${required.length} required files present, no forbidden artifacts found.`);
