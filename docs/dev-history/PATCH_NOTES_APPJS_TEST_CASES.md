# Patch app.js — test_cases kompatibilita

Tento patch rozširuje `app.js`, aby vedel testovať aj nový formát úloh:

```json
"test_cases": [
  { "input": "2", "output": "4" },
  { "input": "5", "output": "25" }
]
```

Zachovaná je spätná kompatibilita s pôvodným formátom:

```json
"tests": [
  { "input": "2", "expected_stdout": "4\n", "visible": true }
]
```

Podporené sú aj alternatívne výstupy:

```json
"accepted_outputs": ["i", "y"]
```

alebo na úrovni testu:

```json
{ "input": "", "output": "i", "accepted_outputs": ["i", "y"] }
```

Zmenené časti:
- pridané `getStdoutTests(problem)`
- pridané `getAcceptedStdouts(test)`
- upravené `runAllTests(...)`
- upravené `getSampleInput(...)`

Poznámka: tento patch nemení funkčné úlohy typu `evaluation.kind = "function"`; tie fungujú pôvodným systémom.
