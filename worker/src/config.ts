import { configKvKey, migrateToCurrent, type TenantConfig } from "@panorama/shared";
import type { Env } from "./env";
import { json, apiError } from "./http";

/** GET /api/config — return the tenant's config from KV (migrated + validated). */
export async function handleGetConfig(
  slug: string,
  request: Request,
  env: Env,
): Promise<Response> {
  const raw: unknown = await env.CONFIG.get(configKvKey(slug), "json");
  if (raw === null) {
    return apiError(404, "tenant_not_provisioned", `No panorama configured for "${slug}".`);
  }

  let config: TenantConfig;
  try {
    config = migrateToCurrent(raw);
  } catch {
    return apiError(500, "config_invalid", "Stored configuration failed validation.");
  }

  const etag = `"v${config.version}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  return json(
    { config },
    { headers: { etag, "cache-control": "public, max-age=30, s-maxage=60" } },
  );
}
