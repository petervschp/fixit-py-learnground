# Release checklist — FixIt Student Path v0.9

Pred vytvorením ZIPu alebo GitHub release prebehni tento minimálny checklist.

## 1. Statické kontroly

```bash
npm run validate
npm run audit
npm run smoke:modules
npm run pwa:check
npm run release:check
```

Očakávanie:

- validácia obsahu bez errors/warnings,
- audit úloh bez errors/warnings,
- module import smoke bez chyby,
- PWA cache manifest pokrýva `src/*.js`, `problems/*.json`, shell súbory, ikony a `student_routes.json`,
- release package check bez chýbajúceho alebo zakázaného súboru.

## 2. Browser smoke vrátane PWA offline reloadu

```bash
npm run smoke:browser
```

Očakávanie v štandardnom Chromiu:

- PWA manifest a status panel OK,
- service worker cache sa naplní,
- online first load → offline reload → route/task sa načíta z cache,
- routes home OK,
- route mode OK,
- simple mode OK,
- free-practice mode OK,
- Predict lock OK,
- Fix buggy-solution OK,
- export/backup privacy model OK,
- PASS microdefense OK.

Ak Chromium nie je nájdené, nastav `CHROMIUM_BIN` podľa `docs/CHROMIUM_BROWSER_SMOKE.md`.

Ak prostredie používa spravovanú Chromium politiku `URLBlocklist=*`, test sa môže korektne preskočiť. Vtedy ho spusti na inom lokálnom/CI Chromiu alebo prejdi manuálny checklist.

## 3. Voliteľný Playwright fallback

```bash
npm install -D playwright
npx playwright install chromium
npm run smoke:browser:playwright
```

Tento krok je voliteľný. Predvolená cesta je stále bez Playwright dependency.

## 4. Manuálny smoke

```bash
npm run smoke:manual
python -m http.server 8000
```

Prejdi `tests/MANUAL_SMOKE_TEST_FIXIT_V08.md`.

## 5. Privacy kontrola

- Anonymný summary export neobsahuje meno.
- Anonymný summary export neobsahuje draft code.
- Anonymný summary export neobsahuje stdin.
- Súkromná záloha je jasne označená ako súkromná a môže obsahovať code/stdin.
- Import je určený iba pre súkromnú zálohu, nie pre anonymný summary export.
- Reset progresu a reset offline cache sú oddelené akcie.

## 6. GitHub-ready štruktúra

Release balík má obsahovať minimálne:

```text
index.html
app.js
storage.js
py-worker.js
style.css
manifest.webmanifest
sw.js
assets/icon.svg
assets/icon-192.png
assets/icon-512.png
src/
problems/
student_routes.json
scripts/
tests/
docs/
.github/workflows/ci.yml
.github/workflows/release-zip.yml
README.md
CHANGELOG.md
LICENSE
PRIVACY.md
SECURITY.md
CONTRIBUTING.md
package.json
.gitignore
```

Nemá obsahovať:

```text
.tmp-browser-smoke-profile/
node_modules/
.DS_Store
Thumbs.db
fixit-private-backup-*.json
fixit-anonymous-summary-*.json
*.log
*.tmp
```

## 7. PWA/offline shell kontrola

- `manifest.webmanifest` existuje a používa `start_url: ./index.html`.
- PNG ikony `assets/icon-192.png` a `assets/icon-512.png` existujú.
- `sw.js` cacheuje app shell, `src/`, `problems/` a `student_routes.json`.
- `npm run pwa:check` prejde bez chýb.
- Dokumentácia jasne hovorí, že offline shell neznamená offline Python runtime.
- Pri offline režime sa majú načítať zadania a trasy; Run/Testy môžu zlyhať s jasnou runtime fallback správou.

## 8. PYODIDE_BASE_URL kontrola

- Default ostáva CDN: `https://cdn.jsdelivr.net/pyodide/v0.25.1/full/`.
- Voliteľne sa dá použiť query parameter `?pyodideBaseUrl=...`.
- Voliteľne sa dá použiť `window.FIXIT_PYODIDE_BASE_URL` pred načítaním appky.
- Voliteľne sa dá použiť `localStorage['fixit.pyodide.baseUrl']`.
- Ak lokálna cesta neexistuje, Run/Testy zlyhajú jasne a zadania zostanú čitateľné.

## 9. Vytvorenie ZIPu

```bash
npm run release:zip
```

Očakávanie:

- vytvorí sa ZIP v `dist/`,
- ZIP prejde `unzip -t`,
- ZIP neobsahuje súkromné exporty, cache, `node_modules` ani dočasný browser profil.

## 10. GitHub Actions

Pred označením release skontroluj, že prešiel workflow:

```text
FixIt Student Path CI
```

Pri tagu `v*` alebo ručnom spustení workflow `Build release ZIP` spúšťa aj `npm run smoke:browser` a až potom vytvorí release artefakt.


## Vendor Pyodide deployment

- [ ] Hlavný release ZIP neobsahuje `vendor/pyodide/`.
- [ ] `docs/vendor-pyodide/README.md` vysvetľuje rozdiel medzi hlavným ZIPom a voliteľným runtime balíkom.
- [ ] `npm run vendor:check` je zdokumentovaný ako kontrola reálneho školského vendor balíka.
- [ ] `npm run smoke:local-pyodide` overuje lokálnu `PYODIDE_BASE_URL` cestu cez dočasný mock runtime.
- [ ] Manuálny smoke test v0.9 obsahuje CDN režim, lokálny runtime režim a zlú lokálnu cestu.
