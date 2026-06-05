/**
 * Tenant ↔ subdomain resolution. Used identically by the Worker (edge) and the
 * viewer/admin/CLI (client) so the two can never disagree on which tenant is in play.
 */

/** Labels that can never be a tenant slug — reserved for infrastructure/routing. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "admin",
  "www",
  "api",
  "app",
  "root",
  "assets",
  "cdn",
  "static",
  "dashboard",
]);

/** A tenant slug: dns-safe, lowercase, 2–40 chars, no leading/trailing hyphen. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SUBDOMAINS.has(slug);
}

/** Strip a `:port` and lowercase a Host header value. */
function normalizeHost(host: string): string {
  return host.trim().toLowerCase().split(":")[0] ?? "";
}

/**
 * Resolve a tenant slug from a Host header, given the product apex domain.
 * Returns `null` for the apex itself, `www`, multi-label subdomains, or any
 * reserved/invalid label.
 *
 *   hostnameToSlug("marina-one.pano.app", "pano.app") -> "marina-one"
 *   hostnameToSlug("pano.app", "pano.app")            -> null
 *   hostnameToSlug("admin.pano.app", "pano.app")      -> null  (reserved)
 *   hostnameToSlug("a.b.pano.app", "pano.app")        -> null  (nested)
 */
export function hostnameToSlug(
  host: string | null | undefined,
  apex: string,
): string | null {
  if (!host) return null;
  const h = normalizeHost(host);
  const a = normalizeHost(apex);
  if (!h || !a || h === a) return null;

  const suffix = `.${a}`;
  if (!h.endsWith(suffix)) return null;

  const label = h.slice(0, -suffix.length);
  // Only single-label subdomains are tenants (no nested dots).
  if (!label || label.includes(".")) return null;
  if (!isValidSlug(label)) return null;

  return label;
}

/** Build a tenant's canonical viewer hostname from its slug + the product apex. */
export function slugToHostname(slug: string, apex: string): string {
  return `${slug}.${normalizeHost(apex)}`;
}
