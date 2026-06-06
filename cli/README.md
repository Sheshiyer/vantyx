# @panorama/cli — `new-client` provisioning

One command to stand up a brand-new Vantyx tenant: build + validate its config, map a folder of
panorama images into the right slots, seed KV, upload to R2, and invite the first editor.

## Usage

```bash
# Dry run (default) — builds + validates the config and prints the exact provisioning plan.
bun run new-client --spec cli/templates/client.example.json --assets ./images --admin-email a@b.com

# Quick scaffold without a spec file:
bun run new-client \
  --slug marina-two --name "Marina Two" \
  --views "sea:Sea Facing,city:City Facing" \
  --times "day:Day,night:Night" \
  --floors "10f:10th Floor,20f:20th Floor" \
  --assets ./images

# Actually provision (seeds KV + uploads R2 + sends the invite):
ADMIN_SECRET=… bun run new-client --spec client.json --assets ./images --admin-email a@b.com --apply
```

### Flags

| Flag | Purpose |
|------|---------|
| `--spec <file.json>` | Tenant spec (slug, name, branding, views, times, floors). See `templates/client.example.json`. |
| `--slug` / `--name` | Quick-scaffold a spec inline (also overrides a spec's slug). |
| `--views` / `--times` / `--floors` | `id:Label,id2:Label2` lists for quick-scaffold mode. |
| `--assets <dir>` | Folder laid out as `<floorId>/<timeId>/<viewId>.jpg` — each image is wired into its slot. |
| `--admin-email <email>` | Create + (when a mail provider is set) send an owner activation invite. Needs `ADMIN_SECRET`. |
| `--apex <domain>` | Product apex for the tenant subdomain (default `tryvantyx.space` → `<slug>.tryvantyx.space`). |
| `--service <name>` | Worker service name for the Custom Domain (default `vantyx`). |
| `--worker <url>` | Target Worker URL for the invite call (default `https://<slug>.<apex>`). |
| `--apply` | Execute the plan. **Omitted = dry run** (prints commands, writes `cli/out/<slug>.config.json`). |

## What `--apply` runs

1. **Seed KV** — `wrangler kv key put config:<slug> --path <config> --binding CONFIG --remote`
2. **Upload assets** — `wrangler r2 object put vantyx-tenants/<slug>/<rel> --file <path> --remote` (per image)
3. **Register Custom Domain** — `<slug>.tryvantyx.space` via the Cloudflare API (auto DNS + TLS). Needs
   `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (optional `CF_ZONE_ID`, else looked up). Degrades to a
   printed manual step (add a `routes` entry to `wrangler.toml` + `wrangler deploy`).
4. **Invite the owner** — `POST https://<slug>.tryvantyx.space/api/auth/invite` with
   `x-admin-secret: $ADMIN_SECRET` → prints the activate link.

Wrangler steps run from `worker/` so the `CONFIG`/`MEDIA` bindings resolve. Authenticate first with
`wrangler login`; the Custom Domain step additionally needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

## Capture / QA / handoff runbook

1. **Capture** equirectangular 360°s (2:1, ≤ 8192px wide) → arrange as `<floorId>/<timeId>/<viewId>.jpg`.
2. **Dry run** to validate structure and eyeball the slot map (no writes).
3. **`--apply`** to provision; open `…/admin`, activate via the invite link, and replace/adjust slots.
4. **QA**: load `…/`, switch every floor/view/time, confirm images resolve and look right.
5. **Hand off**: send the editor their admin URL; updates publish live (non-destructive draft → publish → rollback).

## CI

`.github/workflows/ci.yml` typechecks (shared · worker · viewer · admin · console) and runs the test suite
on every PR and push. Pushes to `main` additionally build + deploy the Worker **only when opted in** — set
the repo **variable** `DEPLOY_ENABLED=true` and the **secret** `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit
scope). Otherwise the deploy job is skipped, CI stays green, and deploys stay manual via `wrangler deploy`.
