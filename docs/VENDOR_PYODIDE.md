# Vendor Pyodide runtime

Podrobný školský postup je v [`docs/vendor-pyodide/README.md`](vendor-pyodide/README.md).

Krátko:

- hlavný FixIt release ZIP Pyodide runtime neobsahuje,
- default je CDN,
- škola môže mimo hlavného ZIPu pridať `vendor/pyodide/v0.25.1/full/`,
- appku potom otvorí s `?pyodideBaseUrl=./vendor/pyodide/v0.25.1/full/`,
- štruktúru overí cez `npm run vendor:check`,
- lokálnu cestu cez worker overí cez `npm run smoke:local-pyodide`.
