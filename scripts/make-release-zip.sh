#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")"
NAME="fixit_student_path_v${VERSION//./_}_release"
mkdir -p dist
rm -f "dist/${NAME}.zip"

zip -r "dist/${NAME}.zip" \
  index.html app.js storage.js py-worker.js style.css manifest.webmanifest sw.js student_routes.json \
  assets \
  src problems scripts tests docs .github \
  README.md CHANGELOG.md LICENSE PRIVACY.md SECURITY.md CONTRIBUTING.md package.json .gitignore \
  -x "*/node_modules/*" "*/.tmp-browser-smoke-profile/*" "*.DS_Store" "*Thumbs.db" "*.log" "*.tmp" "fixit-private-backup-*.json" "fixit-anonymous-summary-*.json" "vendor/*" ".tmp-local-pyodide-runtime/*" ".tmp-local-pyodide-smoke-profile/*" >/dev/null

unzip -t "dist/${NAME}.zip" >/dev/null
printf 'Release ZIP created: dist/%s.zip\n' "$NAME"
