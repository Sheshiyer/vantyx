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
}
