/**
 * AUTHORITATIVE Marina One reference data — frozen during Phase 1 to resolve RISK #1
 * (a cross-file floor↔elevation discrepancy in the source repo).
 *
 * THREE sources AGREE on this table and are authoritative:
 *   - scripts/migrate-assets.ts  (it actually places the R2 objects; comments: "Corrected per review")
 *   - ashwinsheth-group/panaroma-v2/lib/panoramaConfig.ts
 *   - lib/panoramaConfig.simple.ts
 * ONE source is WRONG and must NOT be used for elevation:
 *   - scripts/generate-config-from-manifest.ts  (its FLOOR_ELEVATION scrambles 56/60/64/68)
 *
 * R2 objects are keyed by floor NUMBER ("44f/noon/central-sea.jpg"), so images are placed
 * correctly regardless of this table; the table governs the DISPLAYED elevation only.
 */

/** floor number → elevation in metres (the frozen, corrected table). */
export const MARINA_ONE_FLOOR_ELEVATION: Readonly<Record<number, number>> = Object.freeze({
  44: 154,
  48: 167,
  52: 182,
  56: 196,
  60: 210,
  64: 224,
  68: 238,
  72: 252,
  75: 266,
});

/** Ordered floor numbers as shipped for Marina One. */
export const MARINA_ONE_FLOOR_NUMBERS: readonly number[] = Object.freeze([
  44, 48, 52, 56, 60, 64, 68, 72, 75,
]);

/** Canonical time axis — `id`s match the R2 key segments (`/<floor>f/<timeId>/<viewId>.jpg`). */
export const MARINA_ONE_TIMES = Object.freeze([
  { id: "sunrise", label: "Morning", icon: "sunrise" },
  { id: "noon", label: "Day", icon: "sun" },
  { id: "sunset", label: "Evening", icon: "sunset" },
  { id: "night", label: "Night", icon: "moon" },
] as const);

/** Canonical view-direction axis — `id`s match the R2 key segments. */
export const MARINA_ONE_VIEWS = Object.freeze([
  { id: "central-sea", label: "Sea View" },
  { id: "marine-line", label: "Bandra-Worli Sea Link" },
  { id: "stadium", label: "Stadium View" },
] as const);

/** Build the canonical floor id used in R2 keys + config, e.g. 44 -> "44f". */
export function floorIdFromNumber(floorNumber: number): string {
  return `${floorNumber}f`;
}

/** Build the human floor label, e.g. 44 -> "44th Floor". */
export function floorLabelFromNumber(floorNumber: number): string {
  const j = floorNumber % 10;
  const k = floorNumber % 100;
  let suffix = "th";
  if (j === 1 && k !== 11) suffix = "st";
  else if (j === 2 && k !== 12) suffix = "nd";
  else if (j === 3 && k !== 13) suffix = "rd";
  return `${floorNumber}${suffix} Floor`;
}
