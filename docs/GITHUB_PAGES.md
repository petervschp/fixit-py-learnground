# GitHub Pages deployment

FixIt Student Path je statická appka. Dá sa publikovať cez GitHub Pages, ale pre školské použitie stále odporúčame lokálny smoke test.

## Pred nasadením

```bash
npm run validate
npm run audit
npm run smoke:modules
npm run smoke:browser
npm run release:check
```

Ak browser smoke nevie nájsť Chromium, pozri `docs/CHROMIUM_BROWSER_SMOKE.md` a nastav `CHROMIUM_BIN`.

## Postup

1. V repozitári otvor `Settings` → `Pages`.
2. Ako source vyber `Deploy from a branch`.
3. Vyber branch, napríklad `main`, a priečinok `/root`.
4. Po nasadení otvor URL projektu.
5. Otestuj:
   - úvodnú obrazovku `Moje trasy`,
   - `?route=Y2_most_cli_dom`,
   - jednu L1 úlohu,
   - jednu Fix úlohu,
   - jednu Predict úlohu,
   - jednu L7 function úlohu.

## Limity GitHub Pages

- Pyodide CDN musí byť dostupné zo školskej siete.
- Prvé načítanie Python runtime môže byť pomalšie.
- Dáta žiaka sa ukladajú lokálne v prehliadači, nie do GitHubu.
- GitHub Pages môže mať vlastné technické logy prístupov mimo kódu tejto appky.
- Pri zmene domény alebo cesty sa lokálny progres môže javiť ako nový, pretože `localStorage` je viazané na origin.

## Odporúčané verejné označenie

Pri verejnom repozitári použite release text typu:

```text
Classroom pilot prototype. Not an LMS, not a grading system, no accounts, no cloud progress collection.
```

## Release ZIP alternatíva

Ak nechceš používať GitHub Pages, vytvor statický ZIP:

```bash
npm run release:zip
```

Rozbaľ ho na školský server alebo spusti lokálne cez:

```bash
python -m http.server 8000
```


## PWA/offline shell on GitHub Pages

V0.8 registers `sw.js` from the repository root/scope. On GitHub Pages, open the app once online so the service worker can cache the app shell, local JS/CSS, `student_routes.json` and `problems/*.json`. Pyodide still loads from CDN for Run/Testy; the offline shell does not make Python execution fully offline.


## Pyodide runtime base URL

Default GitHub Pages deployment uses Pyodide CDN. Schools that mirror Pyodide locally can use `?pyodideBaseUrl=...`, `window.FIXIT_PYODIDE_BASE_URL`, or `localStorage['fixit.pyodide.baseUrl']`. See `docs/PYODIDE_RUNTIME.md`.


## Voliteľný lokálny Pyodide runtime

GitHub Pages deployment používa defaultne CDN. Ak škola potrebuje lokálnu kópiu runtime, odporúčaný deployment je mimo hlavného release ZIPu v `vendor/pyodide/v0.25.1/full/` a appka sa otvorí s `?pyodideBaseUrl=./vendor/pyodide/v0.25.1/full/`. Podrobnosti sú v `docs/vendor-pyodide/README.md`.
