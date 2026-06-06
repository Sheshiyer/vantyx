/**
 * The ONLY place R2 object keys and KV keys are constructed. Importing this everywhere
 * (Worker reads, admin presign requests, CLI uploads, viewer image URLs) guarantees the
 * key shape can never drift, and server-side key construction prevents a client from
 * escaping its own tenant prefix.
 *
 * Canonical relative object key:  "<floorId>/<timeId>/<viewId>.<ext>"  e.g. "44f/noon/central-sea.jpg"
 * Canonical full bucket key:      "<slug>/<relativeKey>"               e.g. "marina-one/44f/noon/central-sea.jpg"
 */

const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function assertSafeSegment(segment: string, what: string): void {
  if (!SAFE_SEGMENT.test(segment) || segment.includes("..")) {
    throw new Error(`Unsafe ${what}: ${JSON.stringify(segment)}`);
  }
}

export type SlotKeyParts = {
  floorId: string; // e.g. "44f"
  timeId: string; // e.g. "noon"
  viewId: string; // e.g. "central-sea"
  ext?: string; // default "jpg"
};

/** Relative object key (within a tenant prefix): "44f/noon/central-sea.jpg". */
export function slotObjectKey({ floorId, timeId, viewId, ext = "jpg" }: SlotKeyParts): string {
  assertSafeSegment(floorId, "floorId");
  assertSafeSegment(timeId, "timeId");
  assertSafeSegment(viewId, "viewId");
  assertSafeSegment(ext, "ext");
  return `${floorId}/${timeId}/${viewId}.${ext}`;
}

/**
 * Per-revision slot key for NON-DESTRUCTIVE uploads (never overwrites the live image):
 * "44f/noon/central-sea.k7f3a9.jpg". The Worker mints `rev` on each upload.
 */
export function slotRevObjectKey({
  floorId,
  timeId,
  viewId,
  rev,
  ext = "jpg",
}: SlotKeyParts & { rev: string }): string {
  assertSafeSegment(floorId, "floorId");
  assertSafeSegment(timeId, "timeId");
  assertSafeSegment(viewId, "viewId");
  assertSafeSegment(rev, "rev");
  assertSafeSegment(ext, "ext");
  return `${floorId}/${timeId}/${viewId}.${rev}.${ext}`;
}

/** Relative branding key: "branding/logo-primary.png". */
export function brandingObjectKey(filename: string): string {
  assertSafeSegment(filename, "branding filename");
  return `branding/${filename}`;
}

/** Full bucket key = tenant prefix + relative key. Guards against prefix escape. */
export function tenantBucketKey(slug: string, relativeKey: string): string {
  assertSafeSegment(slug, "slug");
  if (relativeKey.startsWith("/") || relativeKey.includes("..")) {
    throw new Error(`Unsafe relative key: ${JSON.stringify(relativeKey)}`);
  }
  return `${slug}/${relativeKey}`;
}

/** KV key holding a tenant's config document: "config:marina-one". */
export function configKvKey(slug: string): string {
  assertSafeSegment(slug, "slug");
  return `config:${slug}`;
}

/** KV key holding a tenant's DRAFT config (the builder's working copy): "config:marina-one:draft". */
export function configDraftKvKey(slug: string): string {
  assertSafeSegment(slug, "slug");
  return `config:${slug}:draft`;
}

/** R2 key for a versioned config backup: "marina-one/_config-history/7.json". */
export function configHistoryKey(slug: string, version: number): string {
  assertSafeSegment(slug, "slug");
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(`Invalid config version: ${version}`);
  }
  return `${slug}/_config-history/${version}.json`;
}
