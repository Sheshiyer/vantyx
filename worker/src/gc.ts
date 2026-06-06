import {
  configKvKey,
  configDraftKvKey,
  configHistoryKey,
  configHistoryPrefix,
  versionFromHistoryKey,
  tenantPrefix,
  migrateToCurrent,
  safeParseTenantConfig,
  type TenantConfig,
} from "@panorama/shared";
import type { Env } from "./env";

// Don't delete objects younger than this — protects in-flight uploads not yet staged into a draft.
const GRACE_MS = 7 * 24 * 3600 * 1000;
// Retain the most recent N config-history versions per tenant (rollback targets).
const KEEP_HISTORY = 20;

/** Relative image keys a config references (e.g. "6f/morning/360.jpg" + branding logos). */
function referencedImages(config: TenantConfig | null): Set<string> {
  const set = new Set<string>();
  if (!config) return set;
  for (const f of config.floors) for (const s of f.slots) if (s.image) set.add(s.image);
  if (config.branding.logo) set.add(config.branding.logo);
  for (const l of config.branding.secondaryLogos) set.add(l);
  return set;
}

async function readSafe(key: string, env: Env): Promise<TenantConfig | null> {
  const raw: unknown = await env.CONFIG.get(key, "json");
  if (raw == null) return null;
  try {
    return migrateToCurrent(raw);
  } catch {
    return null;
  }
}

export type GcTenantResult = { slug: string; deletedImages: number; prunedHistory: number };

/**
 * Garbage-collect one tenant: delete image objects referenced by NEITHER the live/draft config
 * NOR the retained history versions (and older than the grace window), and prune history beyond
 * KEEP_HISTORY. Reference-counting keeps rollback targets resolvable.
 */
export async function gcTenant(env: Env, slug: string, now: number): Promise<GcTenantResult> {
  const referenced = new Set<string>([
    ...referencedImages(await readSafe(configKvKey(slug), env)),
    ...referencedImages(await readSafe(configDraftKvKey(slug), env)),
  ]);

  // History versions present, newest first.
  const histList = await env.MEDIA.list({ prefix: configHistoryPrefix(slug) });
  const histVersions = histList.objects
    .map((o) => versionFromHistoryKey(o.key))
    .filter((v): v is number => v !== null)
    .sort((a, b) => b - a);
  const keepVersions = histVersions.slice(0, KEEP_HISTORY);
  const pruneVersions = histVersions.slice(KEEP_HISTORY);

  // Images referenced by RETAINED history (so rollback to them still resolves).
  for (const v of keepVersions) {
    const obj = await env.MEDIA.get(configHistoryKey(slug, v));
    if (!obj) continue;
    const parsed = safeParseTenantConfig(await obj.json());
    if (parsed.success) for (const k of referencedImages(parsed.data)) referenced.add(k);
  }

  // Sweep unreferenced image objects older than the grace window.
  let deletedImages = 0;
  const prefix = tenantPrefix(slug);
  let cursor: string | undefined;
  do {
    const listed = await env.MEDIA.list({ prefix, cursor });
    for (const obj of listed.objects) {
      const rel = obj.key.slice(prefix.length);
      if (rel.startsWith("_config-history/")) continue; // handled below
      if (referenced.has(rel)) continue;
      const uploadedMs = obj.uploaded ? obj.uploaded.getTime() : 0;
      if (now - uploadedMs < GRACE_MS) continue;
      await env.MEDIA.delete(obj.key);
      deletedImages++;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  // Prune history beyond KEEP_HISTORY.
  let prunedHistory = 0;
  for (const v of pruneVersions) {
    await env.MEDIA.delete(configHistoryKey(slug, v));
    prunedHistory++;
  }

  return { slug, deletedImages, prunedHistory };
}

/** All tenant slugs (from `config:<slug>` KV keys, excluding `:draft`). */
export async function listTenants(env: Env): Promise<string[]> {
  const slugs = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await env.CONFIG.list({ prefix: "config:", cursor });
    for (const k of res.keys) {
      const m = k.name.match(/^config:([^:]+)$/);
      if (m) slugs.add(m[1]!);
    }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return [...slugs];
}

/** GC every tenant — invoked from the scheduled (cron) handler. */
export async function runGc(env: Env): Promise<{ tenants: number; deletedImages: number; prunedHistory: number }> {
  const now = Date.now();
  let deletedImages = 0;
  let prunedHistory = 0;
  const slugs = await listTenants(env);
  for (const slug of slugs) {
    const r = await gcTenant(env, slug, now);
    deletedImages += r.deletedImages;
    prunedHistory += r.prunedHistory;
  }
  return { tenants: slugs.length, deletedImages, prunedHistory };
}
