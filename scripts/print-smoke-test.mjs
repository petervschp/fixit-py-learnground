#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const candidates = [
  "MANUAL_SMOKE_TEST_FIXIT_V09.md",
  "MANUAL_SMOKE_TEST_FIXIT_V08.md",
  "MANUAL_SMOKE_TEST_FIXIT_V07.md",
  "MANUAL_SMOKE_TEST_FIXIT_V06.md",
  "MANUAL_SMOKE_TEST_FIXIT_V05.md",
  "MANUAL_SMOKE_TEST_FIXIT_V04.md",
  "MANUAL_SMOKE_TEST_FIXIT_V03.md"
];

const found = candidates
  .map(name => path.join(process.cwd(), "tests", name))
  .find(file => fs.existsSync(file));

if (!found) {
  console.error("Manual smoke test checklist not found.");
  process.exit(1);
}

console.log(fs.readFileSync(found, "utf8"));
