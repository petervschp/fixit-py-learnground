# L6 template: funkcie s robustným hodnotením

Tento balík pridáva šablónu pre úlohy úrovne L6 tak, aby sa dali bezpečne kopírovať do ďalších úloh.

## Odporúčaná štruktúra úlohy

Každá „function-only“ úloha má mať:

- `mode`: `solve` alebo `fix`
- `evaluation.kind`: `function`
- `evaluation.target.name`: názov hodnotenej funkcie
- `evaluation.cases`: viditeľné aj skryté testy návratovej hodnoty
- `checks.ast.enabled`: `true`
- `checks.ast.forbiddenCalls`: typicky `input`, `print`, `open`
- `checks.forbiddenPatterns`: ľudsky čitateľné hlášky pre zakázané vzory
- `reference_solution`: učiteľské riešenie na audit, nie je zobrazované žiakovi
- `hints`: 3-stupňové rady

## Kľúčové pravidlo

Ak je cieľom precvičiť funkciu, netestuj len `stdout`. Testuj priamo návratovú hodnotu funkcie cez:

```json
"evaluation": {
  "kind": "function",
  "target": { "name": "nazov_funkcie" },
  "cases": [
    { "args": [5], "expected_return": 25, "visible": true },
    { "args": [9], "expected_return": 81, "visible": false }
  ]
}
```

Tak sa zníži riziko, že žiak úlohu obíde cez natvrdo vypísaný výsledok.

## Predict úlohy

Predict úlohy nech majú:

```json
"mode": "predict",
"tests": [
  { "input": "", "expected_stdout": "...", "visible": true }
]
```

Pri predict úlohách sú funkčné testy v aplikácii vypnuté. Žiak má najprv uzamknúť odhad a potom použiť Run.
