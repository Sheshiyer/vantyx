import { hostnameToSlug } from "@panorama/shared";
import type { Env } from "./env";

/**
 * Resolve the tenant slug from the request host + the configured product apex.
 * Reads the host from the request URL (reliable in both Workers and tests); falls back
 * to the Host header if the URL is host-less.
 */
export function resolveSlug(request: Request, env: Env): string | null {
  const host = new URL(request.url).host || request.headers.get("host");
  return hostnameToSlug(host, env.PRODUCT_APEX);
}
