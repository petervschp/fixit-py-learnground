# Browser smoke test setup

FixIt Student Path has two browser smoke options:

1. **Default CDP smoke** — `npm run smoke:browser`
2. **Optional Playwright smoke** — `npm run smoke:browser:playwright`

Neither smoke test intentionally runs Pyodide. They test UI flows that must stay stable during refactors: route mode, simple mode, free practice, Predict lock, Fix variant loading, export/backup privacy and basic PASS microdefense state.

## Default: Chrome DevTools Protocol smoke

```bash
npm run smoke:browser
```

The script starts a local static server and launches a Chromium/Chrome binary through the Chrome DevTools Protocol.

### `CHROMIUM_BIN`

When Chromium is not found automatically, set `CHROMIUM_BIN`:

```bash
CHROMIUM_BIN=/usr/bin/chromium npm run smoke:browser
CHROMIUM_BIN=/usr/bin/google-chrome-stable npm run smoke:browser
CHROMIUM_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run smoke:browser
```

Candidate paths checked automatically:

```text
process.env.CHROMIUM_BIN
/usr/bin/chromium
/usr/bin/chromium-browser
/usr/bin/google-chrome
/usr/bin/google-chrome-stable
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

### Managed browser policy

Some managed school or container environments configure Chromium with:

```text
URLBlocklist=*
```

In that case the smoke test prints a skip message instead of failing. Run the test on an unrestricted local/CI Chromium before publishing a release.

## GitHub Actions

The workflow `.github/workflows/ci.yml` uses `browser-actions/setup-chrome@v1` and passes the installed binary to the smoke test via `CHROMIUM_BIN`.

## Optional Playwright fallback

The project does **not** require Playwright by default. If you already use Playwright locally or in CI, you can run the optional fallback:

```bash
npm install -D playwright
npx playwright install chromium
npm run smoke:browser:playwright
```

If Playwright is not installed, the fallback script exits cleanly with a skip message. This keeps the normal no-dependency release path intact.

## Manual fallback

When browser automation is impossible, print the latest manual checklist:

```bash
npm run smoke:manual
```

Then serve the app locally:

```bash
python -m http.server 8000
```

Open `http://localhost:8000/` and follow `tests/MANUAL_SMOKE_TEST_FIXIT_V07.md`.


## PWA checks in browser smoke

The v0.8 CDP smoke verifies that `manifest.webmanifest` is linked, that the offline shell status area renders, and that the Service Worker API is available on localhost. The v0.8 CDP smoke also verifies an online first load → service worker cache → offline reload path in standard local/CI Chromium.


## Lokálny Pyodide runtime smoke

V0.9 pridáva `npm run smoke:local-pyodide`. Test používa rovnaký Chromium/CDP prístup ako hlavný browser smoke, ale vytvorí dočasný mock runtime v `.tmp-local-pyodide-runtime/` a overí lokálnu `PYODIDE_BASE_URL` cestu cez Web Worker. Ak je Chromium blokované managed policy `URLBlocklist=*`, test sa korektne preskočí.
