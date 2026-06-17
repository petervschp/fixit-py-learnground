# L6 template package

Pridané:

- `docs/L6_TEMPLATE_GUIDE.md` – pravidlá pre tvorbu robustných L6 úloh
- `docs/L6_TASK_TEMPLATE_SNIPPET.json` – kopírovateľná šablóna jednej úlohy
- `problems/level-06-template.json` – vzorový minilevel s 5 typmi úloh
- `scripts/audit-level.mjs` – jednoduchý audit štruktúry JSON úloh

Použitie auditu:

```bash
node scripts/audit-level.mjs problems/level-06-template.json
```

Poznámka: `level-06-template.json` sa v aplikácii automaticky nenačíta ako Level 6. Je to šablóna na kopírovanie úloh do `level-06.json` alebo na vytvorenie novej úrovne.
