import { hostnameToSlug } from "@panorama/shared";
import type { Env } from "./env";

/**
 * Resolve the tenant slug from the request host + the configured product apex.
 * Reads the host from the request URL (reliable in both Workers and tests); falls back
 * to the Host header if the URL is host-less.
 */
export function resolveSlug(request: Request, env: Env): string | null {
  // Local dev: `localhost` can't carry a tenant subdomain, so a DEV_TENANT override
  // (set in .dev.vars alongside DEV_MODE) pins the tenant for `wrangler dev`.
  if (env.DEV_MODE === "1" && env.DEV_TENANT) return env.DEV_TENANT;

  const host = new URL(request.url).host || request.headers.get("host");
  // Single-tenant fallback (e.g. a workers.dev deploy with no per-tenant subdomain).
  return hostnameToSlug(host, env.PRODUCT_APEX) ?? (env.DEFAULT_TENANT || null);
}
