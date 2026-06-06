import {
  configKvKey,
  configDraftKvKey,
  configHistoryKey,
  configHistoryPrefix,
  versionFromHistoryKey,
  migrateToCurrent,
  parseTenantConfig,
  safeParseTenantConfig,
  type TenantConfig,
} from "@panorama/shared";
import type { Env } from "./env";
import { json, apiError } from "./http";
import { requireAuth, currentSession } from "./auth";
import { captureEvent } from "./telemetry";

async function readConfig(key: string, env: Env): Promise<TenantConfig | null> {
  const raw: unknown = await env.CONFIG.get(key, "json");
  if (raw === null) return null;
  return migrateToCurrent(raw); // throws if stored config is invalid
}

/** Non-throwing read — returns null if absent OR invalid. */
async function readConfigSafe(key: string, env: Env): Promise<TenantConfig | null> {
  try {
    return await readConfig(key, env);
  } catch {
    return null;
  }
}

async function backupLive(slug: string, live: TenantConfig, env: Env): Promise<void> {
  await env.MEDIA.put(configHistoryKey(slug, live.version), JSON.stringify(live), {
    httpMetadata: { contentType: "application/json" },
  });
}

/** Most recent VALID archived config — the last-known-good fallback if live KV is corrupt. */
async function lastGoodHistory(slug: string, env: Env): Promise<TenantConfig | null> {
  const listed = await env.MEDIA.list({ prefix: configHistoryPrefix(slug) });
  const versions = listed.objects
    .map((o) => versionFromHistoryKey(o.key))
    .filter((v): v is number => v !== null)
    .sort((a, b) => b - a);
  for (const v of versions) {
    const obj = await env.MEDIA.get(configHistoryKey(slug, v));
    if (!obj) continue;
    const parsed = safeParseTenantConfig(await obj.json());
    if (parsed.success) return parsed.data;
  }
  return null;
}

