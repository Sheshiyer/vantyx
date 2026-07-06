/**
 * Property Co-Author funnel contracts — standalone Zod schemas (do NOT touch TenantConfig).
 * Compliance by construction: the ledger is an earned RANK, never a locked/decreasing price;
 * an EOI is explicitly "not an offer to sell". See docs/plans/2026-07-05-coauthor-m0-de-risk.md.
 */
import { z } from "zod";

export { leadKvKey, leadIndexPrefix } from "./funnelKeys";

const kebabId = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "id must be lowercase kebab-case");

export const IntentSchema = z.enum(["self-use", "investment", "both"]);
export const BudgetTierSchema = z.enum(["under-2cr", "2-5cr", "above-5cr"]);
export const FamilyProfileSchema = z.enum(["single", "couple", "nuclear", "joint"]);
export const TimelineSchema = z.enum(["under-1y", "1-2y", "flexible"]);

/** A buyer lead — created when the hero captures a (consented) phone number. */
export const LeadSchema = z.object({
  leadId: z.string().min(1),
  slug: z.string().min(1),
  phone: z.string().min(6),
  source: z.string().default("hero"),
  consentAt: z.string().optional(), // ISO — DPDP: capture consent timestamp
  createdAt: z.string().optional(),
});
export type Lead = z.infer<typeof LeadSchema>;

/** The structured output of the (external, already-built) AI voice discovery call. */
export const DiscoveryResultSchema = z.object({
  leadId: z.string().min(1),
  slug: z.string().min(1),
  phone: z.string().optional(),
  source: z.string().default("voice"),
  coAuthorScore: z.number().int().min(0).max(100),
  intent: IntentSchema,
  budgetTier: BudgetTierSchema,
  familyProfile: FamilyProfileSchema.optional(),
  priority: z.enum(["location", "space", "design", "amenities", "returns"]).optional(),
  style: z.enum(["minimalist", "traditional", "contemporary", "eclectic"]).optional(),
  timeline: TimelineSchema.optional(),
  decisionMakers: z.array(z.string()).default([]),
  /** Anything the voice stack sends that we don't model yet — preserved, not dropped. */
  raw: z.record(z.unknown()).optional(),
  receivedAt: z.string().optional(),
});
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;

/** Where the score routes the lead. With one property, this is tier/segment, not property choice. */
export const RoutingSchema = z.object({
  leadId: z.string().min(1),
  propertyId: z.string().min(1),
  tier: z.enum(["priority", "standard", "nurture", "education"]),
  landingVariant: z.string().default("default"),
});
export type Routing = z.infer<typeof RoutingSchema>;

/** A single customization axis option (mirrors AxisItemSchema in schema.ts). */
export const CustomizationOptionSchema = z.object({
  axis: kebabId,          // e.g. "finish", "palette", "layout"
  id: kebabId,            // e.g. "walnut-warm"
  label: z.string().min(1),
  priceDeltaInr: z.number().int().default(0),
});
export type CustomizationOption = z.infer<typeof CustomizationOptionSchema>;

/** A curated starting point — the guardrail against 20-option choice paralysis. */
export const StarterPackSchema = z.object({
  id: kebabId,
  label: z.string().min(1),
  /** axis → optionId, e.g. { finish: "walnut-warm", palette: "sand" }. */
  selections: z.record(z.string()),
});
export type StarterPack = z.infer<typeof StarterPackSchema>;

/** The buyer's in-progress design — persisted per lead+property; resumable across the 18–36 mo gap. */
export const CustomizationStateSchema = z.object({
  leadId: z.string().min(1),
  slug: z.string().min(1),
  propertyId: z.string().min(1),
  starterPackId: z.string().optional(),
  /** axis → optionId. */
  selections: z.record(z.string()).default({}),
  updatedAt: z.string().optional(),
});
export type CustomizationState = z.infer<typeof CustomizationStateSchema>;

/**
 * Transparent EARNED-RANK ledger. Compliance-critical: NO locked/decreasing price field exists here.
 * `earnedRankBps` = engagement-earned priority in basis points; `disclosedSavings` is descriptive only.
 */
export const EarnedRankLedgerSchema = z.object({
  leadId: z.string().min(1),
  basePriceInr: z.number().int().nonnegative(),
  customizationDeltaInr: z.number().int().default(0),
  earnedRankBps: z.number().int().min(0).max(2000).default(0),
  disclosedSavingsInr: z.number().int().default(0),
  rankPosition: z.number().int().positive().optional(),
});
export type EarnedRankLedger = z.infer<typeof EarnedRankLedgerSchema>;

/** Optional paid design-service fee (the strategic keystone). Never credited to a unit. */
export const DesignFeeSchema = z.object({
  leadId: z.string().min(1),
  amountInr: z.number().int().positive(),
  currency: z.enum(["INR", "USD", "AED"]).default("INR"),
  status: z.enum(["pending", "paid", "refunded"]).default("pending"),
  creditedToUnit: z.literal(false).default(false), // compliance: must stay false
  gstInvoiceId: z.string().optional(),
});
export type DesignFee = z.infer<typeof DesignFeeSchema>;

/** Zero-consideration Expression of Interest — explicitly not an offer to sell. */
export const EoiSchema = z.object({
  leadId: z.string().min(1),
  slug: z.string().min(1),
  propertyId: z.string().min(1),
  designSnapshotId: z.string().min(1),
  rankPosition: z.number().int().positive().optional(),
  status: z.literal("expression-of-interest").default("expression-of-interest"),
  notAnOfferToSell: z.literal(true).default(true),
  createdAt: z.string().optional(),
});
export type Eoi = z.infer<typeof EoiSchema>;

export const parseDiscoveryResult = (d: unknown): DiscoveryResult => DiscoveryResultSchema.parse(d);
export const safeParseDiscoveryResult = (d: unknown) => DiscoveryResultSchema.safeParse(d);
export const parseCustomizationState = (d: unknown): CustomizationState => CustomizationStateSchema.parse(d);
export const safeParseCustomizationState = (d: unknown) => CustomizationStateSchema.safeParse(d);
export const parseEoi = (d: unknown): Eoi => EoiSchema.parse(d);
export const safeParseEoi = (d: unknown) => EoiSchema.safeParse(d);
