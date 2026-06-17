# PWA / offline shell — FixIt Student Path v0.9

FixIt v0.9 spevňuje PWA/offline shell vrstvu. Cieľ je zlepšiť školskú spoľahlivosť bez zmeny didaktiky a bez balenia celého Pyodide runtime do hlavného ZIPu.

## Čo funguje offline

Po prvom úspešnom otvorení cez HTTP/HTTPS service worker cacheuje:

- `index.html`, CSS a hlavné JS moduly,
- `student_routes.json`,
- všetky lokálne JSON súbory úloh v `problems/`,
- lokálny `py-worker.js`,
- manifest a SVG/PNG ikony.

To znamená, že žiak môže offline otvoriť app shell, čítať zadania, prezerať trasy, mapu úloh, uložený lokálny progres, Predict/Fix zadania a dokumentované mikroobhajoby.

## Čo zatiaľ nefunguje plne offline

Offline shell neznamená offline Python runtime.

Predvolený Pyodide runtime sa stále načítava z CDN:

```text
https://cdn.jsdelivr.net/pyodide/v0.25.1/full/
```

V0.9 pridáva prepínač `PYODIDE_BASE_URL`, takže škola môže voliteľne použiť lokálnu runtime kópiu mimo hlavného ZIPu. Detaily sú v `docs/PYODIDE_RUNTIME.md`.

Run/Testy preto potrebujú buď:

- funkčné pripojenie k CDN,
- alebo správne pripravenú lokálnu runtime cestu,
- alebo runtime, ktorý už prehliadač úspešne načítal/cacheoval mimo tejto appky.

## Prečo je to tak

Lokálne pribalenie Pyodide je väčšie technické rozhodnutie:

- výrazne zväčší release ZIP,
- vyžaduje kontrolu licencií a aktualizácií runtime,
- mení CDN/release stratégiu,
- treba ho testovať na školských zariadeniach.

V0.9 preto pripravuje bezpečnú PWA shell vrstvu a konfigurovateľnú runtime cestu. Samotné lokálne balenie Pyodide patrí do samostatného školského deploymentu alebo budúcej verzie.

## Spustenie

Service worker funguje cez `localhost` alebo HTTPS. Nefunguje pri priamom otvorení cez `file://`.

```bash
python -m http.server 8000
```

Potom otvor:

```text
http://localhost:8000/
```

## Automatická kontrola cache manifestu

```bash
npm run pwa:check
```

Kontroluje, že `sw.js` cacheuje všetky lokálne moduly v `src/`, JSON úlohy v `problems/`, shell súbory, manifest, ikony a `student_routes.json`.

## Browser smoke pre offline reload

```bash
npm run smoke:browser
```

V štandardnom Chromiu test overí:

```text
online first load → service worker ready → cache populated → offline reload → route still renders
```

Ak má lokálne Chromium spravovanú politiku `URLBlocklist=*`, test sa korektne preskočí. Spusti ho v bežnom lokálnom alebo CI Chromiu.

## Smoke test offline shellu

1. Otvor appku online cez lokálny server.
2. Skontroluj, že v hlavičke vidíš stav „Offline shell pripravený“ alebo „Stav appky“.
3. Otvor trasu, napríklad `?route=Y2_most_cli_dom&problem=L7-026`.
4. Vypni sieť alebo v DevTools nastav offline.
5. Obnov stránku.
6. Očakávanie: app shell, trasy a zadania sa načítajú.
7. Očakávanie: Run/Testy môžu zlyhať s jasnou správou: **Zadanie vidíš, ale Python sa teraz nedá spustiť.**

## Runtime status panel

Na obrazovke úlohy je panel „Python runtime“ alebo v simple mode „Stav Pythonu“. Ukazuje:

- `idle` — runtime sa ešte nespustil,
- `starting/loading` — Pyodide sa pripravuje,
- `ready` — runtime je pripravený,
- `offline/error/unavailable/timeout` — runtime nie je dostupný alebo beh zlyhal.

Panel má žiakovi aj učiteľovi jasne oddeliť dve veci:

- offline dostupnosť app shellu a zadaní,
- dostupnosť Python runtime pre Run/Testy.

## Teacher smoke card

Pred hodinou over tri scenáre:

| Scenár | Postup | Očakávanie |
|---|---|---|
| Online test | Otvor L1 alebo L7 úlohu a spusti Run/Testy. | Runtime sa načíta alebo jasne zahlási chybu. |
| Offline shell test | Otvor appku online, počkaj na service worker, prepni offline a reloadni trasu. | Zadanie a trasa sa načítajú z cache. |
| CDN blocked fallback | Zablokuj `cdn.jsdelivr.net` alebo použi sieť bez CDN prístupu a spusti Run/Testy. | Žiak vidí, že zadanie je dostupné, ale Python sa nedá spustiť. |


## Lokálny Pyodide vendor runtime

V0.9 pridáva dokumentovaný školský postup pre voliteľnú lokálnu runtime kópiu v `vendor/pyodide/v0.25.1/full/`. Service worker stále garantuje iba app shell a lokálne zadania; plný offline Python runtime ostáva samostatný školský deployment, nie súčasť hlavného ZIPu.
