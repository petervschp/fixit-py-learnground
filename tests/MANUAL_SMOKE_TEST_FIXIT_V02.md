# Manual smoke test – FixIt Student Path v0.2

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
- Karty trás obsahujú učiteľskú kartičku.
- Klikni na trasu `FixIt minimum: prvý kontakt s programom`.
- Očakávanie: URL obsahuje `?route=Y1_start` a selector ukazuje iba úlohy danej trasy.

## 2. Jednoduchý režim

Otvor:

```text
http://localhost:8000/?route=Y2_most_cli_dom&simple=1
```

- Očakávanie: vidíš Run, Testy, Poraď mi.
- Očakávanie: nevidíš anonymné odovzdanie, import, backup ani reset aplikácie.
- Klikni na „Plný režim“.
- Očakávanie: exportné a pokročilé sekcie sú späť.

## 3. Deep link na Y2 bridge

Otvor:

```text
http://localhost:8000/?route=Y2_most_cli_dom&problem=L7-028
```

- Očakávanie: otvorí sa `L7-028 render_task_count` v route režime.
- Vidíš aktívnu trasu, účel a mikroobhajobu.
- Trasa obsahuje v jadre aj `L7-026`, `L7-027`, `L7-028`, `L7-P29`, `L7-F30`.

## 4. L1 stdout test

- Otvor `?level=1&problem=L1-001`.
- Doplň riešenie alebo použi starter, ak je pripravený.
- Klikni `Run`, potom `Testy`.
- Očakávanie: Pyodide sa načíta a testy sa vyhodnotia.

## 5. Predict úloha

- Otvor `?route=Y2_most_cli_dom&problem=L7-P29`.
- Napíš odhad:

```text
True
2
```

- Klikni `Uzamkni odhad` a potom `Run`.
- Očakávanie: odhad prejde a zobrazí sa výzva na mikroobhajobu.

## 6. Fix-state úloha

- Otvor `?route=Y2_most_cli_dom&problem=L7-F30`.
- Skontroluj, že sa zobrazí výber chybného riešenia.
- Oprav riešenie tak, aby neprepísalo pôvodný `tasks`.
- Klikni `Testy`.
- Očakávanie: mutačná kontrola prejde iba pri riešení, ktoré nemení vstupný zoznam.

## 7. Mikroobhajoba a ďalší krok

- Po PASS sa má zobraziť vedenie „Teraz odpovedz na otázku mikroobhajoby“.
- Označ „viem samostatne“.
- Očakávanie: badge sa zmení na `VYSVETLENÉ` a ďalší krok odporučí pokračovať alebo skončiť blok.

## 8. Anonymné zhrnutie vs. súkromná záloha

V plnom režime:

- Klikni `Stiahnuť anonymné zhrnutie`.
- Očakávanie: JSON obsahuje `type: fixit-anonymous-summary` a privacy hodnoty bez kódu.
- V pokročilých klikni `Stiahnuť moju súkromnú zálohu`.
- Očakávanie: JSON obsahuje `type: fixit-private-backup` a upozornenie, že obsahuje kód.
- Skús importovať anonymné zhrnutie.
- Očakávanie: aplikácia odmietne import s vysvetlením, že nejde o súkromnú zálohu.

## 9. Reset

- `Resetovať aktuálnu úlohu` obnoví starter alebo chybné riešenie iba pre otvorenú úlohu.
- `Reset aplikácie` je v pokročilej sekcii a pred zmazaním sa pýta na potvrdenie.

## 10. Validácia obsahu

```bash
npm run validate
npm run audit
```

Očakávanie: žiadne errors.
