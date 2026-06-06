#!/usr/bin/env bash
# Build both SPAs and assemble worker/.assets for the Vantyx Worker's Static Assets:
#   /        → viewer SPA
#   /admin   → admin SPA (built with base=/admin/)
# Then: cd worker && bunx wrangler deploy
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "→ Building viewer (worker mode)…"
bun run --filter @panorama/viewer build >/dev/null

echo "→ Building admin (base /admin/)…"
( cd apps/admin && bunx vite build --base=/admin/ >/dev/null )

echo "→ Assembling worker/.assets …"
rm -rf worker/.assets
mkdir -p worker/.assets
cp -R apps/viewer/dist/. worker/.assets/
cp -R apps/admin/dist worker/.assets/admin

echo "✓ worker/.assets ready — viewer at /, admin at /admin"
find worker/.assets -maxdepth 2 -type f | sed "s|$ROOT/worker/.assets/||" | sort | head -20
