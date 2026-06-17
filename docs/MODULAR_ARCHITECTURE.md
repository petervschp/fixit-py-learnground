# FixIt Student Path v0.9 — modular architecture and PWA/offline shell

FixIt v0.9 preserves the didactic behaviour and task content of v0.7. The main change is a PWA/offline shell layer: manifest, service worker, runtime status panel and documented Pyodide/CDN fallback limits.

## Entry point

`app.js` is only the boot/orchestration layer:

- loads local state,
- reads URL parameters,
- loads routes or free-practice levels,
- delegates rendering to modules.

It should not contain task UI, testing logic, exports or runner code.

## Modules

```text
src/
  problem-loader.js              Loads levels, routes and route task metadata.
  routes-renderer.js             Renders the “Moje trasy” home screen.
  task-renderer.js               Composes the main task screen and wires task-level modules.
  task-header-context-panel.js   Renders task title, progress badge, route context and learning context.
  problem-navigation.js          Handles route/free-practice navigation and level/problem switching.
  editor-panel.js                Owns code editor, stdin panel, draft autosave and Python indentation.
  predict-fix-panel.js           Owns Predict guess lock/clear state and Fix buggy-solution selection.
  test-action-handlers.js        Owns Run/Test buttons, Pyodide calls, diagnostics persistence and reports.
  diagnostic-hints.js            Renders context-sensitive hints from the last run/test diagnostics.
  runner-client.js               Owns the Pyodide Web Worker lifecycle and timeout calls.
  test-engine.js                 Normalizes stdout tests, structure checks and function tests.
  diagnostics.js                 Classifies failures and renders first-failed summaries.
  microdefense.js                Renders status badges, next-step cards and self-check UI.
  map-ui.js                      Renders the task map and misconception mini-stats.
  export-backup.js               Handles anonymous summary, private backup, import and reset.
  utils.js                       Small shared utilities.
```

## Boundaries

- `runner-client.js` is the only module that directly controls `py-worker.js`.
- `export-backup.js` is the only module that downloads/imports JSON and performs app reset.
- `test-engine.js` should not touch DOM.
- `diagnostics.js` should not run Python; it only interprets test details.
- `task-renderer.js` should remain a composition layer, not a dumping ground for panel logic.
- Browser smoke tests should cover user-visible flow invariants before additional refactors.

## What v0.9 intentionally did not change

- task content,
- route dramaturgy,
- evaluation semantics,
- Pyodide CDN strategy,
- UI language and classroom flow from v0.5.

Only `CONTENT_VERSION`, release documentation, CI workflows and release scripts changed so the project is easier to publish and maintain.

## Static checks

```bash
npm run validate
npm run audit
npm run smoke:modules
npm run release:check
```

## Browser smoke test

```bash
npm run smoke:browser
```

The browser smoke test uses Chromium through the Chrome DevTools Protocol. It starts a local static HTTP server and checks these flows:

1. routes home screen renders with classroom guidance,
2. route mode renders a concrete Y2 task,
3. simple mode hides export/backup controls,
4. free-practice mode renders level/problem selectors and the task map,
5. Predict flow can enter and lock a guess,
6. Fix flow can switch buggy-solution variants and update the editor,
7. anonymous summary export does not leak draft code or stdin,
8. private backup does include draft code and stdin,
9. PASS microdefense flow enables self-check and marks the problem `explained`.

The browser smoke intentionally does **not** run Pyodide or contact the CDN. It tests the app shell, route rendering, storage/export model and learning-flow UI. Runtime-level Python execution remains covered by manual smoke tests because school network/CDN conditions vary.

If Chromium is managed with `URLBlocklist=*`, the test prints a clear skip instead of reporting a false failure. In standard local or CI Chromium, it should run normally.

## Chromium setup

See `docs/CHROMIUM_BROWSER_SMOKE.md` for:

- `CHROMIUM_BIN` examples,
- GitHub Actions setup,
- managed browser policy notes,
- optional Playwright fallback.

## GitHub Actions

```text
.github/workflows/ci.yml
.github/workflows/release-zip.yml
```

CI validates content, audits the task bank, imports modules, runs browser smoke through a configured Chrome binary and checks release package hygiene.

## Manual fallback

```bash
npm run smoke:manual
```

This prints the latest manual checklist, currently `tests/MANUAL_SMOKE_TEST_FIXIT_V07.md`.


## PWA/offline shell modules

- `manifest.webmanifest` declares the standalone PWA metadata.
- `sw.js` cache-first serves the app shell, local modules, routes and JSON tasks.
- `src/pwa-offline.js` registers the service worker and updates the header offline shell status.
- `src/runtime-status.js` provides the task-level Python runtime status panel.
- External Pyodide CDN requests remain network-only in v0.9.


## v0.9 runtime/PWA additions

- `src/pyodide-config.js` centralizes default CDN and optional `PYODIDE_BASE_URL` configuration.
- `scripts/check-pwa-cache-manifest.mjs` verifies that `sw.js` cache entries cover local modules and task JSON files.
- Browser smoke includes a service-worker cache/offline reload path in normal Chromium/CI.


## v0.9 vendor runtime additions

V0.9 pridáva dokumentáciu a testy pre školský lokálny Pyodide runtime mimo hlavného ZIPu: `docs/vendor-pyodide/README.md`, `scripts/check-vendor-pyodide.mjs` a `tests/local-pyodide-runtime-smoke.mjs`. Aplikačné správanie a obsah úloh sa nemenia.
