# Manual smoke test — FixIt Student Path v0.10.1

Cieľ: overiť hotfix po pilotnej spätnej väzbe k žiackemu UI, simple/full režimu a čitateľnosti zadania.

## 1. Root → simple mode

1. Spusti appku cez lokálny server: `python -m http.server 8000`.
2. Otvor `http://localhost:8000/index.html?simple=1`.
3. Over:
   - vidíš obrazovku **Moje trasy**,
   - `body` má režim simple vizuálne: pokojnejšie UI, bez učiteľských kartičiek,
   - tlačidlo režimu ponúka prepnutie na plný režim.
4. Klikni na prepínač režimu.
5. Over:
   - zobrazia sa učiteľské kartičky,
   - URL obsahuje `simple=0`,
   - po otvorení `http://localhost:8000/index.html` ostane plný režim podľa uloženého nastavenia.

## 2. Root → späť simple mode

1. Na obrazovke **Moje trasy** klikni znova na prepínač režimu.
2. Over:
   - URL obsahuje `simple=1`,
   - učiteľské kartičky zmiznú,
   - po otvorení `http://localhost:8000/index.html` ostane jednoduchý režim podľa uloženého nastavenia.

## 3. Route → simple mode

1. Otvor `http://localhost:8000/index.html?route=Y2_most_cli_dom&problem=L7-026&simple=1`.
2. Over:
   - nad editorom je výrazný panel **TVOJA ÚLOHA**,
   - v simple mode nie je viditeľný `problemSelect`,
   - navigácia úloh je jednoduchá: predchádzajúca / ďalšia / Moje trasy,
   - export, backup, reset progresu a mapa úloh sú skryté,
   - PWA/offline header je vizuálne stíšený.

## 4. Route → full mode

1. Otvor `http://localhost:8000/index.html?route=Y2_most_cli_dom&problem=L7-026&simple=0`.
2. Over:
   - panel **TVOJA ÚLOHA** ostáva viditeľný,
   - `problemSelect` je dostupný,
   - export/backup/pokročilé prvky sú viditeľné,
   - mapa úloh je viditeľná.

## 5. Task toggle simple/full bez reloadu

1. Na task obrazovke klikni na prepínač režimu.
2. Over:
   - obrazovka sa okamžite prerenderuje,
   - URL sa zmení na `simple=1` alebo `simple=0`,
   - nastavenie sa uloží do `localStorage` pod `fixit.viewMode`,
   - navigácia na ďalšiu úlohu režim nestratí.

## 6. Assignment čitateľnosť

1. Otvor L7 úlohu, napríklad `L7-026`.
2. Over:
   - zadanie je dominantnejšie než route context a runtime status,
   - názvy funkcií a pojmy ako `tasks`, `input()`, `print()` a `return` sú zvýraznené ako inline code,
   - v časti **Čo si máš všimnúť** sú najviac 2 body v simple mode a najviac 3 body v plnom móde.

## 7. Základný runner test

1. Otvor ľahkú úlohu, napríklad `?level=7&problem=L7-001&simple=1`.
2. Spusti Run/Testy.
3. Over:
   - Python runtime panel ukazuje zrozumiteľný stav,
   - pri zlyhaní CDN je jasná fallback správa,
   - pri PASS sa zobrazí mikroobhajoba.
