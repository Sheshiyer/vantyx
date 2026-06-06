# Vantyx — Admin Auth & Access Control (self-contained)

*Validated via brainstorming, 2026-06-06. Self-contained Worker auth (no Cloudflare Access /
Zero-Trust, no email provider yet) so the full login + access-control flow builds, deploys, and
tests now on workers.dev. Email magic-link / password-reset layer on later once a domain + email
provider exist.*

## Model

Per-project **authorized editors**, all equal (no roles yet — YAGNI). Identity + state in KV
(beside the config):

- `user:<slug>:<email>` → `{ salt, hash, status: "invited"|"active"|"disabled", createdAt }`
- `invite:<token>` → `{ slug, email, exp }` — one-time, deleted on activation
- **Session** = signed cookie `vx_session` = `base64url(payload).hmacSHA256` over
  `{ sub: email, slug, exp }`, signed with the `AUTH_SECRET` Worker secret. Stateless verify +
  a KV active-user check each request, so removing/disabling a user **revokes immediately**.

## Flows

1. **Provision (Thoughtseed)** — `POST /api/auth/invite` gated by an `ADMIN_SECRET` header
   `{ email }` → mints `invite:<token>` (24 h) → returns `/admin/activate?token=…` to send
   out-of-band (Slack/WhatsApp).
2. **Activate (editor)** — `POST /api/auth/activate { token, password }` → PBKDF2-hash
   (Web Crypto, 100k iters, SHA-256) → create user `active` → set session cookie.
3. **Login** — `POST /api/auth/login { email, password }` → verify (timing-safe) → session cookie.
4. **Logout** — `POST /api/auth/logout` → clear cookie. **`GET /api/auth/me`** → `{ email, slug }`.

## Gating

`requireAuth(request, env)` swaps the Cloudflare-Access-JWT check for **session verification**:
`DEV_MODE` bypass (local) → else verify `vx_session` (HMAC + exp) → tenant must match
`resolveSlug` → user must exist + be `active`. Guards the write-path (uploads · `PUT /api/config`
· publish · rollback) and `/api/auth/me`. The **viewer + public read-path stay open**; the admin
SPA static files are public (the app shows a login screen and gates on the API).

## Files

- `worker/src/auth.ts` — PBKDF2 hash/verify, HMAC sign/verify session, cookie helpers, `requireAuth`.
- `worker/src/users.ts` — KV helpers (get/put user, create/consume invite) + types.
- `worker/src/authRoutes.ts` — invite/activate/login/logout/me handlers.
- `worker/src/{env,index,config,uploads}.ts` — `AUTH_SECRET`+`ADMIN_SECRET`; route `/api/auth/*`;
  callers `await requireAuth`.
- `apps/admin` — Login + Activate screens; `GET /api/auth/me` on load gates the grid; built with
  base `/admin/`, served from the Worker's Static Assets at `/admin/*` (viewer at `/`).

## Security

PBKDF2 (100k, SHA-256) · timing-safe compares · HttpOnly+Secure+SameSite=Lax cookie · one-time
expiring invites · `ADMIN_SECRET` for provisioning · active-user revocation · secrets via
`wrangler secret put` (AUTH_SECRET, ADMIN_SECRET), `.dev.vars` for local.

## Build order

1. Worker auth engine + routes + `requireAuth` swap + **tests** (bun, mock env). ← start here
2. Admin Login/Activate screens + `/api/auth/*` client + `/api/auth/me` gating.
3. Combined-asset deploy (viewer at `/`, admin at `/admin`), `wrangler secret put`, deploy, and
   curl-verify on workers.dev: invite → activate → login → authed write; unauthed → 401.
