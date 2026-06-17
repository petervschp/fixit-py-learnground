# Manual smoke test – FixIt Student Path v0.1

Spusti lokálny server v koreňovom priečinku FixIt:

```bash
python -m http.server 8000
```

Otvor:

```text
http://localhost:8000/
```

## 1. Moje trasy

- Očakávanie: úvodná obrazovka ukáže „Moje trasy“.
- Klikni na trasu `FixIt minimum: prvý kontakt s programom`.
- Očakávanie: URL obsahuje `?route=Y1_start` a selector ukazuje iba úlohy danej trasy.

## 2. Deep link na trasu

Otvor:

```text
http://localhost:8000/?route=Y2_bridge_L7&problem=L7-018
```

- Očakávanie: otvorí sa L7-018 v route režime.
- Vidíš aktívnu trasu, účel a mikroobhajobu.

## 3. Voľné precvičovanie

Otvor:

```text
http://localhost:8000/?level=1&problem=L1-001
```

- Očakávanie: otvorí sa pôvodný level/task režim, ale s textom „Voľné precvičovanie“.

## 4. L1 stdout test

- V L1-001 spusti `Testy` so správnym riešením.
- Očakávanie: zobrazí sa `PASS`, badge `TESTY PREŠLI`, mikroobhajoba sa odomkne.
- Označ `viem samostatne`.
- Očakávanie: badge sa zmení na `VYSVETLENÉ`.

## 5. Predict úloha

Otvor:

```text
http://localhost:8000/?route=Y1_citanie_stav&problem=L1-P02
```

- Zapíš odhad, uzamkni ho a spusti `Run`.
- Očakávanie: pri správnom odhade sa uloží `TESTY PREŠLI` a odomkne sa mikroobhajoba.

## 6. Fix úloha

Otvor:

```text
http://localhost:8000/?route=Y1_start&problem=L1-F01
```

- Vyber chybné riešenie, oprav ho, spusti `Testy`.
- Očakávanie: prvý zlyhaný test dáva diagnostiku; pri oprave prejde.

## 7. L7 function test

Otvor:

```text
http://localhost:8000/?route=Y2_bridge_L7&problem=L7-026
```

- Správne riešenie má vrátiť nový zoznam a nemutovať vstup.
- Očakávanie: fungujú return testy a mutation check.

## 8. Anonymný export

- Klikni `Export anonymný summary`.
- Otvor JSON.
- Očakávanie: JSON obsahuje `type: fixit-anonymous-summary`, `taskStatus`, `summary`, `privacy`.
- Nesmie obsahovať meno, `draftCode`, používateľský kód ani stdin.

## 9. Reset aplikácie

- Klikni `Reset aplikácie`.
- Očakávanie: vymažú sa iba kľúče začínajúce `fixit.`; iné localStorage kľúče na rovnakom origine zostanú.

---

Poznámka: aktuálny checklist pre classroom pilot je `MANUAL_SMOKE_TEST_FIXIT_V02.md`.
