# Changelog

## 0.9.0 — vendor Pyodide deployment outside main ZIP

- Zachované správanie v0.8; bez didaktických zmien a bez zmien obsahu úloh.
- Pridaný školský postup `docs/vendor-pyodide/README.md` pre lokálnu kópiu Pyodide mimo hlavného release ZIPu.
- Pridaný stručný odkaz `docs/VENDOR_PYODIDE.md`.
- Pridaný `scripts/check-vendor-pyodide.mjs` a npm skript `npm run vendor:check` na kontrolu `vendor/pyodide/v0.25.1/full/`.
- Pridaný `tests/local-pyodide-runtime-smoke.mjs` a npm skript `npm run smoke:local-pyodide`, ktorý overuje lokálnu `PYODIDE_BASE_URL` cestu cez dočasný mock runtime.
- CI a release workflow spúšťajú aj lokálny Pyodide runtime smoke.
- Release check kontroluje vendor dokumentáciu a nové skripty, ale hlavný ZIP stále nesmie obsahovať dočasné runtime artefakty.
- `CONTENT_VERSION` aktualizovaný na `2026-06-17-student-path-v0.9-vendor-pyodide-deployment`.


## 0.8.0 — PWA hardening and configurable Pyodide runtime

- Zachované správanie v0.7 bez didaktických zmien a bez zásahu do obsahu úloh.
- Pridaný `scripts/check-pwa-cache-manifest.mjs` a `npm run pwa:check`.
- `npm run validate` teraz zahŕňa aj PWA cache manifest check.
- Browser smoke rozšírený o reálny PWA scenár: online first load → service worker ready → cache populated → offline reload → route renders.
- Release ZIP workflow pred balením spúšťa aj `npm run smoke:browser`.
- Simple mode zjednodušuje texty „Stav appky“ a „Stav Pythonu“ pre žiakov.
- Runtime fallback obsahuje žiacku vetu: „Zadanie vidíš, ale Python sa teraz nedá spustiť.“
- Reset v pokročilom režime je rozdelený na „Vymazať môj progres“ a „Vymazať offline cache“.
- Pridané PNG PWA ikony `assets/icon-192.png` a `assets/icon-512.png`.
- Opravené a prečíslované `docs/RELEASE_CHECKLIST.md`.
- Pridaná teacher smoke card pre online test, offline shell test a CDN blocked fallback.
- Implementovaný `PYODIDE_BASE_URL` prepínač: default CDN, query parameter, `window.FIXIT_PYODIDE_BASE_URL` alebo `localStorage['fixit.pyodide.baseUrl']`.
- Pridaná dokumentácia `docs/PYODIDE_RUNTIME.md` a manuálny checklist `tests/MANUAL_SMOKE_TEST_FIXIT_V08.md`.
- `CONTENT_VERSION` aktualizovaný na `2026-06-17-student-path-v0.8-pwa-hardening-pyodide-base-url`.

## 0.7.0 — PWA/offline shell preparation

- Zachované správanie v0.6 bez didaktických zmien a bez zásahu do obsahu úloh.
- Pridaný `manifest.webmanifest` pre standalone PWA metadata.
- Pridaný `sw.js` service worker pre offline shell: app shell, JS/CSS moduly, trasy a lokálne JSON úlohy.
- Pridaný header panel „Offline shell“ cez `src/pwa-offline.js`.
- Pridaný task-level „Python runtime“ status panel cez `src/runtime-status.js`.
- Pyodide CDN ostáva zámerne network-only; celý Pyodide runtime sa vo v0.7 ešte lokálne nebalí.
- Pridané zrozumiteľné fallback správy pri zlyhaní Pyodide/CDN alebo offline režime.
- Browser smoke rozšírený o PWA manifest/offline shell metadata kontrolu.
- Pridaná dokumentácia `docs/PWA_OFFLINE.md` a manuálny checklist `tests/MANUAL_SMOKE_TEST_FIXIT_V07.md`.
- Release ZIP a release check rozšírené o `manifest.webmanifest`, `sw.js` a `assets/icon.svg`.
- `CONTENT_VERSION` aktualizovaný na `2026-06-17-student-path-v0.7-pwa-offline-shell`.

## 0.6.0 — GitHub release readiness

