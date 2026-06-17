# FixIt patch 2026-04-29

Úpravy podľa testovania so žiakmi:

- Predict úlohy: tlačidlo Testy je deaktivované; úloha sa označí ako SOLVED iba pri správnom uzamknutom odhade po Run.
- Poraď mi: tlačidlo je aktívne až po Run/Testoch, aby pracovalo s diagnostikou.
- Run teraz ukladá diagnostiku, aby sa hint vedel oprieť aj o runtime chyby.
- Editor: Tab vloží 4 medzery; Shift+Tab odsadí vybrané riadky späť.
- L6-P01: upravené zadanie a učiteľská poznámka pre Predict režim.
- L6-F03: prepracované na funkčné hodnotenie `pozdrav(meno)`; pôvodná globálna závislosť už neprejde.
- L6-008: samohlásky zahŕňajú aj `y`; opravený test `python -> 2` a doplnený skrytý test.
- L7-025: viditeľný test už nie je prázdny výstup pri `count=0`, ale zrozumiteľný prípad `count=3 -> "(3)"`.
- Content version: `2026-04-29-fix-hints-indent`.

## Hotfix v2
- Opravený pád tlačidla **Poraď mi** po neúspešnom stdout teste (`got/exp` scope bug).
- Pri neúspešných testoch sa vizuálny stav úlohy prepne späť zo `SOLVED` na nesplnené.
- Bumpnutý localStorage kľúč a content verzia (`v3`), aby sa starý lokálny stav žiakov nemiešal s opravenými úlohami.
