#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync(path.join(root, "problems"))
      .filter(x => /^level-\d+\.json$/.test(x))
      .map(x => path.join("problems", x));

let errors = 0;
let warnings = 0;
let total = 0;

function fail(file, id, msg) {
  errors += 1;
  console.error(`ERROR ${file} ${id || ""}: ${msg}`);
}
function warn(file, id, msg) {
  warnings += 1;
  console.warn(`WARN  ${file} ${id || ""}: ${msg}`);
}

function hasStdoutCases(p) {
  return Array.isArray(p.tests) || Array.isArray(p.test_cases) || p.expected_output != null || p.expected_stdout != null;
}

for (const file of files) {
  const full = path.join(root, file);
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (e) {
    fail(file, "", `neplatný JSON: ${e.message}`);
    continue;
  }
  if (!Array.isArray(arr)) {
    fail(file, "", "level súbor musí byť pole úloh");
    continue;
  }
  const seen = new Set();
  for (const p of arr) {
    total += 1;
    const id = p.id || "<missing-id>";
    if (!p.id) fail(file, id, "chýba id");
    if (seen.has(p.id)) fail(file, id, "duplicitné id v leveli");
    seen.add(p.id);
    if (!Number.isFinite(p.level)) fail(file, id, "chýba číselný level");
    if (!p.title) warn(file, id, "chýba title");
    if (!p.statement) warn(file, id, "chýba statement");
    if (!p.mode) warn(file, id, "chýba mode");
    if (p.mode === "predict") {
      if (!hasStdoutCases(p)) fail(file, id, "predict úloha potrebuje test_cases/tests/expected_output");
    } else if (p.evaluation?.kind === "function") {
      if (!p.evaluation?.target?.name) fail(file, id, "function evaluation chýba target.name");
      if (!Array.isArray(p.evaluation?.cases) || p.evaluation.cases.length === 0) fail(file, id, "function evaluation potrebuje cases");
      for (const [i, c] of (p.evaluation.cases || []).entries()) {
        if (!Array.isArray(c.args)) fail(file, id, `case ${i+1} chýba args pole`);
        if (!("expected_return" in c)) fail(file, id, `case ${i+1} chýba expected_return`);
      }
    } else if (!hasStdoutCases(p)) {
      fail(file, id, "stdout úloha potrebuje test_cases/tests/expected_output");
    }
    if (p.schema_version && p.schema_version < 2) warn(file, id, "staršia schema_version");
  }
}

console.log(`Audit OK: ${total} úloh, errors=${errors}, warnings=${warnings}`);
process.exit(errors ? 1 : 0);
