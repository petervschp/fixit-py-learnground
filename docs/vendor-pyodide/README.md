# Vendor Pyodide runtime — školský deployment mimo hlavného ZIPu

FixIt Student Path v0.9 **neobsahuje celý Pyodide runtime v hlavnom release ZIPe**. Hlavný ZIP je malý, vhodný pre GitHub Pages a používa defaultne CDN. Škola si však môže pripraviť voliteľnú lokálnu runtime kópiu mimo hlavného ZIPu.

Odporúčaná cesta pre školský server:

```text
vendor/pyodide/v0.25.1/full/
```

FixIt potom otvoríš napríklad takto:

```text
http://localhost:8000/index.html?pyodideBaseUrl=./vendor/pyodide/v0.25.1/full/
```

Alebo nastavíš v prehliadači:

```js
localStorage.setItem("fixit.pyodide.baseUrl", "./vendor/pyodide/v0.25.1/full/");
```

## Rozdiel medzi hlavnou appkou a vendor runtime balíkom

| Balík | Obsahuje | Určenie |
|---|---|---|
| hlavný FixIt release ZIP | app shell, JS/CSS, trasy, JSON úlohy, service worker, testy, dokumentácia | bežné spustenie, GitHub Pages, CDN režim |
| voliteľný školský Pyodide vendor balík | `pyodide.js`, `.wasm`, `python_stdlib.zip`, lock/metadata súbory a balíčky Pyodide | školské siete, kde CDN zlyháva alebo je blokované |

Hlavný ZIP sa má dať publikovať bez veľkého runtime. Vendor runtime je školský deployment artefakt, ktorý si pripravuje škola alebo správca siete.

## Ako pripraviť lokálny Pyodide runtime

1. Stiahni Pyodide verzie `0.25.1` z oficiálneho release alebo NPM balíka `pyodide`.
2. Skopíruj obsah priečinka `full/` do:

```text
vendor/pyodide/v0.25.1/full/
```

3. Over, že cesta obsahuje minimálne:

```text
vendor/pyodide/v0.25.1/full/pyodide.js
vendor/pyodide/v0.25.1/full/pyodide.asm.wasm
vendor/pyodide/v0.25.1/full/python_stdlib.zip
vendor/pyodide/v0.25.1/full/pyodide-lock.json
```

4. Spusti kontrolu:

```bash
npm run vendor:check
```

5. Spusti lokálny runtime smoke:

```bash
npm run smoke:local-pyodide
```

6. Otvor appku s lokálnou runtime cestou:

```text
http://localhost:8000/index.html?pyodideBaseUrl=./vendor/pyodide/v0.25.1/full/
```

## Kontrolný skript

```bash
npm run vendor:check
```

Kontroluje predvolenú cestu `vendor/pyodide/v0.25.1/full/`.

Voliteľne môžeš určiť inú cestu:

```bash
node scripts/check-vendor-pyodide.mjs ./moja/cesta/full/
```

Skript kontroluje štruktúru a základné súbory. Neznamená to ešte, že runtime určite prejde na každom školskom zariadení; preto treba spustiť aj browser smoke a manuálny smoke pred hodinou.

## Runtime smoke bez veľkého vendor balíka

```bash
npm run smoke:local-pyodide
```

Tento test vytvorí dočasný **mock Pyodide runtime** v `.tmp-local-pyodide-runtime/` a overí, že appka vie použiť lokálnu `PYODIDE_BASE_URL` cestu cez Web Worker. Neoveruje skutočný Pyodide `.wasm` výkon. Overuje konfiguračnú cestu, worker komunikáciu a základný runtime status.

Skutočný školský vendor runtime overíš kombináciou:

```bash
npm run vendor:check
python -m http.server 8000
# potom manuálne otvor URL s ?pyodideBaseUrl=./vendor/pyodide/v0.25.1/full/
```

## Service worker a cache

Service worker cacheuje app shell a lokálne JSON úlohy. V0.9 hlavný service worker **nepredpokladá**, že vendor Pyodide je súčasť hlavného ZIPu. Ak škola používa lokálny runtime, prehliadač môže súbory cacheovať podľa bežných HTTP cache pravidiel, ale FixIt zatiaľ negarantuje plne offline Python runtime.

## Školské odporúčanie

Pred hodinou sprav tri testy:

1. CDN režim: otvor appku bez `pyodideBaseUrl` a spusti jednu L1 úlohu.
2. Lokálny režim: otvor appku s `?pyodideBaseUrl=./vendor/pyodide/v0.25.1/full/` a spusti L7 funkčnú úlohu.
3. Fallback: odpoj internet alebo zablokuj CDN a over, že žiak vidí zrozumiteľnú správu namiesto tichej chyby.
