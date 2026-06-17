# Manual smoke test — FixIt Student Path v0.6

Tento checklist je určený pred release ZIPom alebo pred publikovaním na GitHub. Testuje správanie v0.5/v0.6 bez didaktických zmien.

## 0. Spustenie

```bash
npm run validate
npm run audit
npm run smoke:modules
npm run release:check
python -m http.server 8000
```

Otvor:

```text
http://localhost:8000/
```

## 1. Domovská obrazovka trás

Očakávanie:

- vidíš nadpis „Moje trasy“,
- vidíš viacero kariet trás,
- text hovorí, že trasa nie je domáca úloha celá naraz,
- vidíš voľbu voľného precvičovania ako sekundárnu možnosť.

## 2. Route mode a simple mode

Otvor:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026&simple=1
```

Očakávanie:

- otvorí sa úloha `L7-026 add_task`,
- vidíš editor a tlačidlá Run/Testy/Poraď mi,
- nevidíš anonymný export, súkromnú zálohu ani pokročilý reset,
- vidíš poznámku „Jednoduchý režim“.

## 3. Free-practice mode

Otvor:

```text
http://localhost:8000/?level=1&problem=L1-P01
```

Očakávanie:

- vidíš level selector nastavený na 1,
- vidíš mapu úloh,
- kontext jasne hovorí „Voľné precvičovanie“.

## 4. Predict lock flow

Otvor:

```text
http://localhost:8000/?route=Y2_brython_event_render&problem=L7-P29
```

Postup:

1. Do predikcie napíš ľubovoľný odhad.
2. Klikni na uzamknutie odhadu.

Očakávanie:

- predikcia sa uzamkne,
- bežné Testy sú vypnuté,
- stav informuje, že odhad je uzamknutý.

## 5. Fix buggy-solution flow

Otvor:

```text
http://localhost:8000/?route=Y2_brython_event_render&problem=L7-F30
```

Postup:

1. Vyber chybný variant `B2`.
2. Skontroluj editor.

Očakávanie:

- editor sa prepíše vybraným chybným riešením,
- stav informuje, že bolo načítané chybné riešenie.

## 6. Export/backup privacy model

Otvor:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026
```

Očakávanie:

- vidíš samostatnú sekciu pre anonymné odovzdanie učiteľovi,
- vidíš samostatnú pokročilú sekciu so súkromnou zálohou,
- anonymný export je jasne označený ako neimportovateľné odovzdanie,
- súkromná záloha je jasne označená ako súbor, ktorý môže obsahovať kód/stdin.

## 7. PASS mikroobhajoba

Postup:

1. Otvor ľubovoľnú jednoduchú úlohu, ktorá vie prejsť testami.
2. Spusti Testy a nechaj ich prejsť.
3. Po PASS klikni na mikroobhajobu „viem samostatne“.

Očakávanie:

- stav sa zmení z „TESTY PREŠLI“ na „VYSVETLENÉ“,
- appka jasne hovorí, že testy nie sú automatická známka.

## 8. GitHub-ready kontrola

```bash
npm run release:check
npm run release:zip
```

Očakávanie:

- release check prejde,
- vytvorí sa ZIP v `dist/`,
- ZIP neobsahuje `node_modules`, dočasný Chromium profil ani súkromné exporty.
