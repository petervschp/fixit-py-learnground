# FixIt task schema v3 – pracovný návrh pre Y1/Y2

Táto schéma je spätnokompatibilná s existujúcim runnerom. Nové polia sú primárne didaktické a kurátorské; runner ignoruje to, čo priamo nepotrebuje.

## Povinné jadro

```json
{
  "id": "L7-018",
  "level": 7,
  "title": "Y2 most: add_item(items, item)",
  "statement": "Zadanie pre žiaka...",
  "mode": "solve | fix | predict",
  "starter_code": "def f(...):\n    ...\n",
  "schema_version": 3
}
```

## Hodnotenie stdout úloh

```json
{
  "test_cases": [
    { "input": "3\n", "output": "6\n", "visible": true },
    { "input": "0\n", "output": "0\n", "visible": false }
  ]
}
```

Podporované sú aj staršie tvary `tests`, `expected_output`, `expected_stdout` a `accepted_outputs`, ale nový obsah má používať `test_cases`.

## Hodnotenie funkčných úloh

```json
{
  "evaluation": {
    "kind": "function",
    "target": { "name": "add_task" },
    "cases": [
      {
        "args": [[], "Kúpiť mlieko"],
        "expected_return": [{ "id": 1, "text": "Kúpiť mlieko", "done": false }],
        "visible": true
      }
    ],
    "mutation": {
      "check": true,
      "inputsMustRemainUnchanged": [0]
    }
  }
}
```

## Didaktické metadáta

```json
{
  "phaseTags": ["Y2_bridge_L7"],
  "dramaturgyNode": "state_transform",
  "concepts": ["function", "return", "list_as_state", "tasks_domain"],
  "routeRole": ["core", "bridge"],
  "failureKinds": ["return_vs_print", "list_state_change"],
  "teacherNote": "Handler zavolá funkciu, funkcia vráti nový stav, render zobrazí.",
  "microDefense": {
    "prompt": "Čo je zdroj pravdy: zoznam tasks alebo text na obrazovke?",
    "selfCheckScale": [
      { "value": 1, "label": "neviem vysvetliť" },
      { "value": 2, "label": "viem s pomocou" },
      { "value": 3, "label": "viem samostatne" }
    ]
  }
}
```

## Pravidlá

1. `PASS` znamená iba „testy prešli“, nie dôkaz porozumenia.
2. Každá jadrová úloha v trase má mať `microDefense.prompt`.
3. Teacher summary export nesmie obsahovať meno, kód, stdin ani voľný text žiaka.
4. Funkčné Y2 mostové úlohy majú preferovať parametre a `return`, nie `input()`/`print()`.
5. Nové úlohy s aplikačnou logikou majú explicitne pomenovať, či menia stav alebo iba renderujú zo stavu.
