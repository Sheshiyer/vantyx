export interface Env {
  /** Per-tenant config documents, keyed `config:<slug>`. */
  CONFIG: KVNamespace;
  /** Private bucket of panorama + branding assets, prefixed by tenant slug. */
  MEDIA: R2Bucket;
  /** Workers Static Assets binding serving the built viewer SPA (production only). */
  ASSETS_SPA?: Fetcher;
  /** Product apex domain used to resolve the tenant from the Host header. */
  PRODUCT_APEX: string;
  /** "1" bypasses auth for local `wrangler dev`. Unset/absent in prod. */
  DEV_MODE?: string;
  /** In DEV_MODE, pins the tenant slug (localhost can't carry a tenant subdomain). */
  DEV_TENANT?: string;
  /** Production single-tenant fallback when the host doesn't resolve (e.g. a workers.dev deploy). */
  DEFAULT_TENANT?: string;
  /** HMAC secret for signing session cookies (`wrangler secret put AUTH_SECRET`). */
  AUTH_SECRET?: string;
  /** Provisioning secret gating `POST /api/auth/invite` (`wrangler secret put ADMIN_SECRET`). */
  ADMIN_SECRET?: string;
  /** Cloudflare Turnstile secret — when set, login/activate/reset require a valid challenge token. */
  TURNSTILE_SECRET?: string;
  /** Public Turnstile site key — exposed to the SPA (via /api/auth/config) so it renders the widget. */
  TURNSTILE_SITE_KEY?: string;
  /** Email provider (Resend) API key — when set, invites + password resets are emailed automatically. */
  RESEND_API_KEY?: string;
  /** From address for outbound email, e.g. "Vantyx <noreply@yourdomain.com>". */
  EMAIL_FROM?: string;
  /** Public base URL for links in emails (e.g. https://app.vantyx.com); falls back to the request origin. */
  PUBLIC_BASE_URL?: string;
  /** PostHog project API key — when set, /api/telemetry events forward to PostHog (product + error analytics). */
  POSTHOG_KEY?: string;
  /** PostHog ingestion host (default https://us.i.posthog.com). */
  POSTHOG_HOST?: string;
}
