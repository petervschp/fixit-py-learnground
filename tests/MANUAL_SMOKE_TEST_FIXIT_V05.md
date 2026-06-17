# Manual smoke test — FixIt Student Path v0.5

Tento checklist overuje rovnaké kritické toky ako `npm run smoke:browser`. Použi ho, ak headless Chromium v prostredí nie je dostupný alebo je blokovaný spravovanou politikou.

## Príprava

```bash
npm run validate
npm run audit
npm run smoke:modules
python -m http.server 8000
```

Otvor `http://localhost:8000/` v bežnom prehliadači.

## 1. Domovská obrazovka trás

- Zobrazí sa nadpis `Moje trasy`.
- Vidno aspoň 8 kariet trás.
- Text upozorňuje, že trasa nie je domáca úloha celá naraz.
- Tlačidlo/odkaz `Voľné precvičovanie` je dostupné.

## 2. Route mode + jednoduchý režim

Otvor:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026&simple=1
```

Skontroluj:

- načíta sa úloha `L7-026` / `add_task`,
- existujú tlačidlá `Run`, `Testy`, `Poraď mi`,
- zobrazí sa poznámka `Jednoduchý režim`,
- nevidno anonymný export, súkromnú zálohu, import ani reset aplikácie.

## 3. Voľné precvičovanie

Otvor:

```text
http://localhost:8000/?level=1&problem=L1-P01
```

Skontroluj:

- existuje výber levelu,
- existuje výber úlohy,
- zobrazí sa mapa úloh,
- úlohy v mape sú ovládateľné ako tlačidlá.

## 4. Predict lock flow

Otvor:

```text
http://localhost:8000/?route=Y2_brython_event_render&problem=L7-P29
```

Postup:

1. Do poľa `Môj odhad výstupu` napíš:

   ```text
   True
   2
   ```

2. Klikni `Uzamkni odhad`.
3. Skontroluj, že pole je zamknuté a status hovorí `Odhad uzamknutý`.
4. Skontroluj, že tlačidlo `Testy` je v Predict režime vypnuté.

## 5. Fix buggy-solution flow

Otvor:

```text
http://localhost:8000/?route=Y2_brython_event_render&problem=L7-F30
```

Postup:

1. Skontroluj, že existuje výber `Chybné riešenie`.
2. Vyber druhú chybnú variantu.
3. Skontroluj, že editor sa prepísal na zvolený chybný kód.
4. Status má povedať, že bolo načítané chybné riešenie.

## 6. Export/backup privacy model

Otvor:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026
```

Skontroluj:

- `Odovzdať učiteľovi anonymné zhrnutie` je samostatná sekcia,
- `Pokročilé: moja súkromná záloha, import, reset` je oddelená sekcia,
- anonymné zhrnutie hovorí, že neobsahuje meno, kód, stdin ani voľný text,
- súkromná záloha jasne upozorňuje, že môže obsahovať kód a stdin a nemá sa odovzdávať učiteľovi.

## 7. PASS mikroobhajoba

Tento krok vyžaduje funkčný Pyodide runtime, alebo môže byť overený headless testom cez simulovaný lokálny stav.

Manuálny postup s runtime:

1. Otvor jednoduchú úlohu, ktorú vieš vyriešiť, napríklad `?level=1&problem=L1-001`.
2. Doplň správny kód.
3. Klikni `Testy` a počkaj na `PASS`.
4. Skontroluj, že mikroobhajobové tlačidlá sa odomkli.
5. Klikni `viem samostatne`.
6. Skontroluj, že sa zobrazí badge `VYSVETLENÉ`.

## 8. Headless CI test

V bežnom lokálnom alebo CI Chromium prostredí má prejsť:

```bash
npm run smoke:browser
```

Test v0.5 overuje bez potreby Pyodide/CDN tieto toky:

- route home,
- route mode,
- free-practice mode,
- Predict lock flow,
- Fix buggy-solution flow,
- anonymný summary vs. private backup privacy model,
- PASS mikroobhajobu cez simulovaný lokálny stav.

Ak je Chromium v prostredí spravovaný politikou `URLBlocklist=*`, test sa korektne preskočí a vypíše dôvod.
