# FixIt Student Path

FixIt Student Path je samostatná lokálna žiacka tréningová appka pre krátke Python bloky v dvojročnom kurze informatiky Y1/Y2.

Nie je to LMS, známkovací systém ani hlavná dramaturgia kurzu. Hlavná línia ostáva mimo appky:

```text
stav → funkcie → CLI úlohovník → Y2 stav / akcia / render / localStorage
```

FixIt slúži ako kurátorsky riadená podpora učenia: krátke trasy, Fix/Predict úlohy, funkcie bez `input()`/`print()`, mikroobhajoba porozumenia a anonymný export bez osobných údajov.

## Stav projektu

Aktuálna verzia: **0.9.0 — školský lokálny Pyodide deployment mimo hlavného ZIPu**.

V0.9 nemení didaktiku ani obsah úloh oproti v0.8. Dopĺňa školský deployment lokálneho Pyodide runtime mimo hlavného ZIPu:

- `manifest.webmanifest`,
- `sw.js` service worker pre app shell, moduly, trasy a lokálne JSON úlohy,
- runtime status panel pre Pyodide,
- fallback správy pri zlyhaní Pyodide/CDN alebo lokálnej runtime cesty,
- automatický browser smoke pre online first load → offline reload zo service worker cache,
- `scripts/check-pwa-cache-manifest.mjs`, ktorý kontroluje, či service worker cacheuje všetky lokálne moduly a úlohy,
- `PYODIDE_BASE_URL` prepínač: default CDN alebo školská lokálna kópia runtime mimo hlavného ZIPu,
- dokumentáciu limitov: offline shell áno, plne offline Python runtime nie je súčasťou hlavného ZIPu,
- v0.9 manuálny smoke checklist,
- dokumentovaný `vendor/pyodide/v0.25.1/full/` postup,
- `npm run vendor:check`,
- `npm run smoke:local-pyodide` pre overenie lokálnej `PYODIDE_BASE_URL` cesty cez dočasný mock runtime.

## Čo appka robí

- poskytuje krátke žiacke trasy podľa fázy kurzu,
- spúšťa Python v prehliadači cez Pyodide Web Worker,
- podporuje úlohy typu Solve, Fix, Predict a function-return,
- odlišuje „testy prešli“ od „viem vysvetliť“,
- ukladá progres lokálne v prehliadači,
- umožňuje anonymné zhrnutie pre učiteľa bez mena, kódu a stdin,
- umožňuje súkromnú zálohu práce žiaka,
- pripravuje offline shell pre appku, trasy a lokálne JSON úlohy.

## Čo appka nerobí

- nezbiera účty ani mená,
- neposiela žiacky progres do cloudu,
- neznámkuje automaticky,
- nenahrádza CLI úlohovník ani Y2 web/PWA projekt,
- negarantuje porozumenie iba tým, že testy prešli,
- hlavný ZIP ešte nebalí celý Pyodide runtime lokálne; Run/Testy používajú Pyodide cez CDN alebo cez voliteľnú `PYODIDE_BASE_URL` cestu.

## Spustenie lokálne

V koreňovom priečinku spusti jednoduchý HTTP server:

```bash
python -m http.server 8000
```

Otvor:

```text
http://localhost:8000/
```

Dôležité: neotváraj `index.html` priamo cez `file://`, pretože prehliadač môže blokovať `fetch()` pre JSON súbory, worker a service worker. Offline shell funguje cez `localhost` alebo HTTPS.

## Rýchle odkazy

```text
http://localhost:8000/?route=Y2_most_cli_dom
http://localhost:8000/?route=Y2_most_cli_dom&simple=1
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-028
http://localhost:8000/?level=7&problem=L7-028
```

## Režimy použitia

### Kurátorské trasy

Hlavný vstup pre žiaka. Učiteľ vyberá trasu podľa fázy hodiny. Trasa nie je povinná domáca úloha celá naraz; typicky sa vyberá 2–5 úloh.

### Jednoduchý režim

Pridaj `&simple=1` do URL. Režim skrýva odovzdanie, zálohy, import a pokročilé akcie. Je vhodný pre slabších žiakov alebo krátky riadený blok.

### Voľné precvičovanie

Sekundárny režim cez levely. Má slúžiť ako rezerva, diagnostika alebo diferenciácia, nie ako hlavná dramaturgia kurzu.


## Pyodide runtime cesta

Default ostáva Pyodide cez CDN:

```text
https://cdn.jsdelivr.net/pyodide/v0.25.1/full/
```

Škola môže voliteľne pripraviť lokálnu kópiu runtime mimo hlavného ZIPu a otvoriť appku napríklad cez:

```text
http://localhost:8000/index.html?pyodideBaseUrl=./vendor/pyodide/v0.25.1/full/
```

Alternatívne sa dá nastaviť `window.FIXIT_PYODIDE_BASE_URL` alebo `localStorage['fixit.pyodide.baseUrl']`. Hlavný release ZIP Pyodide runtime stále neobsahuje. Detaily sú v `docs/PYODIDE_RUNTIME.md` a `docs/vendor-pyodide/README.md`.

