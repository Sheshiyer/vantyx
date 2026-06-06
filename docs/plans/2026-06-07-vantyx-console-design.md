# Vantyx Operator Console — Design

**Date:** 2026-06-07 · **Status:** approved, building

## Purpose

A minimal central web console for Vantyx **operators** to manage the platform — see all projects,
manage each project's team, and reach logs — without relying on the `new-client` CLI or the Cloudflare
dashboard for day-to-day management.

## Decisions (brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Audience | **Platform console for operators only** — separate from the per-tenant client admins |
| 2 | Projects | **List + overview** (links + status); creating a project stays on the `new-client` CLI |
| 3 | Logs | **Deep-link to PostHog** (already wired) — no in-console log store |
| 4 | Location/auth | **`admin.tryvantyx.space` behind Cloudflare Access** — the allow-list *is* the operator list |
| 5 | Access scope | **Console only for now** — per-tenant client admins keep their current password/session auth |

## Architecture

Two surfaces, one Worker, nothing existing discarded:

- **Per-tenant admin** (`<slug>.tryvantyx.space/admin`) — unchanged (session auth, slot editor,
  publish/rollback, per-tenant Team UI). Access migration for these = later (backlog B-item).
- **Operator console** (NEW) — `admin.tryvantyx.space`, behind Cloudflare Access. Reaching it proves
  you're an operator (no separate super-admin role).

`admin` is a reserved label (`resolveSlug → null`). The Worker special-cases the host
`admin.tryvantyx.space` to serve the `apps/console` SPA and handle `/api/console/*`, each gated by the
`access.ts` JWT verifier (`Cf-Access-Jwt-Assertion` vs `ACCESS_AUD` + `ACCESS_TEAM_DOMAIN`). This is the
only Access wiring now — scoped to the console host, so per-tenant admins/APIs are untouched (no
namespacing, no retiring code).

Serving a 3rd SPA from one Worker: console builds with `--base=/console/` into `.assets/console/`; when
host = `admin.tryvantyx.space` the Worker serves that shell. Viewer (`/`) and per-tenant `/admin` are
unaffected on their own hosts.

## Console features

1. **Projects (list + overview)** — `GET /api/console/projects` scans KV `config:*` (reuse
   `listTenants`) → `[{slug, name, version, floors, publishedAt}]`. UI: table with links to each
   viewer/admin + a Team action. "New project" shows the `new-client` command.
2. **Teams (cross-tenant)** — team logic refactored into shared helpers used by both per-tenant and
   console routes: `GET /api/console/projects/:slug/team`, `POST …/team/invite`, `POST …/team/update`
   (role/status, last-owner protected).
3. **Logs** — nav item deep-linking to the PostHog project.

All `/api/console/*` verify the Access JWT (operator); Worker branches by host (console host →
Access-gated console routes; tenant hosts → today's session routes).

## Operator setup (one-time, dashboard)

1. Enable Zero Trust (free).
2. Access app for `admin.tryvantyx.space` (whole host), email-OTP, Allow policy = operator emails.
3. Add `admin.tryvantyx.space` as a Worker Custom Domain (wrangler.toml route).
4. Provide **AUD** + **team domain** → set as `ACCESS_AUD` + `ACCESS_TEAM_DOMAIN`.

## Sequencing

1. Build console SPA + host routing + `/api/console/*` + Access wiring; deploy (inert until configured).
2. Operator does the dashboard setup + sends AUD/team domain.
3. Set the vars; verify live.

## Testing

Unit: `/api/console/projects` lists tenants; cross-tenant team endpoints are operator-gated (DEV_MODE
bypass for local). Live: `admin.tryvantyx.space` → OTP → console loads → projects + team management work.

## Out of scope (YAGNI)

Project creation/editing/deletion in the UI (CLI stays); in-console log storage/search (PostHog);
per-tenant Access migration; analytics dashboards (PostHog); billing/accounts.
