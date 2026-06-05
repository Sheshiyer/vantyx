/**
 * The productized `TenantConfig` — the single document that drives a tenant's viewer.
 * Generalized from the original `panoramaConfig.ts` (nested enum keys) into a data-driven
 * shape: `views`/`times` are arrays of `{id,label}`, and each filled cell is a flat `slot`
 * whose `image` is an R2 object KEY (not a URL — resolved at runtime). `hotspots`/`lead`
 * are defined-but-empty Phase-2 seams so the schema won't have to break to add them.
 */
import { z } from "zod";
import { SLUG_PATTERN } from "./tenant";

export const CURRENT_SCHEMA_VERSION = 1;

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "must be a #RRGGBB hex color");

const kebabId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, "id must be lowercase kebab-case");

/** A selectable axis item — a view-direction or a time-of-day. */
export const AxisItemSchema = z.object({
  id: kebabId,
  label: z.string().min(1),
  /** Optional icon name the viewer maps to a lucide icon (e.g. "sun"). */
  icon: z.string().optional(),
});
export type AxisItem = z.infer<typeof AxisItemSchema>;

/** Phase-2 seam: a clickable hotspot inside a panorama. Validated now, unused in MVP. */
export const HotspotSchema = z.object({
  id: z.string(),
  yaw: z.number().min(-180).max(180),
  pitch: z.number().min(-90).max(90),
  title: z.string(),
  content: z.string().default(""),
  icon: z.string().default("info"),
  type: z.enum(["info", "scene", "link"]).default("info"),
  url: z.string().optional(),
});
export type Hotspot = z.infer<typeof HotspotSchema>;

/** One filled cell of the floor × view × time matrix. */
export const SlotSchema = z.object({
  viewId: z.string(),
  timeId: z.string(),
  enabled: z.boolean().default(true),
  /** R2 object key relative to the tenant prefix, e.g. "44f/noon/central-sea.jpg". NOT a URL. */
  image: z.string().min(1),
  defaultYaw: z.number().optional(),
  defaultPitch: z.number().optional(),
  hfov: z.number().min(30).max(150).optional(),
  viewingAngle: z.number().optional(),
  hotspots: z.array(HotspotSchema).default([]),
});
export type Slot = z.infer<typeof SlotSchema>;

export const FloorSchema = z.object({
  /** Stable id used in R2 keys, e.g. "44f". FROZEN — renaming the label must not change this. */
  id: kebabId,
  label: z.string().min(1),
  /** Display elevation in metres, decoupled from `id` (see mapping.ts). */
  elevation: z.number().optional(),
  floorNumber: z.number().optional(),
  order: z.number().default(0),
  slots: z.array(SlotSchema).default([]),
});
export type Floor = z.infer<typeof FloorSchema>;

export const BrandingSchema = z.object({
  appTitle: z.string().min(1),
  tagline: z.string().optional(),
  /** R2 key of the primary logo. */
  logo: z.string().optional(),
  /** R2 keys of partner/secondary logos. */
  secondaryLogos: z.array(z.string()).default([]),
  primaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
});
export type Branding = z.infer<typeof BrandingSchema>;

export const ViewerDefaultsSchema = z.object({
  autoLoad: z.boolean().default(false),
  minHfov: z.number().default(50),
  maxHfov: z.number().default(120),
  defaultHfov: z.number().default(90),
  mobileHfov: z.number().default(120),
  autoRotate: z.number().default(-2),
  autoRotateSpeed: z.number().default(-2),
  inactivityTimeoutMs: z.number().default(8000),
  compass: z.boolean().default(false),
  sceneFadeDuration: z.number().default(1000),
});
export type ViewerDefaults = z.infer<typeof ViewerDefaultsSchema>;

export const TenantBlockSchema = z.object({
  slug: z.string().regex(SLUG_PATTERN, "invalid tenant slug"),
  name: z.string().min(1),
  /** Optional free-form metadata (e.g. RERA registration) shown in the header. */
  rera: z.string().optional(),
});
export type TenantBlock = z.infer<typeof TenantBlockSchema>;

/** Phase-2 seam: lead-capture config; `null` in MVP. */
export const LeadConfigSchema = z.object({
  enabled: z.boolean().default(false),
  ctaLabel: z.string().default("Enquire"),
  fields: z.array(z.string()).default(["name", "email", "phone"]),
  webhookUrl: z.string().url().optional(),
});
export type LeadConfig = z.infer<typeof LeadConfigSchema>;

export const TenantConfigSchema = z.object({
  /** Shape version — bumped only on a schema migration (see migrations.ts). */
  schemaVersion: z.number().int().default(CURRENT_SCHEMA_VERSION),
  /** Monotonic content revision — bumped on every admin publish (optimistic concurrency). */
  version: z.number().int().nonnegative().default(1),
  updatedAt: z.string().optional(),
  tenant: TenantBlockSchema,
  branding: BrandingSchema,
  viewerDefaults: ViewerDefaultsSchema.default({}),
  views: z.array(AxisItemSchema).min(1),
  times: z.array(AxisItemSchema).min(1),
  floors: z.array(FloorSchema).default([]),
  lead: LeadConfigSchema.nullable().default(null),
});
export type TenantConfig = z.infer<typeof TenantConfigSchema>;

/** Parse + validate (throws ZodError on failure). */
export function parseTenantConfig(data: unknown): TenantConfig {
  return TenantConfigSchema.parse(data);
}

/** Non-throwing parse — returns a discriminated `{ success, data | error }`. */
export function safeParseTenantConfig(data: unknown) {
  return TenantConfigSchema.safeParse(data);
}
