# Patch: First failed test summary (2026-04-29)

Pridaný nízkorizikový UI patch pre testovanie:

- po neúspešných testoch sa nad detailným zoznamom zobrazí karta **„Prvý problém“**,
- pri viditeľnom teste ukáže vstup/argumenty, očakávaný výstup alebo return, reálny výstup alebo return,
- pri skrytom teste neprezrádza konkrétne expected/got, iba vysvetlí, že riešenie pravdepodobne nie je všeobecné,
- pri štrukturálnej chybe zvýrazní najprv porušené pravidlo,
- doplní krátke vysvetlenie „Možná príčina“ a „Ďalší krok“,
- odporučí použiť tlačidlo **Poraď mi**, ktoré už pracuje s uloženou diagnostikou.

Patch nemení formát JSON úloh ani existujúcu logiku vyhodnocovania testov.
