# Vantyx — Backlog (open, non-blocking follow-ups)

Tracked, **not closed**. None of these block current development waves. When the monorepo gets a
GitHub remote, each becomes an issue. Last reviewed: 2026-06-07.

## Deferred — third-party finishing (low priority)

These integrations are **wired and live** (keys set as Worker secrets); only the finishing touches
remain. They degrade gracefully, so the app is fully functional without them.

- [ ] **B1 · Resend email activation.** `RESEND_API_KEY` is set, but outbound email stays off until
  **both** `EMAIL_FROM` (e.g. `Vantyx <noreply@vantyx.com>`) is set **and** the sending domain is
  verified in Resend (SPF/DKIM/DMARC DNS records). → Blocked on the Vantyx domain.
- [ ] **B2 · Delete the dangling secret.** A typo left `RESEND_API_KE` (no `Y`) in the secret store
  alongside the correct `RESEND_API_KEY`. Harmless but untidy: `cd worker && bunx wrangler secret delete RESEND_API_KE`.
- [ ] **B3 · Confirm PostHog ingestion.** `POSTHOG_KEY` is set and a `vantyx_setup_smoketest` event
  was fired; verify it appears in PostHog → Live events (project `367343`) to validate the key.
  Optional: set `POSTHOG_HOST` only if on EU cloud; tidy placeholder values in `worker/.dev.vars`.
- [ ] **B4 · Confirm Turnstile login in-browser.** Turnstile is live and **fails closed**. Verify an
  admin login succeeds on the live host; if the widget isn't scoped to
  `vantyx.sheshnarayan-iyer.workers.dev`, add that hostname in the Turnstile dashboard.
  Emergency unlock: `cd worker && bunx wrangler secret delete TURNSTILE_SECRET`.

## Domain / multi-tenant

- [x] **B6 · Multi-tenant on tryvantyx.space** — DONE (Wave 1, commit ff34d18): PRODUCT_APEX +
  per-tenant Custom Domains + Vantyx splash at apex/www; DEFAULT_TENANT dropped.
  `marina-one-ka.tryvantyx.space` live.
- [ ] **B6a · Zero-touch tenant onboarding.** `new-client --apply` should auto-register a Cloudflare
  Custom Domain for the new subdomain (today a new tenant needs a `routes` entry in wrangler.toml +
  redeploy). CF API: `POST /accounts/{id}/workers/domains` (gated on CLOUDFLARE_API_TOKEN). Then
  dogfood a real 2nd client end-to-end.
- [ ] **B5 · `PUBLIC_BASE_URL`** (low) — optional; email links already use the request origin, which
  is now the correct custom domain. Set it only if you want a canonical override.

## Deferred — product (later)

- [ ] **B7 · Editor roles & multi-user management** (beyond one editor per project).
- [ ] **B8 · Hotspots / lead-capture** (schema seams already exist; Phase-2 viewer features).