## Školský lokálny Pyodide vendor balík

Hlavný release ZIP a voliteľný školský Pyodide runtime sú zámerne oddelené:

```text
fixit_student_path_v0_9_...zip          # appka, trasy, úlohy, service worker, testy
vendor/pyodide/v0.25.1/full/           # voliteľný veľký runtime mimo hlavného ZIPu
```

Štruktúru vendor runtime overíš cez:

```bash
npm run vendor:check
```

Konfiguračnú cestu `PYODIDE_BASE_URL` cez Web Worker overíš bez veľkého runtime balíka cez:

```bash
npm run smoke:local-pyodide
```

Podrobný školský postup je v `docs/vendor-pyodide/README.md`.

## Exporty

### Anonymné zhrnutie pre učiteľa

Neobsahuje meno, rozpracovaný kód, stdin ani voľný text. Slúži ako anonymná reflexia alebo pracovný dôkaz, nie ako automatická známka.

### Moja súkromná záloha

Obsahuje lokálny stav vrátane rozpracovaného kódu a stdin. Je určená iba pre žiaka na prenos alebo obnovu práce. Nemá sa odovzdávať ako anonymný export.

## Validácia a testy

```bash
npm run validate
npm run audit
npm run smoke:modules
npm run pwa:check
npm run smoke:browser
npm run smoke:local-pyodide
npm run release:check
```

`npm run smoke:browser` používa Chromium cez Chrome DevTools Protocol. Keď sa Chromium nenájde automaticky, nastav `CHROMIUM_BIN`:

```bash
CHROMIUM_BIN=/usr/bin/chromium npm run smoke:browser
CHROMIUM_BIN=/usr/bin/google-chrome-stable npm run smoke:browser
```

Viac v `docs/CHROMIUM_BROWSER_SMOKE.md`.

## Voliteľný Playwright fallback

Projekt Playwright nevyžaduje. Ak ho máš v lokálnom alebo CI prostredí, môžeš spustiť alternatívny browser smoke:

```bash
npm install -D playwright
npx playwright install chromium
npm run smoke:browser:playwright
```

Ak Playwright nie je nainštalovaný, fallback sa korektne preskočí s vysvetlením.

## Manuálny smoke test

```bash
npm run smoke:manual
```

Aktuálny checklist je v `tests/MANUAL_SMOKE_TEST_FIXIT_V09.md`.

## GitHub Actions

Repozitár obsahuje:

```text
.github/workflows/ci.yml
.github/workflows/release-zip.yml
```

CI workflow spúšťa:

- `npm run validate`,
- `npm run audit`,
- `npm run smoke:modules`,
- `npm run smoke:browser`,
- `npm run smoke:local-pyodide`,
- `npm run release:check`.

Release ZIP workflow pred balením spustí aj `npm run smoke:browser` a potom vytvorí ZIP artefakt z GitHub-ready súborov bez `node_modules`, dočasných browser profilov a súkromných exportov.

## Release ZIP

Lokálne:

```bash
npm run release:check
npm run release:zip
```

Výstup sa vytvorí v `dist/`.

## Technická štruktúra v0.9

`app.js` je boot/orchestrátor. Od v0.4 je `src/task-renderer.js` rozdelený na menšie panely: task header/context, problem navigation, editor, Predict/Fix panel, Run/Test handlery, diagnostické hinty, microdefense, map UI a export/backup. V0.5 posilnilo browser smoke testy. V0.6 pridáva release štruktúru, CI workflow a dokumentovaný browser-test setup. V0.7 pridáva PWA/offline shell, runtime status panel a dokumentované Pyodide/CDN fallback správy. V0.8 pridáva PWA cache manifest check, automatický offline reload browser smoke, jednoduchšie žiacke fallback texty, oddelený reset progresu/cache a `PYODIDE_BASE_URL` prepínač. V0.9 dopĺňa školský vendor Pyodide deployment mimo hlavného ZIPu, kontrolu vendor štruktúry a lokálny runtime smoke cez dočasný mock runtime. Podrobnosti sú v `docs/MODULAR_ARCHITECTURE.md` a `docs/PWA_OFFLINE.md`.

## Školské technické riziká

Appka používa Pyodide cez CDN. Prvé načítanie potrebuje internet a školská sieť môže CDN alebo Web Worker blokovať. Pred hodinou treba urobiť smoke test. Pri zlyhaní runtime použi papierové trasovanie alebo pracovný list.


## PWA/offline shell

V0.9 cacheuje app shell, JS/CSS, trasy, ikony a lokálne JSON úlohy cez service worker. Toto pomáha pri čítaní zadaní a práci so žiackym lokálnym stavom po prvom online načítaní. Offline shell však neznamená offline Python runtime: Run/Testy stále potrebujú Pyodide cez CDN alebo cez voliteľnú lokálnu `PYODIDE_BASE_URL` cestu. Detaily sú v `docs/PWA_OFFLINE.md` a `docs/PYODIDE_RUNTIME.md`.
