# Manual smoke test — FixIt Student Path v0.10

V0.10 nemení didaktiku ani obsah úloh oproti v0.9. Testuje žiacku UX čitateľnosť po pilotnom testovaní: výrazný assignment panel, tvrdší jednoduchý režim a spoľahlivé prepínanie simple/full.

## 1. Štart appky

```bash
python3 -m http.server 8000
```

Otvoriť:

```text
http://localhost:8000/
```

Over:

- zobrazí sa **Moje trasy**,
- appka nepadá,
- header PWA/offline status je viditeľný.

## 2. Jednoduchý režim z URL

Otvoriť:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026&simple=1
```

Over:

- `body` má triedu `mode-simple`,
- nad editorom je výrazný panel **TVOJA ÚLOHA**,
- zadanie je čitateľné pred editorom,
- export, backup, import, reset a mapa úloh nie sú v hlavnom žiackom pohľade,
- vidíš hlavne zadanie, editor, Run/Testy/Poraď mi, Output/Testy a mikroobhajobu.

## 3. Plný režim z URL

Otvoriť:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-026&simple=0
```

Over:

- `body` má triedu `mode-full`,
- panel **TVOJA ÚLOHA** ostáva výrazný,
- zobrazujú sa exporty, súkromná záloha, mapa úloh a pokročilé panely.

## 4. Prepínač režimu bez reloadu

Na obrazovke úlohy klikni:

```text
Prepnúť na jednoduchý režim / Prepnúť na plný režim
```

Over:

- režim sa zmení okamžite bez ručného refreshu,
- URL sa zmení na `simple=1` alebo `simple=0`,
- `body` trieda sa zmení na `mode-simple` alebo `mode-full`,
- jednoduchý režim naozaj skryje pokročilé prvky.

## 5. Navigácia bez straty režimu

V jednoduchom režime klikni na ďalšiu alebo predchádzajúcu úlohu.

Over:

- URL stále obsahuje `simple=1`,
- `body` stále má `mode-simple`,
- assignment panel **TVOJA ÚLOHA** je stále hore nad editorom.

## 6. Query parameter má prioritu pred localStorage

1. Zapni jednoduchý režim.
2. Otvor ručne URL so `simple=0`.

Over:

- appka sa otvorí v plnom režime aj vtedy, keď bol predtým uložený simple mode.

## 7. Základný runtime smoke

Otvoriť:

```text
http://localhost:8000/?level=1&problem=L1-001&simple=1
```

Over:

- zadanie je výrazné,
- Run/Testy sa dajú spustiť, ak je Pyodide runtime dostupný,
- pri zlyhaní runtime je správa zrozumiteľná pre žiaka.
