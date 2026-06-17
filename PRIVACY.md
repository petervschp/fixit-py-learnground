# Privacy

FixIt Student Path je navrhnutý ako lokálna školská appka bez účtov a bez cloudu.

## Lokálne dáta

Appka ukladá dáta do `localStorage` v prehliadači pod namespace `fixit.student.v3`. Môže ísť o:

- stav riešenia úloh,
- počet pokusov a hintov,
- posledný výsledok testov,
- rozpracovaný kód,
- stdin pre tlačidlo Run,
- lokálne udalosti potrebné na anonymné zhrnutie.

Tieto dáta ostávajú v prehliadači na danom zariadení.

## Anonymné zhrnutie pre učiteľa

Anonymný summary export zámerne neobsahuje:

- meno žiaka,
- e-mail,
- rozpracovaný kód,
- stdin,
- voľný text mikroobhajoby.

Obsahuje iba agregované a technické údaje, napríklad ID úloh, počty pokusov, hintov, prejdené testy a stav mikroobhajoby.

Anonymné zhrnutie sa nedá importovať späť ako práca žiaka. Je to jednosmerné odovzdanie reflexie alebo pracovného dôkazu.

## Súkromná záloha

Súkromná záloha môže obsahovať rozpracovaný kód a stdin. Je určená iba pre žiaka. Nemá sa odovzdávať učiteľovi ako anonymné zhrnutie.

Ak žiak do kódu alebo stdin napíše osobné údaje, súkromná záloha ich môže obsahovať. Preto so súkromnou zálohou treba zaobchádzať ako so súkromným súborom.

## Cloud, účty a hosting

Projekt nevytvára účty a neposiela progres na server. Pri spustení z GitHub Pages alebo školského servera sa môžu štandardne zaznamenávať serverové prístupy mimo tejto aplikácie; to závisí od hostingu, nie od FixIt kódu.

GitHub Pages môže zaznamenať bežné technické prístupy podľa vlastných pravidiel GitHubu. FixIt Student Path kód neposiela lokálny progres žiakov na GitHub.

## Service worker a offline cache

V0.8 používa service worker na cacheovanie app shellu, JS/CSS, trás a lokálnych JSON úloh. Service worker neodosiela žiacky progres na server a neukladá mená. Žiacky progres ostáva v `localStorage`; offline cache obsahuje iba statické súbory aplikácie a zadania.

Plný Pyodide runtime sa v hlavnom ZIPe nebalí lokálne. Run/Testy môžu načítavať Pyodide cez CDN alebo cez školou nastavenú `PYODIDE_BASE_URL` cestu. Táto konfigurácia nemení model žiackych dát: progres ostáva lokálny v prehliadači.

## Reset progresu a offline cache

V0.8 oddeľuje dve akcie: vymazanie lokálneho progresu žiaka a vymazanie offline cache/service workera. Vymazanie offline cache neodosiela žiadne dáta na server; iba odstráni lokálne cacheované statické súbory aplikácie a zadania.

## GitHub Actions a testy

GitHub Actions workflow pracuje iba so zdrojovým kódom repozitára. Browser smoke testy nevytvárajú ani neodosielajú žiacke dáta. Testovací lokálny stav je syntetický a používa sa iba počas CI.

## Odporúčanie pre školy

Nepíšte do kódu, vstupov ani záloh mená, rodné čísla, adresy ani iné osobné údaje. Pre odovzdanie učiteľovi používajte iba anonymné zhrnutie.


## Lokálny Pyodide vendor runtime

Voliteľný školský adresár `vendor/pyodide/v0.25.1/full/` obsahuje iba runtime súbory Pyodide, nie žiacky progres. Nastavenie `PYODIDE_BASE_URL` mení, odkiaľ sa načíta Python runtime; nemení pravidlá ukladania žiackych dát. Progres ostáva lokálne v prehliadači a anonymné zhrnutie zostáva bez mena, kódu a stdin.
