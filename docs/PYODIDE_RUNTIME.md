# Pyodide runtime deployment — FixIt Student Path v0.9

FixIt v0.9 stále nebalí celý Pyodide runtime do hlavného ZIPu. Run/Testy používajú Pyodide podľa nastavenej runtime base URL.

## Variant A — default CDN

Predvolená hodnota:

```text
https://cdn.jsdelivr.net/pyodide/v0.25.1/full/
```

Výhody:

- najmenší release ZIP,
- jednoduché GitHub Pages nasadenie,
- bez lokálneho kopírovania veľkých runtime súborov.

Riziká:

- prvé Run/Testy potrebujú internet,
- školská sieť môže blokovať CDN,
- slabšie zariadenia môžu prvé načítanie cítiť ako pomalé.

## Variant B — voliteľná lokálna kópia mimo hlavného ZIPu

Škola môže pripraviť lokálnu kópiu Pyodide mimo hlavného FixIt ZIPu, napríklad:

```text
vendor/pyodide/v0.25.1/full/
```

Táto cesta musí obsahovať `pyodide.js` a súvisiace `.wasm`, `.data`, `.json` a ďalšie runtime súbory danej Pyodide verzie.

FixIt potom otvoríš napríklad takto:

```text
http://localhost:8000/index.html?pyodideBaseUrl=./vendor/pyodide/v0.25.1/full/
```

Alebo nastavíš pred načítaním appky:

```html
<script>
  window.FIXIT_PYODIDE_BASE_URL = "./vendor/pyodide/v0.25.1/full/";
</script>
```

Prípadne pre konkrétny prehliadač:

```js
localStorage.setItem("fixit.pyodide.baseUrl", "./vendor/pyodide/v0.25.1/full/");
```

## Pravidlá

- Hodnota musí končiť adresárom, ktorý obsahuje `pyodide.js`.
- Ak lomka na konci chýba, appka ju doplní.
- Hlavný release ZIP Pyodide runtime neobsahuje.
- Service worker cacheuje app shell a lokálne zadania, nie externú CDN runtime cestu.
- Lokálny Pyodide deployment treba otestovať pred hodinou cez `tests/MANUAL_SMOKE_TEST_FIXIT_V09.md`, `npm run vendor:check` a `npm run smoke:local-pyodide`.

## Smoke test pre školu

1. Spusti appku cez lokálny server.
2. Otvor trasu `Y2_most_cli_dom`, úlohu `L7-026`.
3. Skús default CDN.
4. Skús `?pyodideBaseUrl=./vendor/pyodide/v0.25.1/full/`.
5. Skús simulované blokovanie CDN.
6. Over, že pri zlyhaní žiak vidí vetu: **Zadanie vidíš, ale Python sa teraz nedá spustiť.**


## Vendor kontrola vo v0.9

V0.9 pridáva dva samostatné kontrolné kroky:

```bash
npm run vendor:check
npm run smoke:local-pyodide
```

`vendor:check` kontroluje reálnu školskú štruktúru `vendor/pyodide/v0.25.1/full/`. Ak vendor runtime nie je prítomný, má zlyhať — hlavný release ZIP ho zámerne neobsahuje.

`smoke:local-pyodide` vytvorí dočasný mock runtime v `.tmp-local-pyodide-runtime/` a overí, že worker a `PYODIDE_BASE_URL` konfigurácia v appke používajú lokálnu cestu. Tento test nesťahuje veľký Pyodide balík a neoveruje výkon skutočného `.wasm` runtime.

Podrobný školský postup je v `docs/vendor-pyodide/README.md`.
