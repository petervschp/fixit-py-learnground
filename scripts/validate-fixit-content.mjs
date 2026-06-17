#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const problemDir = path.join(root, "problems");
const levelFiles = fs.readdirSync(problemDir).filter(x => /^level-\d+\.json$/.test(x));
const problems = new Map();
const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }

for (const lf of levelFiles) {
  const arr = readJson(path.join(problemDir, lf));
  if (!Array.isArray(arr)) { err(`${lf}: musí byť JSON pole`); continue; }
  for (const p of arr) {
    if (!p.id) { err(`${lf}: úloha bez id`); continue; }
    if (problems.has(p.id)) err(`duplicitné id ${p.id}`);
    problems.set(p.id, { ...p, _file: lf });
    if (p.schema_version < 3) warn(`${p.id}: schema_version < 3`);
    for (const k of ["phaseTags", "concepts", "routeRole", "failureKinds"]) {
      if (!Array.isArray(p[k])) warn(`${p.id}: ${k} nie je pole`);
    }
    if (!p.dramaturgyNode) warn(`${p.id}: chýba dramaturgyNode`);
  }
}

const routesPath = path.join(root, "student_routes.json");
if (!fs.existsSync(routesPath)) {
  err("chýba student_routes.json");
} else {
  const routes = readJson(routesPath);
  if (!Array.isArray(routes)) err("student_routes.json musí byť pole");
  const routeIds = new Set();
  for (const r of routes) {
    if (!r.id) err("trasa bez id");
    if (routeIds.has(r.id)) err(`duplicitná trasa ${r.id}`);
    routeIds.add(r.id);
    for (const k of ["coreTasks", "reserveTasks"]) {
      if (!Array.isArray(r[k])) err(`${r.id}: ${k} musí byť pole`);
      for (const t of r[k] || []) {
        if (!t.id) err(`${r.id}: route task bez id`);
        if (!problems.has(t.id)) err(`${r.id}: odkazuje na neexistujúcu úlohu ${t.id}`);
        const p = problems.get(t.id);
        if (p && Number(t.level) !== Number(p.level)) err(`${r.id}/${t.id}: level v trase (${t.level}) nesedí s úlohou (${p.level})`);
      }
    }
    if (!r.microDefense?.defaultPrompt) warn(`${r.id}: chýba microDefense.defaultPrompt`);
  }
}

console.log(`FixIt content validation: problems=${problems.size}, errors=${errors.length}, warnings=${warnings.length}`);
for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
process.exit(errors.length ? 1 : 0);
