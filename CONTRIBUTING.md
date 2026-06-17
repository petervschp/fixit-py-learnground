# Contributing

Projekt je školský prototyp. Zmeny by mali chrániť hlavnú dramaturgiu kurzu:

```text
stav → funkcie → CLI úlohovník → Y2 stav / akcia / render / localStorage
```

## Pravidlá pre nové úlohy

Nová úloha má mať:

- stabilné `id`,
- `schema_version: 3`,
- `phaseTags`,
- `concepts`,
- `dramaturgyNode`,
- `routeRole`,
- `failureKinds`,
- `microDefense.prompt`,
- viditeľný test a aspoň jeden ďalší test, ak to dáva zmysel.

## Didaktické pravidlá

- PASS neznamená porozumenie.
- Preferuj Fix, Predict-state, Trace/Explain a funkcie nad stavom pred masovým Solve grindom.
- Nepridávaj rebríčky, automatické známky ani účty.
- Nepresúvaj hlavnú líniu kurzu do FixIt appky.

## Technické hranice modulov

- `app.js` má zostať boot/orchestrátor.
- `task-renderer.js` má zostať kompozícia obrazovky, nie nový monolit.
- Python worker patrí cez `runner-client.js`.
- Exporty, importy a reset patria do `export-backup.js`.
- Čistá testovacia logika patrí do `test-engine.js`.

## Kontroly pred odoslaním zmeny

```bash
npm run validate
npm run audit
npm run smoke:modules
npm run smoke:browser
npm run release:check
```

Ak lokálne Chromium nie je dostupné, nastav `CHROMIUM_BIN` podľa `docs/CHROMIUM_BROWSER_SMOKE.md`. Ak browser automatizácia nie je možná, prejdi manuálny smoke checklist:

```bash
npm run smoke:manual
```

## Pred release

```bash
npm run release:zip
```

Pred verejným release skontroluj aj `PRIVACY.md`, `SECURITY.md` a `docs/RELEASE_CHECKLIST.md`.


## Vendor Pyodide checks

V0.9 pridáva voliteľný školský Pyodide runtime mimo hlavného ZIPu. Bežný príspevok nemá commitovať `vendor/pyodide/`; táto cesta je lokálny/školský deployment artefakt a je ignorovaná v `.gitignore`.

Použi:

```bash
npm run vendor:check          # iba keď máš reálny vendor runtime
npm run smoke:local-pyodide   # CI-friendly mock test lokálnej PYODIDE_BASE_URL cesty
```
