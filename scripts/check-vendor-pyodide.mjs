#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inputPath = process.argv[2] || process.env.PYODIDE_VENDOR_DIR || "vendor/pyodide/v0.25.1/full";
const vendorDir = path.resolve(root, inputPath);
const relVendorDir = path.relative(root, vendorDir).replaceAll(path.sep, "/") || ".";

const requiredFiles = [
  "pyodide.js",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json"
];

const recommendedFiles = [
  "pyodide.asm.js",
  "package.json"
];

const errors = [];
const warnings = [];

if (!fs.existsSync(vendorDir)) {
  errors.push(`Vendor Pyodide directory does not exist: ${relVendorDir}`);
} else if (!fs.statSync(vendorDir).isDirectory()) {
  errors.push(`Vendor Pyodide path is not a directory: ${relVendorDir}`);
}

for (const name of requiredFiles) {
  const full = path.join(vendorDir, name);
  if (!fs.existsSync(full)) {
    errors.push(`Missing required Pyodide runtime file: ${relVendorDir}/${name}`);
    continue;
  }
  const stat = fs.statSync(full);
  if (!stat.isFile()) errors.push(`Required Pyodide entry is not a file: ${relVendorDir}/${name}`);
  if (stat.size === 0) errors.push(`Required Pyodide file is empty: ${relVendorDir}/${name}`);
}

for (const name of recommendedFiles) {
  const full = path.join(vendorDir, name);
  if (!fs.existsSync(full)) warnings.push(`Recommended Pyodide file not found: ${relVendorDir}/${name}`);
}

const pyodideJs = path.join(vendorDir, "pyodide.js");
if (fs.existsSync(pyodideJs) && fs.statSync(pyodideJs).isFile()) {
  const sample = fs.readFileSync(pyodideJs, "utf8").slice(0, 250000);
  if (!sample.includes("loadPyodide")) {
    errors.push(`${relVendorDir}/pyodide.js does not appear to expose loadPyodide.`);
  }
}

const lockFile = path.join(vendorDir, "pyodide-lock.json");
if (fs.existsSync(lockFile) && fs.statSync(lockFile).isFile()) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    const version = lock.info?.version || lock.pyodide_version || lock.version || "";
    if (version && String(version) !== "0.25.1") {
      warnings.push(`pyodide-lock.json version looks like ${version}; FixIt is documented for Pyodide 0.25.1.`);
    }
  } catch (err) {
    errors.push(`pyodide-lock.json is not valid JSON: ${err.message}`);
  }
}

if (errors.length) {
  console.error("Vendor Pyodide check failed:");
  for (const err of errors) console.error(`- ${err}`);
  if (warnings.length) {
    console.error("Warnings:");
    for (const w of warnings) console.error(`- ${w}`);
  }
  console.error("\nExpected default layout: vendor/pyodide/v0.25.1/full/ containing pyodide.js, pyodide.asm.wasm, python_stdlib.zip and pyodide-lock.json.");
  process.exit(1);
}

for (const w of warnings) console.warn(`Vendor Pyodide warning: ${w}`);
console.log(`Vendor Pyodide check OK: ${relVendorDir} contains ${requiredFiles.length} required runtime files.`);
