/**
 * Generate the Marina One TenantConfig (the full 108-slot matrix) from the FROZEN mapping +
 * canonical axes, validate it against the schema, and write seed/marina-one.config.json.
 *
 * This is the Phase-1 seed loaded into KV (`config:marina-one`) and the reference the CLI's
 * `new-client` template is derived from. Run: `bun scripts/generate-marina-config.ts`
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import {
  MARINA_ONE_FLOOR_NUMBERS,
  MARINA_ONE_FLOOR_ELEVATION,
  MARINA_ONE_TIMES,
  MARINA_ONE_VIEWS,
  floorIdFromNumber,
  floorLabelFromNumber,
  slotObjectKey,
  brandingObjectKey,
  parseTenantConfig,
  type TenantConfig,
} from "@panorama/shared";

const draft = {
  tenant: { slug: "marina-one", name: "Marina One" },
  branding: {
    appTitle: "One Marina — 360° Experience",
    tagline: "Ashwin Sheth Group",
    logo: brandingObjectKey("logo-primary.png"),
    secondaryLogos: [brandingObjectKey("ashwin-sheth.png"), brandingObjectKey("ym-infra.png")],
  },
  views: MARINA_ONE_VIEWS.map((v) => ({ id: v.id, label: v.label })),
  times: MARINA_ONE_TIMES.map((t) => ({ id: t.id, label: t.label, icon: t.icon })),
  floors: MARINA_ONE_FLOOR_NUMBERS.map((n, i) => {
    const floorId = floorIdFromNumber(n);
    const slots = MARINA_ONE_TIMES.flatMap((t) =>
      MARINA_ONE_VIEWS.map((v) => ({
        viewId: v.id,
        timeId: t.id,
        enabled: true,
        image: slotObjectKey({ floorId, timeId: t.id, viewId: v.id }),
      })),
    );
    return {
      id: floorId,
      label: floorLabelFromNumber(n),
      elevation: MARINA_ONE_FLOOR_ELEVATION[n],
      floorNumber: n,
      order: i + 1,
      slots,
    };
  }),
};

const config: TenantConfig = parseTenantConfig(draft);

const outPath = resolve(import.meta.dirname, "..", "seed", "marina-one.config.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`);

const slotCount = config.floors.reduce((n, f) => n + f.slots.length, 0);
console.log(
  `✅ marina-one: ${config.floors.length} floors, ${config.views.length}×${config.times.length} axes, ${slotCount} slots → seed/marina-one.config.json`,
);