- Zachované správanie v0.5 bez didaktických zmien a bez zásahu do obsahu úloh.
- Pridaný GitHub Actions CI workflow `.github/workflows/ci.yml` pre validate/audit/module smoke/browser smoke/release check.
- Pridaný workflow `.github/workflows/release-zip.yml` na vytvorenie release ZIP artefaktu.
- Pridaný release package check `npm run release:check`, ktorý overuje povinné súbory a zakázané artefakty.
- Pridaný release ZIP builder `npm run release:zip`.
- Pridaná dokumentácia `docs/CHROMIUM_BROWSER_SMOKE.md` pre `CHROMIUM_BIN`, CI Chromium setup a managed policy fallback.
- Pridaný voliteľný Playwright fallback `npm run smoke:browser:playwright`.
- Pridaný manuálny smoke checklist `tests/MANUAL_SMOKE_TEST_FIXIT_V06.md`.
- Aktualizované `README.md`, `PRIVACY.md`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/GITHUB_PAGES.md`, `docs/RELEASE_CHECKLIST.md` a `docs/MODULAR_ARCHITECTURE.md` z pohľadu verejného repozitára.
- `CONTENT_VERSION` aktualizovaný na `2026-06-17-student-path-v0.6-github-release-ready`.

## 0.5.0 — browser smoke and release readiness

- Zachované správanie v0.4 bez didaktických zmien a bez zásahu do obsahu úloh.
- `tests/browser-smoke.mjs` rozšírený z render-only testu na robustnejší smoke test kritických tokov.
- Browser smoke teraz overuje:
  - domovskú obrazovku trás,
  - route mode a jednoduchý režim,
  - free-practice mode a mapu úloh,
  - Predict lock flow bez spúšťania Pyodide,
  - Fix buggy-solution flow,
  - oddelenie anonymného teacher summary od súkromnej zálohy,
  - základný PASS mikroobhajobový flow cez simulovaný lokálny stav.
- Testy sú pripravené pre štandardný lokálny/CI Chromium cez Chrome DevTools Protocol.
- V prostredí so spravovanou Chromium politikou `URLBlocklist=*` sa browser smoke korektne preskočí s jasným dôvodom.
- Pridaný manuálny smoke checklist `tests/MANUAL_SMOKE_TEST_FIXIT_V05.md`.
- `npm run smoke:manual` teraz tlačí najnovší dostupný manuálny smoke checklist.
- `CONTENT_VERSION` aktualizovaný na `2026-06-17-student-path-v0.5-browser-smoke-release`.

## 0.4.0 — task renderer split

- Zachované správanie v0.3 bez zámernej zmeny didaktiky alebo obsahu úloh.
- `src/task-renderer.js` ďalej rozdelený na menšie moduly pre skladanie obrazovky úlohy.
- Pridané moduly:
  - `src/task-header-context-panel.js` — hlavička úlohy, route context, mikroobhajobový kontext,
  - `src/problem-navigation.js` — prepínanie úloh, levelov a route/free-practice navigácia,
  - `src/editor-panel.js` — editor, draft autosave, stdin panel a odsadzovanie Tab/Shift+Tab,
  - `src/predict-fix-panel.js` — Predict panel, Fix panel, výber chybného riešenia a Predict lock state,
  - `src/test-action-handlers.js` — Run/Testy handlery, report testov a status refresh,
  - `src/diagnostic-hints.js` — diagnostické hinty z posledného behu/testu.
- `src/task-renderer.js` teraz zostáva kompozícia obrazovky a wiring modulov, nie monolitická implementácia všetkých panelov.
- `CONTENT_VERSION` aktualizovaný na `2026-06-17-student-path-v0.4-task-renderer-split`.
- Module smoke rozšírený na 16 modulov.
- Pridaný manuálny smoke checklist `tests/MANUAL_SMOKE_TEST_FIXIT_V04.md`.

## 0.3.0 — modular standalone refactor

- FixIt je ďalej vedený ako samostatná žiacka appka; Teacher Companion nie je súčasťou tejto dávky.
- `app.js` zmenšený na boot/orchestrátor.
- Pridané moduly pre route rendering, task rendering, runner client, test engine, diagnostics, microdefense, map UI a export/backup.
- Zachované správanie v0.2 bez zámernej zmeny didaktiky alebo obsahu úloh.
- `CONTENT_VERSION` aktualizovaný na `2026-06-16-student-path-v0.3-modular`.
- Pridaný headless browser smoke test `npm run smoke:browser`.
- Pridaný manuálny smoke checklist `tests/MANUAL_SMOKE_TEST_FIXIT_V03.md`.
- Pridaná dokumentácia `docs/MODULAR_ARCHITECTURE.md`.

## 0.2.0 — classroom pilot cleanup

- Preusporiadané žiacke akcie: hlavná lišta obsahuje iba Run, Testy, Poraď mi.
- Oddelené anonymné zhrnutie pre učiteľa od súkromnej zálohy žiaka.
- Import je určený iba pre súkromnú zálohu; anonymný summary export sa zámerne nedá importovať ako práca.
- Pridaný jednoduchý režim cez `?simple=1`.
- Úlohy v mape sú prístupnejšie ako `button` prvky.
- Posilnená Y2 bridge trasa cez úlohovníkovú doménu: `add_task`, `toggle_task`, `render_task_count`.
- Pridané Y2 úlohy `L7-P29 Predict-state` a `L7-F30 Fix-state`.
- Jazyk „UI Mindset“ nahradený jazykom dramaturgie: stavová funkcia, zmena stavu, render zo stavu, bez input/print.
- Pridané učiteľské kartičky ku trasám.
- Doplnené GitHub publikačné súbory: README, LICENSE, PRIVACY, SECURITY, CONTRIBUTING, package.json, .gitignore.
- Presunuté historické patch notes do `docs/dev-history/`.
- Začatá bezpečná modularizácia: spoločné utility sú v `src/utils.js`.

## 0.1.0 — student path prototype

- Kurátorské trasy nad pôvodným FixIt jadrom.
- Mikroobhajoba po prejdení testov.
- Rozlíšenie „TESTY PREŠLI“ a „VYSVETLENÉ“.
- Anonymný summary export bez mena, kódu a stdin.
- Namespace `fixit.student.v3` pre lokálne dáta.
