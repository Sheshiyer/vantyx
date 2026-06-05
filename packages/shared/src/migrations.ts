/**
 * Migrate a raw stored config document up to the current schema version, then validate.
 * Phase 1 has exactly one schema version, so today this is the identity migration — but the
 * seam exists now so a future shape change can migrate-on-read in the Worker without breaking
 * already-provisioned tenants.
 */
import { CURRENT_SCHEMA_VERSION, parseTenantConfig, type TenantConfig } from "./schema";

type MigrationStep = (doc: unknown) => unknown;

/** Ordered steps, keyed by the `schemaVersion` they upgrade FROM. */
const STEPS: Record<number, MigrationStep> = {
  // 1: (doc) => ({ ...(doc as object), schemaVersion: 2 /* , new fields */ }),
};

export function migrateToCurrent(raw: unknown): TenantConfig {
  const doc = (raw && typeof raw === "object" ? raw : {}) as { schemaVersion?: number };
  let version =
    typeof doc.schemaVersion === "number" ? doc.schemaVersion : CURRENT_SCHEMA_VERSION;

  let migrated: unknown = raw;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = STEPS[version];
    if (!step) break;
    migrated = step(migrated);
    version += 1;
  }

  return parseTenantConfig(migrated);
}
