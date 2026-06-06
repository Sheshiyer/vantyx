import {
  configKvKey,
  configDraftKvKey,
  configHistoryKey,
  migrateToCurrent,
  parseTenantConfig,
  type TenantConfig,
} from "@panorama/shared";
import type { Env } from "./env";
import { json, apiError } from "./http";
import { requireAuth } from "./auth";

async function readConfig(key: string, env: Env): Promise<TenantConfig | null> {
  const raw: unknown = await env.CONFIG.get(key, "json");
  if (raw === null) return null;
  return migrateToCurrent(raw); // throws if stored config is invalid
}

async function backupLive(slug: string, live: TenantConfig, env: Env): Promise<void> {
  await env.MEDIA.put(configHistoryKey(slug, live.version), JSON.stringify(live), {
    httpMetadata: { contentType: "application/json" },
  });
}

/** GET /api/config — public LIVE config (migrated + validated), cached + ETag. */
export async function handleGetConfig(slug: string, request: Request, env: Env): Promise<Response> {
  let config: TenantConfig | null;
  try {
    config = await readConfig(configKvKey(slug), env);
  } catch {
    return apiError(500, "config_invalid", "Stored configuration failed validation.");
  }
  if (!config) return apiError(404, "tenant_not_provisioned", `No panorama configured for "${slug}".`);

  const etag = `"v${config.version}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }
  return json({ config }, { headers: { etag, "cache-control": "public, max-age=30, s-maxage=60" } });
}

/** GET /api/config?draft=1 — the builder's DRAFT (falls back to live if no draft yet). Never cached. */
export async function handleGetDraft(slug: string, request: Request, env: Env): Promise<Response> {
  const denied = requireAuth(request, env);
  if (denied) return denied;
  try {
    const draft =
      (await readConfig(configDraftKvKey(slug), env)) ?? (await readConfig(configKvKey(slug), env));
    if (!draft) return apiError(404, "tenant_not_provisioned", `No panorama configured for "${slug}".`);
    return json({ config: draft }, { headers: { "cache-control": "no-store" } });
  } catch {
    return apiError(500, "config_invalid", "Stored configuration failed validation.");
  }
}

/** PUT /api/config — write the DRAFT only. The live tour is untouched. */
export async function handlePutConfig(slug: string, request: Request, env: Env): Promise<Response> {
  const denied = requireAuth(request, env);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "bad_request", "Body must be JSON.");
  }

  let config: TenantConfig;
  try {
    config = parseTenantConfig((body as { config?: unknown }).config ?? body);
  } catch {
    return apiError(422, "invalid_config", "Draft failed schema validation.");
  }
  if (config.tenant.slug !== slug) {
    return apiError(400, "slug_mismatch", "Config slug does not match the tenant.");
  }

  config.updatedAt = new Date().toISOString();
  await env.CONFIG.put(configDraftKvKey(slug), JSON.stringify(config));
  return json({ ok: true, draft: true, version: config.version });
}

/** POST /api/publish — atomic draft → live, with a history backup + version bump. */
export async function handlePublish(slug: string, _request: Request, env: Env): Promise<Response> {
  const denied = requireAuth(_request, env);
  if (denied) return denied;

  let draft: TenantConfig | null;
  try {
    draft = await readConfig(configDraftKvKey(slug), env);
  } catch {
    return apiError(422, "invalid_config", "Draft failed validation; fix it before publishing.");
  }
  if (!draft) return apiError(409, "no_draft", "No draft to publish.");

  let live: TenantConfig | null = null;
  try {
    live = await readConfig(configKvKey(slug), env);
  } catch {
    live = null; // corrupt/absent live — treat as first publish
  }
  if (live) await backupLive(slug, live, env);

  const newVersion = (live?.version ?? 0) + 1;
  const published: TenantConfig = {
    ...draft,
    version: newVersion,
    publishedAt: new Date().toISOString(),
  };

  // The single atomic flip — a KV put is atomic + globally propagated.
  await env.CONFIG.put(configKvKey(slug), JSON.stringify(published));
  await env.CONFIG.put(configDraftKvKey(slug), JSON.stringify(published)); // keep draft == live

  return json({ ok: true, version: newVersion, publishedAt: published.publishedAt });
}

/** POST /api/rollback { version } — republish an archived config version as the new live. */
export async function handleRollback(slug: string, request: Request, env: Env): Promise<Response> {
  const denied = requireAuth(request, env);
  if (denied) return denied;

  let target: number;
  try {
    const body = (await request.json()) as { version?: unknown };
    target = Number(body.version);
    if (!Number.isInteger(target) || target < 0) throw new Error("bad version");
  } catch {
    return apiError(400, "bad_request", "Provide an integer { version } to roll back to.");
  }

  const archived = await env.MEDIA.get(configHistoryKey(slug, target));
  if (!archived) return apiError(404, "version_not_found", `No archived config v${target}.`);

  let restored: TenantConfig;
  try {
    restored = migrateToCurrent(await archived.json());
  } catch {
    return apiError(500, "config_invalid", "Archived config failed validation.");
  }

  let live: TenantConfig | null = null;
  try {
    live = await readConfig(configKvKey(slug), env);
  } catch {
    live = null;
  }
  if (live) await backupLive(slug, live, env);

  const newVersion = (live?.version ?? 0) + 1;
  const published: TenantConfig = {
    ...restored,
    version: newVersion,
    publishedAt: new Date().toISOString(),
  };
  await env.CONFIG.put(configKvKey(slug), JSON.stringify(published));
  await env.CONFIG.put(configDraftKvKey(slug), JSON.stringify(published));

  return json({ ok: true, version: newVersion, restoredFrom: target });
}
