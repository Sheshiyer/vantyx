#!/usr/bin/env bash
# Seed LOCAL KV + R2 for `wrangler dev` — no Cloudflare account needed.
#   Usage: bun run seed:local [slug]          (default slug: marina-one)
# Reads config from:  seed/<slug>.config.json
# Reads images from:  assets-local/<slug>/**  (mirrors the R2 key layout, e.g. 44f/noon/central-sea.jpg)
#
# Run-from-worker so wrangler's local persistence (.wrangler/state) matches `bun run dev`.
set -euo pipefail

SLUG="${1:-marina-one}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT/seed/$SLUG.config.json"
ASSETS="$ROOT/assets-local/$SLUG"
BUCKET="panorama-tenants"

if [[ ! -f "$CONFIG" ]]; then
  echo "✗ Missing config: $CONFIG" >&2
  echo "  Generate it (e.g. bun run seed:marina) or create seed/$SLUG.config.json first." >&2
  exit 1
fi

cd "$ROOT/worker"

echo "→ Seeding local KV: config:$SLUG"
bunx wrangler kv key put "config:$SLUG" --path "$CONFIG" --binding CONFIG --local >/dev/null
echo "  ✓ config written"

if [[ -d "$ASSETS" ]]; then
  count=0
  while IFS= read -r -d '' f; do
    rel="${f#"$ASSETS"/}"
    bunx wrangler r2 object put "$BUCKET/$SLUG/$rel" --file "$f" --local >/dev/null
    count=$((count + 1))
    printf '\r  ✓ uploaded %d images' "$count"
  done < <(find "$ASSETS" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) -print0)
  echo ""
else
  echo "  ⚠ No images at $ASSETS — the viewer will 404 on assets until you add them."
fi

echo "✓ Local seed complete for '$SLUG'. Now run: bun run dev  (then open http://$SLUG.localhost:5173)"
