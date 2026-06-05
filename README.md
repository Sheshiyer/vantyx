# Panorama Platform

A multi-tenant **360° panorama viewer** product that turns a one-off, static, hand-built
panorama site into (1) a **repeatable process** for stamping out new client sites and
(2) a **self-update CMS** each client uses to manage their own content.

> Productized from the one-off **Marina One** site (Ashwin Sheth Group). See the approved
> design at `~/.claude/plans/using-the-skill-cluster-valiant-hearth.md`.

## How it works

- **Viewer** (`apps/viewer`) — a static Vite + React SPA. At load it fetches a per-tenant
  `config.json` (from KV via the Worker) + panorama images (from R2 via the Worker), then
  renders them with **Pannellum**. The *same built bundle* serves every tenant — zero
  per-client build. The tenant is resolved from the **subdomain** (`marina-one.<apex>`).
- **Admin** (`apps/admin`) — a small Vite + React SPA behind **Cloudflare Access**. Clients
  replace images, edit labels, toggle slots, and update branding; publishing writes the
  config back and goes live instantly (no rebuild).
- **Worker** (`worker`) — the only backend. Resolves the tenant from the `Host` header,
  reads/writes config in KV, mints presigned R2 upload URLs, streams images from a private
  R2 bucket, and serves both SPA shells. Same-origin ⇒ no CORS.
- **CLI** (`cli`) — `panorama new-client` provisions a whole tenant end-to-end (assets → R2,
  config → KV, subdomain → DNS, login → Cloudflare Access policy) in one command.
- **Shared** (`packages/shared`) — the pure contract imported by all of the above: the Zod
  `TenantConfig` schema, tenant↔slug resolution, and the single source of R2 key naming.

## Layout

```
packages/shared/   @panorama/shared — Zod schema, tenant resolution, R2 key builders, migrations
apps/viewer/       public 360° viewer SPA (Vite + React + Pannellum)
apps/admin/        self-update CMS SPA (behind Cloudflare Access)
worker/            Cloudflare Worker — config (KV) + assets (R2) + uploads + SPA serving
cli/               `new-client` provisioning CLI + templates
scripts/           asset pipeline (migrate / upload / validate) — cherry-picked from marina-beta
```

## Status

- **Phase 1 (in progress):** migrate Marina One to the new architecture, ship live.
- Phase 2: admin + Cloudflare Access (client self-updates).
- Phase 3: extract the `new-client` CLI + template, onboard a 2nd client.

## ⚙️ Configure before deploy

- **Product apex domain** — the base for tenant subdomains (`marina-one.<apex>`). Set it via
  the Worker var `PRODUCT_APEX` (e.g. `pano.example.com`). **Not yet chosen — placeholder.**
- **Cloudflare** — account with R2 + KV + Access (Zero Trust); an R2 S3 API token for presigning.

## Develop

```sh
bun install
bun run typecheck
```

## Provenance / authoritative data

The Marina One floor→elevation table is **frozen** in `packages/shared/src/mapping.ts` to
resolve a cross-file discrepancy in the source repo (`scripts/generate-config-from-manifest.ts`
had a wrong map). R2 objects are keyed by floor *number* (`44f/noon/central-sea.jpg`), so
images are placed correctly; the frozen table governs displayed elevation only.
