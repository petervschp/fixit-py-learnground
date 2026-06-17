# Manual smoke test — FixIt Student Path v0.9

V0.9 nemení didaktiku ani obsah úloh oproti v0.8. Testuje PWA shell, default CDN runtime a voliteľný školský lokálny Pyodide runtime mimo hlavného ZIPu.

## 1. Základné spustenie

```bash
python -m http.server 8000
```

Otvor:

```text
http://localhost:8000/
```

Očakávanie:

- zobrazia sa Moje trasy,
- vidíš Offline shell / stav appky,
- aplikácia nežiada účet ani meno.

## 2. Route mode

Otvor:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026&simple=1
```

Očakávanie:

- otvorí sa úloha `L7-026 add_task`,
- v jednoduchom režime sa nezobrazujú exporty ani pokročilé nastavenia,
- runtime panel používa jednoduchý jazyk: Stav Pythonu.

## 3. Default CDN smoke

V úlohe `L7-026` doplň správne riešenie alebo použi inú jednoduchú L1 úlohu a stlač Run/Testy.

Očakávanie:

- Python runtime prejde do stavu pripravený,
- Run/Testy fungujú, ak sieť umožňuje Pyodide CDN.

## 4. Offline shell smoke

1. Otvor appku online.
2. Počkaj, kým service worker/cache prebehne.
3. Vypni sieť alebo v DevTools nastav Offline.
4. Obnov stránku:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026&simple=1
```

Očakávanie:

- trasa a zadanie sa zobrazia zo service worker cache,
- Run/Testy nemusia fungovať, ak Pyodide runtime nie je dostupný,
- žiak vidí zrozumiteľnú vetu: „Zadanie vidíš, ale Python sa teraz nedá spustiť.“

## 5. Vendor Pyodide štruktúra

Ak škola pripravila lokálnu kópiu Pyodide, over ju:

```bash
npm run vendor:check
```

Očakávanie:

- cesta `vendor/pyodide/v0.25.1/full/` existuje,
- obsahuje `pyodide.js`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json`.

Ak vendor runtime ešte nie je pripravený, tento test má zlyhať s vysvetlením. Hlavný release ZIP vendor runtime zámerne neobsahuje.

## 6. Lokálny PYODIDE_BASE_URL smoke

Spusti automatický smoke s dočasným mock runtime:

```bash
npm run smoke:local-pyodide
```

Očakávanie:

- v bežnom Chromium/CI prostredí test vytvorí `.tmp-local-pyodide-runtime/`,
- otvorí appku s lokálnou `pyodideBaseUrl`,
- overí, že worker vie načítať lokálnu runtime cestu,
- po skončení dočasný runtime odstráni.

Ak je Chromium blokované managed policy `URLBlocklist=*`, test sa korektne preskočí.

## 7. Reálny školský lokálny runtime smoke

Ak máš reálny vendor runtime:

```text
http://localhost:8000/index.html?route=Y2_most_cli_dom&problem=L7-026&simple=1&pyodideBaseUrl=./vendor/pyodide/v0.25.1/full/
```

Očakávanie:

- runtime status hovorí, že používa lokálny/vlastný Pyodide runtime,
- Run/Testy fungujú bez kontaktu s CDN,
- pri odpojení internetu ostane app shell dostupný.

## 8. Fallback pri zlej lokálnej ceste

Otvor:

```text
http://localhost:8000/index.html?route=Y2_most_cli_dom&problem=L7-026&simple=1&pyodideBaseUrl=./vendor/neexistuje/full/
```

Stlač Run.

Očakávanie:

- Run zlyhá zrozumiteľne,
- žiak vidí, že zadanie je dostupné, ale Python sa nedá spustiť,
- UI nezamrzne.

## 9. Exporty a súkromie

Over:

- anonymné zhrnutie neobsahuje meno, kód ani stdin,
- súkromná záloha je jasne označená ako súkromná,
- import anonymného zhrnutia sa nepoužíva ako obnova práce.
