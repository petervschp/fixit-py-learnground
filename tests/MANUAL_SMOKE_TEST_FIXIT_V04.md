# Manual smoke test — FixIt Student Path v0.4

Goal: verify that the v0.4 task-renderer split did not change classroom behaviour from v0.3.

## Start

```bash
python -m http.server 8000
```

Open `http://localhost:8000/`.

## Checks

1. Home renders `Moje trasy`.
2. Open `?route=Y2_most_cli_dom&problem=L7-026&simple=1`.
   - The task `add_task` renders.
   - Simple mode hides export/backup controls.
   - Code editor and Run/Test/Hint buttons are visible.
3. Open `?level=1&problem=L1-001`.
   - Free-practice context is visible.
   - Level selector and problem selector work.
   - Task map renders buttons.
4. In a Solve task, type a harmless edit and refresh.
   - Draft code is preserved.
5. Use `Použi vzor z testu` and `Vyčisti stdin`.
   - Run input changes and status messages appear.
6. In a Predict task such as `?level=1&problem=L1-P01`, verify:
   - Testy is disabled.
   - Run before locking asks for a locked prediction.
   - Locking a prediction enables Run comparison.
7. In a Fix task such as `?level=1&problem=L1-F01`, switch the buggy solution.
   - Starter code changes to the selected buggy solution.
   - Output and tests clear.
8. Run/Test a basic task after Pyodide loads.
   - Output panel and Testy panel update.
   - PASS enables microdefense buttons.
   - FAIL keeps the first-failure guidance visible.
9. In full mode, export anonymous teacher summary and private backup.
   - Teacher summary contains no code/stdin/name.
   - Private backup is labelled as private.
10. Run in terminal:

```bash
npm run validate
npm run audit
npm run smoke:modules
npm run smoke:browser
```

If `smoke:browser` skips due managed Chromium URL policy, run this manual checklist in a regular local browser.
