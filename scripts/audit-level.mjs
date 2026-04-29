import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Použitie: node scripts/audit-level.mjs problems/level-06.json');
  process.exit(1);
}

const tasks = JSON.parse(fs.readFileSync(file, 'utf8'));
let errors = 0;

for (const task of tasks) {
  const prefix = `[${task.id ?? 'NO-ID'}]`;
  if (!task.id) { console.log(`${prefix} chýba id`); errors++; }
  if (!task.mode) { console.log(`${prefix} chýba mode`); errors++; }
  if (!Array.isArray(task.hints) || task.hints.length < 3) {
    console.log(`${prefix} má menej ako 3 hinty`); errors++;
  }

  if ((task.mode === 'solve' || task.mode === 'fix') && task.evaluation?.kind === 'function') {
    if (!task.evaluation?.target?.name) {
      console.log(`${prefix} function evaluation nemá target.name`); errors++;
    }
    if (!Array.isArray(task.evaluation?.cases) || task.evaluation.cases.length < 2) {
      console.log(`${prefix} function evaluation má málo test cases`); errors++;
    }
    const hasVisible = task.evaluation.cases?.some(c => c.visible === true);
    const hasHidden = task.evaluation.cases?.some(c => c.visible === false);
    if (!hasVisible || !hasHidden) {
      console.log(`${prefix} odporúčanie: maj aspoň jeden visible aj hidden case`);
    }
  }

  if (task.mode === 'predict') {
    if (!Array.isArray(task.tests) || task.tests.length === 0) {
      console.log(`${prefix} predict úloha nemá tests/expected_stdout`); errors++;
    }
  }
}

if (errors) {
  console.error(`Audit skončil s počtom problémov: ${errors}`);
  process.exit(1);
}
console.log(`OK: ${tasks.length} úloh prešlo základným auditom.`);
