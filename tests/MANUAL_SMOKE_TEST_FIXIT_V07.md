# Manual smoke test — FixIt Student Path v0.7

Tento checklist overuje v0.7 PWA/offline shell vrstvu bez didaktických zmien a bez lokálne pribaleného Pyodide runtime.

## 1. Statické kontroly

```bash
npm run validate
npm run audit
npm run smoke:modules
npm run release:check
```

Očakávanie: všetko prejde bez errors/warnings.

## 2. Lokálne spustenie

```bash
python -m http.server 8000
```

Otvor:

```text
http://localhost:8000/
```

Očakávanie:

- zobrazí sa domovská obrazovka trás,
- v hlavičke je panel „Offline shell“,
- service worker sa zaregistruje alebo zobrazí zrozumiteľnú fallback správu.

## 3. PWA manifest

V DevTools alebo cez browser smoke over:

- `manifest.webmanifest` je dostupný,
- `display` je `standalone`,
- `start_url` je `./index.html`,
- ikona `assets/icon.svg` je dostupná.

## 4. Route mode + runtime panel

Otvor:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026
```

Očakávanie:

- otvorí sa úloha `L7-026 add_task`,
- vidíš panel „Python runtime“,
- pred spustením je stav približne `idle`,
- panel vysvetľuje, že Pyodide sa spúšťa až pri Run/Testy.

## 5. Simple mode

Otvor:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026&simple=1
```

Očakávanie:

- exporty a pokročilé akcie sú skryté,
- runtime panel ostáva viditeľný,
- route navigation a mapa úloh fungujú.

## 6. Offline shell

1. Najprv otvor appku online a počkaj, kým sa v hlavičke objaví offline shell stav.
2. Otvor `?route=Y2_most_cli_dom&problem=L7-026`.
3. V DevTools nastav Network → Offline alebo dočasne vypni sieť.
4. Obnov stránku.

Očakávanie:

- app shell sa načíta,
- trasy a lokálne JSON úlohy sa načítajú,
- zadanie úlohy je čitateľné,
- Run/Testy môžu zlyhať, ale správa musí hovoriť o Pyodide/CDN runtime limite, nie iba „neznáma chyba“.

## 7. Pyodide/CDN fallback

Pri blokovanej sieti alebo CDN stlač Run/Testy.

Očakávanie:

- status nepadne ticho,
- panel „Python runtime“ prejde do stavu `error`, `offline`, `unavailable` alebo `timeout`,
- žiak vidí, že zadania ostávajú dostupné, ale Python Run/Testy potrebujú Pyodide runtime.

## 8. Existujúce toky z v0.6

Over aspoň stručne:

- route home,
- route mode,
- free-practice mode,
- Predict lock flow,
- Fix buggy-solution flow,
- anonymný summary export vs. súkromná záloha,
- PASS mikroobhajoba.

## 9. Release ZIP

```bash
npm run release:zip
unzip -t dist/fixit_student_path_v0_7_0_release.zip
```

Očakávanie:

- ZIP obsahuje `manifest.webmanifest`, `sw.js` a `assets/icon.svg`,
- ZIP neobsahuje `node_modules`, dočasné profily ani súkromné exporty.
