export interface Env {
  /** Per-tenant config documents, keyed `config:<slug>`. */
  CONFIG: KVNamespace;
  /** Private bucket of panorama + branding assets, prefixed by tenant slug. */
  MEDIA: R2Bucket;
  /** Workers Static Assets binding serving the built viewer SPA (production only). */
  ASSETS_SPA?: Fetcher;
  /** Product apex domain used to resolve the tenant from the Host header. */
  PRODUCT_APEX: string;
  /** "1" bypasses Cloudflare Access checks for local `wrangler dev`. Unset/absent in prod. */
  DEV_MODE?: string;
  /** In DEV_MODE, pins the tenant slug (localhost can't carry a tenant subdomain). */
  DEV_TENANT?: string;
  /** Production single-tenant fallback when the host doesn't resolve (e.g. a workers.dev deploy). */
  DEFAULT_TENANT?: string;
  /** Cloudflare Access application AUD tag (admin write-path). */
  ACCESS_AUD?: string;
  /** Cloudflare Access team domain, e.g. https://<team>.cloudflareaccess.com. */
  ACCESS_TEAM_DOMAIN?: string;
}
