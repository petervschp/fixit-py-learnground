#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const swPath = path.join(root, "sw.js");
const errors = [];

if (!fs.existsSync(swPath)) {
  console.error("PWA cache manifest check failed: sw.js is missing.");
  process.exit(1);
}

const sw = fs.readFileSync(swPath, "utf8");
const match = sw.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
if (!match) {
  console.error("PWA cache manifest check failed: cannot find const APP_SHELL = [...] in sw.js.");
  process.exit(1);
}

const cached = [...match[1].matchAll(/["'](.+?)["']/g)].map(m => normalizeRel(m[1]));
const cachedSet = new Set(cached);

const required = new Set([
  "./",
  "index.html",
  "app.js",
  "storage.js",
  "py-worker.js",
  "style.css",
  "manifest.webmanifest",
  "assets/icon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "student_routes.json"
]);

for (const rel of listFiles("src", file => file.endsWith(".js"))) required.add(rel);
for (const rel of listFiles("problems", file => file.endsWith(".json"))) required.add(rel);

for (const rel of required) {
  if (!cachedSet.has(rel)) errors.push(`sw.js APP_SHELL is missing: ${rel}`);
}

for (const rel of cached) {
  if (rel === "./") continue;
  if (!fs.existsSync(path.join(root, rel))) errors.push(`sw.js APP_SHELL references missing file: ${rel}`);
}

if (!sw.includes("Pyodide") || !sw.includes("network-only")) {
  errors.push("sw.js should explicitly document that external Pyodide runtime stays network-only.");
}

if (errors.length) {
  console.error("PWA cache manifest check failed:");
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log(`PWA cache manifest OK: ${cachedSet.size} cached entries cover ${required.size} required local app-shell/task files.`);

function normalizeRel(rel) {
  let s = String(rel || "").trim();
  if (s === "./" || s === "/") return "./";
  s = s.replace(/^\.\//, "").replace(/^\//, "");
  return s;
}

function listFiles(dir, predicate) {
  const base = path.join(root, dir);
  const out = [];
  if (!fs.existsSync(base)) return out;
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (!predicate(entry.name)) continue;
    out.push(`${dir}/${entry.name}`);
  }
  return out.sort();
}
