# Vantyx — Product Version Design (self-update loop)

*Validated via brainstorming, 2026-06-06. Builds on the Phase-1 engine (`@panorama/shared`, the
viewer, the Worker read-path) already shipped + proven live on marina1-k.*

## Context

The one-off static path is proven (curate → downscale → config → static build → deploy, live on
marina1-k). The **product version** turns that into a self-serve loop: a real-estate **builder**
re-uploads floor views **as construction rises** (the view literally changes over months), through a
**project-specific admin**, and the live tour updates **non-destructively, with zero downtime** —
the brand promises *"Never go dark"* and *"Always true to today."*

## Locked decisions

- **Image processing: browser-side.** The admin canvas-downscales the raw ~50 MB 360° to ≤8192px
  (~5 MB) *before* upload. (Mirrors the proven `sips` step, now client-side.)
- **Upload: Worker-proxied (not presigned).** Because the image is already ~5 MB, the Worker accepts
  the bytes and `MEDIA.put`s them. No aws4fetch/presigning, no R2 S3 creds, and it works identically
  in `wrangler dev` (local miniflare R2) and prod. (Presigning was only needed for 50 MB raws.)
- **Non-destructive + atomic update** via per-rev image keys + a draft/live config split.
- **Auth: Cloudflare Access** in front of the admin; Worker verifies the Access JWT. Local dev
  bypasses via `DEV_MODE`.

## Data model

**Image keys are per-rev (never overwritten):**
```
<slug>/<floorId>/<timeId>/360.<rev>.jpg     e.g. marina-one-ka/25f/morning/360.k7f3a9.jpg
```
`rev` = short random/hash token minted by the Worker on upload. The old key keeps serving until publish.

**Two KV entries per tenant:**
| Key | Role |
|---|---|
| `config:<slug>` | **LIVE** — what the viewer reads. Only changes on publish. |
| `config:<slug>:draft` | **DRAFT** — the builder's working copy. Edited freely; never served to buyers. |

Schema additions (`@panorama/shared`): `TenantConfig` gains `publishedAt?`, and a `meta` block is fine
as-is. No structural change — slots already hold an arbitrary `image` key, so per-rev keys "just work."
A new `DraftState` is a Worker concern (the draft is just a `TenantConfig` in a second KV key).

## Update flow (the "never go dark" core)

1. **Upload** — admin canvas-downscales → `POST /api/uploads` (bytes + `floorId`/`timeId`) → Worker
   validates (Access, size ≤ cap, jpeg/png/webp), mints `rev`, `MEDIA.put(<slug>/<floor>/<time>/360.<rev>.jpg)`,
   returns the key. **Non-destructive:** new key, nothing overwritten.
2. **Stage** — admin patches the *draft* slot's `image = <new key>` → `PUT /api/config` (writes draft only).
   Builder can stage many floor swaps; the live tour is untouched.
3. **Preview** — viewer loaded against the draft (`GET /api/config?draft=1`) — exactly what buyers will see.
4. **Publish** — `POST /api/publish`: validate draft → back up current live to `R2 <slug>/_config-history/<version>.json`
   → bump `version` + set `publishedAt` → **single KV put** of draft→live (atomic, globally propagated).
   The tour never serves a half-updated state.
5. **Rollback** — `POST /api/rollback` (or publish a prior history version). Old images are never deleted,
   every published config is archived → one-click revert.

## Worker API (additions to the shipped read-path)

| Method + path | Auth | Purpose |
|---|---|---|
| `GET /api/config` | public | LIVE config (shipped) |
| `GET /api/config?draft=1` | Access | draft config (preview) |
| `POST /api/uploads` | Access | accept ≤cap image bytes → `MEDIA.put` new rev key → return key |
| `PUT /api/config` | Access | write the draft (validated) |
| `POST /api/publish` | Access | atomic draft→live + history backup + version bump |
| `POST /api/rollback` | Access | restore a prior config version |
| `GET /assets/*` | public | stream from R2 (shipped) |

`requireAuth(req, env)`: in prod verify `Cf-Access-Jwt-Assertion` against `ACCESS_AUD`/team domain;
in `DEV_MODE` allow (logged). Keeps local `wrangler dev` testable.

## Vantyx admin (new `apps/admin`)

Vite + React SPA behind Cloudflare Access, served per-project. Screens:
- **Floor × time grid** — current thumbnail per slot (from the draft), "Replace view" per cell.
- **Uploader** — pick file → canvas downscale (reuse the 8192px preset) → upload → patch draft slot, with progress.
- **Preview** — opens the viewer against the draft in a new tab.
- **Publish bar** — shows pending changes ("3 floors updated"), **Publish** (atomic), version history + **Rollback**.
- Reuses `@panorama/shared` + mirrors the viewer's design language.

## Deployment / provisioning

First real Cloudflare deploy: create R2 bucket + KV namespace + Access app/policy, bind a Vantyx apex
domain, per-project subdomain. The `new-client` CLI (Phase 3) seeds `config:<slug>` + initial images +
Access policy. Until then everything runs on `wrangler dev` locally.

## Build sequence (each slice locally testable)

1. **Worker write-path** — `requireAuth`, `POST /api/uploads` (Worker-proxied → R2), `PUT /api/config`
   (draft), `GET /api/config?draft=1`, `POST /api/publish` (atomic + history), `POST /api/rollback`.
   Tests with mock env. ← *start here*
2. **`apps/admin`** — Vite SPA: grid, canvas-downscale uploader, preview, publish/rollback. Local via
   `wrangler dev` + `vite dev`.
3. **Provision + deploy** — real CF account, bindings, domain, subdomain; CLI seeds a tenant.

## Verification

- Slice 1: `bun test` the Worker write-path against a mock KV/R2 env — upload mints a rev key + stores
  bytes; `PUT` writes only the draft (live untouched); `publish` flips atomically + backs up history;
  `rollback` restores. Then `wrangler dev --local`: upload → stage → preview draft → publish → live
  `GET /api/config` reflects it; kill/restore to test rollback.
- Slice 2: in-browser — replace a floor view, preview the draft, publish, confirm the live viewer updates
  with **no redeploy**; confirm the live tour never errors during the process.
