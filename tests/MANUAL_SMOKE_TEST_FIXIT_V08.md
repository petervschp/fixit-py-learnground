# Manual smoke test — FixIt Student Path v0.8

Run from the release root:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/` in a normal browser.

## 1. Online classroom smoke

- Home shows **Moje trasy**.
- Open `?route=Y2_most_cli_dom&problem=L7-026`.
- Check that the editor, Run/Testy/Poraď mi buttons and map are visible.
- Click **Run** or **Testy** while online and verify that the Python runtime panel changes from waiting/loading to ready or to a clear error.
- Confirm that the error text says, in student language, that the assignment is visible but Python cannot currently run when runtime loading fails.

## 2. Simple mode smoke

Open:

```text
http://localhost:8000/index.html?route=Y2_most_cli_dom&problem=L7-026&simple=1
```

- Export/backup/advanced controls are hidden.
- The PWA header uses simple wording: **Stav appky**.
- The runtime panel uses simple wording: **Stav Pythonu**.
- It should avoid exposing service-worker/Pyodide/CDN details unless a teacher opens documentation.

## 3. Offline shell smoke

- While online, open at least one route and one free-practice task.
- Wait until the header says the offline shell is ready.
- In browser devtools, switch network to Offline.
- Reload the route page.
- Expected: the app shell, route, task text and local map still render.
- Expected: Run/Testy may fail if Pyodide runtime was not already available.
- Expected student-facing fallback: **Zadanie vidíš, ale Python sa teraz nedá spustiť.**

## 4. CDN blocked fallback smoke

- Stay online but block `cdn.jsdelivr.net` in devtools/network or school filtering test environment.
- Open a task and click Run/Testy.
- Expected: app shell and task content still work.
- Expected: Python runtime panel shows a clear unavailable/error message.
- Expected: no raw stack trace should be the only visible feedback.

## 5. Reset smoke

In full mode open **Pokročilé**:

- Click **Vymazať môj progres** only after making a small draft.
  - Expected: local progress/draft is removed.
  - Expected: offline cache is not intentionally cleared.
- Reload online, then click **Vymazať offline cache**.
  - Expected: service worker/cache are removed or marked for reload.
  - Expected: progress remains unless separately cleared.

## 6. PYODIDE_BASE_URL smoke

Default CDN mode:

```text
http://localhost:8000/index.html?route=Y2_most_cli_dom&problem=L7-026
```

Custom local/runtime path mode:

```text
http://localhost:8000/index.html?route=Y2_most_cli_dom&problem=L7-026&pyodideBaseUrl=./vendor/pyodide/v0.25.1/full/
```

- Expected: runtime panel documents that the configured runtime path is used.
- Expected: if the local runtime path is absent, Run/Testy fail clearly while assignments remain readable.

## 7. Automated checks

```bash
npm run validate
npm run audit
npm run smoke:modules
npm run pwa:check
npm run smoke:browser
npm run release:check
```

In restricted Chromium environments `smoke:browser` may skip because of a managed `URLBlocklist=*` policy. Run it in a normal local/CI Chromium before public release.