/** Optimistic-concurrency base version from the If-Match header (a bare version number), or null. */
function ifMatchVersion(request: Request): number | null {
  const raw = request.headers.get("if-match");
  if (raw == null) return null;
  const n = Number(raw.replace(/"/g, "").trim());
  return Number.isInteger(n) ? n : null;
}

/** GET /api/config — public LIVE config. Falls back to the last-good history if live is corrupt. */
export async function handleGetConfig(slug: string, request: Request, env: Env): Promise<Response> {
  let config: TenantConfig | null = null;
  let degraded = false;
  try {
    config = await readConfig(configKvKey(slug), env);
  } catch {
    config = await lastGoodHistory(slug, env); // never 500 the live tour on a bad value
    degraded = config !== null;
    if (!config) return apiError(503, "config_unrecoverable", "The tour is temporarily unavailable.");
  }
  if (!config) return apiError(404, "tenant_not_provisioned", `No panorama configured for "${slug}".`);

  const etag = `"v${config.version}${degraded ? "-fallback" : ""}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }
  const headers: Record<string, string> = {
    etag,
    // Short edge TTL so a publish propagates quickly (KV is eventually consistent); none when degraded.
    "cache-control": degraded ? "no-store" : "public, max-age=30, s-maxage=10",
  };
  if (degraded) headers["x-vantyx-degraded"] = "last-good-history";
  return json({ config }, { headers });
}

/** GET /api/config?draft=1 — the builder's DRAFT (falls back to live if no draft yet). Never cached. */
export async function handleGetDraft(slug: string, request: Request, env: Env): Promise<Response> {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  const draft =
    (await readConfigSafe(configDraftKvKey(slug), env)) ?? (await readConfigSafe(configKvKey(slug), env));
  if (!draft) return apiError(404, "tenant_not_provisioned", `No panorama configured for "${slug}".`);
  return json({ config: draft }, { headers: { "cache-control": "no-store" } });
}

/** PUT /api/config — write the DRAFT only. Optionally guarded by If-Match (the version you loaded). */
export async function handlePutConfig(slug: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const denied = await requireAuth(request, env);
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

  // Optimistic concurrency: if the stored state moved since the editor loaded it, reject.
  const base = ifMatchVersion(request);
  if (base !== null) {
    const current =
      (await readConfigSafe(configDraftKvKey(slug), env)) ?? (await readConfigSafe(configKvKey(slug), env));
    if (current && current.version !== base) {
      return apiError(409, "version_conflict", `This project moved to v${current.version} — reload and re-apply.`);
    }
  }

  config.updatedAt = new Date().toISOString();
  await env.CONFIG.put(configDraftKvKey(slug), JSON.stringify(config));
  const session = await currentSession(request, env);
  const userId = session?.sub ?? (env.DEV_MODE === "1" ? "dev@local" : "anon");
  captureEvent(env, ctx, userId, "draft_saved", { slug, version: config.version });
  return json({ ok: true, draft: true, version: config.version });
}

/** POST /api/publish — draft → live + history backup + version bump. If-Match guards against races. */
export async function handlePublish(slug: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const denied = await requireAuth(request, env);
  if (denied) return denied;

  let draft: TenantConfig | null;
  try {
    draft = await readConfig(configDraftKvKey(slug), env);
  } catch {
    return apiError(422, "invalid_config", "Draft failed validation; fix it before publishing.");
  }
  if (!draft) return apiError(409, "no_draft", "No draft to publish.");

  const live = await readConfigSafe(configKvKey(slug), env);

  const base = ifMatchVersion(request);
  if (base !== null && live && live.version !== base) {
    return apiError(409, "version_conflict", `Someone published v${live.version} since you loaded v${base}. Reload first.`);
  }

  if (live) await backupLive(slug, live, env);

  const newVersion = (live?.version ?? 0) + 1;
  const published: TenantConfig = {
    ...draft,
    version: newVersion,
    publishedAt: new Date().toISOString(),
  };

  await env.CONFIG.put(configKvKey(slug), JSON.stringify(published));
  await env.CONFIG.put(configDraftKvKey(slug), JSON.stringify(published)); // keep draft == live

  const session = await currentSession(request, env);
  const userId = session?.sub ?? (env.DEV_MODE === "1" ? "dev@local" : "anon");
  captureEvent(env, ctx, userId, "config_published", { slug, version: newVersion });

  // Return the published config so the admin updates from the write (avoids a stale read-after-write).
  return json({ ok: true, version: newVersion, publishedAt: published.publishedAt, config: published });
}

/** GET /api/config/history — archived versions available to roll back to (auth-gated). */
export async function handleGetHistory(slug: string, request: Request, env: Env): Promise<Response> {
  const denied = await requireAuth(request, env);
  if (denied) return denied;
  const listed = await env.MEDIA.list({ prefix: configHistoryPrefix(slug) });
  const versions = listed.objects
    .map((o) => ({
      version: versionFromHistoryKey(o.key),
      savedAt: o.uploaded ? o.uploaded.toISOString() : null,
    }))
    .filter((v): v is { version: number; savedAt: string | null } => v.version !== null)
    .sort((a, b) => b.version - a.version);
  return json({ versions }, { headers: { "cache-control": "no-store" } });
}

/** POST /api/rollback { version } — republish an archived config version as the new live. */
export async function handleRollback(slug: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const denied = await requireAuth(request, env);
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

  const live = await readConfigSafe(configKvKey(slug), env);
  if (live) await backupLive(slug, live, env);

  const newVersion = (live?.version ?? 0) + 1;
  const published: TenantConfig = {
    ...restored,
    version: newVersion,
    publishedAt: new Date().toISOString(),
  };
  await env.CONFIG.put(configKvKey(slug), JSON.stringify(published));
  await env.CONFIG.put(configDraftKvKey(slug), JSON.stringify(published));

  const session = await currentSession(request, env);
  const userId = session?.sub ?? (env.DEV_MODE === "1" ? "dev@local" : "anon");
  captureEvent(env, ctx, userId, "config_rolled_back", { slug, target_version: target, new_version: newVersion });

  return json({ ok: true, version: newVersion, restoredFrom: target, config: published });
}
