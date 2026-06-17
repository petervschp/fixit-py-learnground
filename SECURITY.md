# Security

FixIt Student Path spúšťa žiacky Python kód v prehliadači cez Pyodide Web Worker. Ide o školský tréningový nástroj, nie o bezpečnostný sandbox pre nedôveryhodný kód.

## Model rizika

- Kód beží vo Web Workeri, nie priamo v DOM hlavného vlákna.
- Pri timeoute sa worker ukončí a vytvorí sa znovu.
- AST a regex kontroly sú didaktické obmedzenia, nie bezpečnostná hranica.
- Projekt nemá serverovú časť, účty ani cloudový zber progresu.
- Browser smoke testy nespúšťajú Pyodide; overujú UI toky a privacy model exportu.

## Známe riziká

- Nekonečné cykly alebo veľké výpočty môžu dočasne zaťažiť prehliadač.
- Pyodide sa predvolene načítava cez CDN, prípadne cez voliteľnú `PYODIDE_BASE_URL` cestu, čo môže zlyhať v školskej sieti, pri výpadku internetu alebo pri chybne nastavenej lokálnej runtime ceste. V0.8 service worker cacheuje app shell a zadania, nie celý Pyodide runtime.
- Školská sieť môže blokovať CDN, Web Worker alebo GitHub Pages.
- Súkromná záloha obsahuje kód a stdin; treba ju považovať za súkromný súbor žiaka.
- Import JSON je určený len pre vlastné súkromné zálohy, nie pre neznáme súbory z internetu.
- `CHROMIUM_BIN` v CI alebo lokálnom teste má smerovať na dôveryhodnú inštaláciu Chromium/Chrome.

## Service worker

Service worker vo v0.8 cacheuje iba statické súbory aplikácie, lokálne JS/CSS, trasy a JSON úlohy. Nie je to bezpečnostná hranica a nerobí zo spúšťania žiackeho Python kódu bezpečný sandbox. Externé Pyodide CDN požiadavky sú zámerne network-only. Ak škola použije lokálnu `PYODIDE_BASE_URL` cestu v rovnakom origine, jej runtime súbory treba spravovať a testovať samostatne; hlavný ZIP ich stále neobsahuje.

## Browser smoke a CI

Pred release odporúčame:

```bash
npm run validate
npm run audit
npm run smoke:modules
npm run pwa:check
npm run smoke:browser
npm run release:check
```

Ak sa Chromium nenájde automaticky, nastav:

```bash
CHROMIUM_BIN=/usr/bin/chromium npm run smoke:browser
```

Podrobnosti sú v `docs/CHROMIUM_BROWSER_SMOKE.md`.

## Hlásenie problémov

Pri verejnom repozitári otvorte GitHub issue s popisom chyby, krokmi reprodukcie, prehliadačom a operačným systémom. Neprikladajte exporty so žiackymi osobnými údajmi.

Pri bezpečnostnom probléme priložte minimálny reprodukčný príklad bez žiackych dát.

## Školské odporúčanie

Pred hodinou urobte smoke test:

```bash
python -m http.server 8000
```

Potom otestujte aspoň jednu L1 úlohu, jednu Fix úlohu, jednu Predict úlohu a jednu L7 function úlohu.


## Lokálny Pyodide vendor runtime

V0.9 umožňuje škole použiť lokálnu runtime cestu napríklad `vendor/pyodide/v0.25.1/full/` cez `PYODIDE_BASE_URL`. Táto cesta musí byť dôveryhodná a spravovaná školou. Nevkladaj do nej neznáme alebo upravené runtime súbory bez kontroly pôvodu. Over štruktúru cez `npm run vendor:check` a správanie cez `npm run smoke:local-pyodide`.

Lokálny vendor runtime nemení bezpečnostný model: žiacky Python kód je stále arbitrážny kód bežiaci v Pyodide/Web Workeri a nejde o bezpečnostný sandbox pre nedôveryhodný útočný kód.
