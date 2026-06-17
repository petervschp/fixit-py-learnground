# Manual smoke test — FixIt Student Path v0.3

Run before classroom use and before publishing a release ZIP.

## 1. Start local server

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/
```

Expected: the “Moje trasy” screen is visible.

## 2. Route home

Check that:

- route cards are visible,
- each route shows core/reserve counts,
- teacher cards open inside route cards,
- “Voľné precvičovanie” link is visible.

## 3. Y2 bridge route

Open:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026
```

Expected:

- task `L7-026 add_task` opens,
- route context is visible,
- editor is visible,
- task map is visible,
- anonymous export section is visible in full mode.

## 4. Simple mode

Open:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026&simple=1
```

Expected:

- editor is visible,
- Run/Testy/Poraď mi are visible,
- export/import/backup/reset section is hidden,
- simple-mode note is visible.

## 5. Free practice

Open:

```text
http://localhost:8000/?level=1&problem=L1-001
```

Expected:

- free-practice context is visible,
- level selector is visible,
- task map uses clickable buttons,
- switching tasks keeps the app responsive.

## 6. Runner smoke

In `L1-001`, run a simple correct solution and click Testy.

Expected:

- Pyodide loads in the worker,
- tests finish,
- status becomes “TESTY PREŠLI”,
- microdefense buttons become enabled.

## 7. L7 function smoke

Open:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-028
```

Run a correct `render_task_count(tasks)` solution.

Expected:

- function tests run,
- return value is checked,
- no `input()`/`print()` is required.

## 8. Export smoke

In full mode, click:

- “Stiahnuť anonymné zhrnutie”,
- “Skopírovať anonymný kód”,
- “Stiahnuť moju súkromnú zálohu”.

Expected:

- anonymous summary contains no code and no stdin,
- private backup is clearly marked as private,
- importing a private backup reloads the local state.

## 9. Automated browser smoke

When Chromium is available and not URL-blocked by local policy:

```bash
npm run smoke:browser
```

Expected:

```text
Browser smoke OK: home, route problem, simple mode and free practice render without runtime exceptions.
```
