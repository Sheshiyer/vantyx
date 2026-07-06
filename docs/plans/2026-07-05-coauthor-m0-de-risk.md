# Co-Author Funnel — Milestone M0 (De-risk & Contracts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the data contracts, the voice-call integration seam, and the buyer-identity primitive for the Property Co-Author funnel — with zero user-facing UI — so every later milestone builds on validated, grounded foundations.

**Architecture:** The funnel reuses the existing Vantyx panorama platform. M0 adds a new **standalone** contracts module (`@panorama/shared/funnel`) that does NOT touch `TenantConfig` (so no schema migration), plus Worker routes that follow the existing `route()` + `env.CONFIG`(KV) + `captureEvent` patterns. The AI voice call (already built, external) integrates through a single authenticated webhook that maps its payload → a `DiscoveryResult` and mints a magic-link lead token.

**Tech Stack:** Bun workspace monorepo · TypeScript 5.7 · Zod 3.24 · Cloudflare Workers (KV `CONFIG`, R2 `MEDIA`) · PostHog telemetry (wired) · Pannellum 360° viewer (unchanged, marketing panoramas) + React Three Fiber (three.js) live 3D configurator for customization (React 19 / Vite 6 / Tailwind 4). Tests run under `bun test`.

## Global Constraints

- **No `TenantConfig` migration in M0.** All new schemas live in `packages/shared/src/funnel.ts` as standalone Zod objects. Touching `schema.ts`/`TenantConfig` requires a `migrations.ts` bump — out of scope for M0.
- **Zod style must match `schema.ts`:** `z.object`, exported `*Schema` const + `export type X = z.infer<typeof XSchema>`, `parseX`/`safeParseX` helpers, `kebabId` for ids.
- **Compliance is a hard rule (carried from the strategy brief):** the ledger is an **earned priority RANK**, never a locked/decreasing price; every buyer-facing field is "not an offer to sell". Contract field names must not imply a booking (`rank`, `earnedRankBps`, `disclosedSavings` — never `lockedPrice`, `discount`, `reservation`).
- **Worker routes mirror existing patterns:** resolve tenant via `resolveSlug`; respond with `json()` / `apiError()` from `./http`; emit analytics via `captureEvent(env, ctx, userId, event, props)`; a public webhook mirrors the `/api/telemetry` (no-auth, secret-guarded) shape.
- **IDs & storage:** kebab-case ids; camelCase fields; leads stored in a dedicated `LEADS` KV binding under key `lead:<slug>:<leadId>`; image references are R2 keys, never URLs.
- **The one external dependency:** the exact field mapping in `toDiscoveryResult()` (Task 3) must be reconciled with the real voice-stack webhook payload before M1. M0 ships a permissive, passthrough-preserving adapter with that mapping isolated to one function.

---

## File Structure

**Create:**
- `docs/plans/adr/2026-07-05-viewer-and-asset-pipeline.md` — decision record (Task 0)
- `packages/shared/src/funnel.ts` — all funnel Zod contracts (Task 1)
- `packages/shared/src/funnelKeys.ts` — KV key helpers for leads (Task 1)
- `packages/shared/src/funnel.test.ts` — contract tests (Task 1)
- `worker/src/leadToken.ts` — HMAC magic-link lead token (Task 2)
- `worker/src/leadToken.test.ts` — token tests (Task 2)
- `worker/src/funnelRoutes.ts` — discovery webhook + lead store (Task 3)
- `worker/src/funnelRoutes.test.ts` — webhook tests (Task 3)

**Modify:**
- `packages/shared/src/index.ts` — re-export `./funnel` and `./funnelKeys` (Task 1)
- `worker/src/env.ts` — add `LEADS` KV + `FUNNEL_WEBHOOK_SECRET` bindings (Task 4)
- `worker/src/index.ts:87-194` — add `/api/discovery` route inside `route()` (Task 3)
- `worker/wrangler.toml` (or `worker/wrangler.jsonc`) — declare `LEADS` KV namespace (Task 4)

Each file has one responsibility: contracts are pure data (no I/O), the token module is pure crypto, the routes module owns lead I/O + orchestration.

---

## Task 0: Decision Record — Viewer model & asset pipeline

**Deliverable (non-code, gating):** `docs/plans/adr/2026-07-05-viewer-and-asset-pipeline.md` capturing the two decisions that unblock M1. Acceptance = written, and cross-checked against the Panorama-Webapp code map (Explore agent output) when available.

- [ ] **Step 1: Write the ADR** with these decisions and evidence:

  **Decision A — Customization rendering model (revised 2026-07-06 — reconciled with M1):** The existing **Pannellum** viewer (`apps/viewer/src/lib/pannellumLoader.ts`, `apps/viewer/src/types/pannellum.d.ts`) is unchanged and continues to serve the non-customizable marketing panoramas (`views × times × floors.slots`, `packages/shared/src/schema.ts:43-68`). The **customization experience is a client-side React Three Fiber (three.js) live 3D scene**, one villa unit, rendering entirely in the buyer's browser — matching the approach validated in the M1 client-pitch demo (`ratandevelopers/.docs/plans/2026-07-05-coauthor-m1-possibilities-demo.md`). **Accepted:** R3F for real-time material swaps — the no-render-farm constraint is satisfied because all rendering is client-side (no server GPU cost); the "instant" material swap is the showcase's core differentiator and a pre-baked image matrix could not deliver it. **Rejected:** curated pre-baked image-variant selection for the *customizable* villa (would need combinatorial R2 asset generation per finish × palette × flooring and loses the live-swap feel) — image variants remain the right model only for the fixed marketing panoramas, which are out of scope for the funnel.

  **Decision B — Combinatorics guardrail (revised):** guardrail moves from "image count" to "3D asset weight," lifted directly from M1's Global Constraints so M0 and M1 share one rendering contract: one villa unit; **3–5 curated "starter packs"**; ≤ 3 swappable axes (finish, palette, flooring), ≤ 4 options each, mapped to three.js material props (`color`/`roughness`/`metalness`) rather than baked images; draco-compressed glTF (or procedural-geometry fallback when no model is authored yet) keeps payload small; texture atlases ≤ 1024²; instanced furniture; `dpr={[1, 2]}` cap; a still-image low-power fallback when `navigator.hardwareConcurrency <= 4`. The `StarterPack` contract (Task 1) encodes the starter-pack bound; option/axis bounds are enforced in config, not the schema. Free-form/unbounded options are out of scope.

  **Decision C — Data-model extension path (revised):** A customization axis still mirrors `AxisItemSchema`'s shape (`axis`/`id`/`label`) but resolves to three.js material properties via a mapping table (mirrors M1's `useMaterialSwap`), not to a pre-rendered image slot — no `viewId`/`timeId` slot resolution for the customizable villa. Production still needs a `TenantConfig` migration in M1-real to carry the villa's `modelUrl`/axis config (documented as a downstream dependency, not done in M0) — the migration is smaller now (one config blob, not a slot-image matrix). The existing Pannellum `views × times × floors.slots` matrix in `schema.ts` is untouched.

- [ ] **Step 2: Commit**

```bash
git add docs/plans/adr/2026-07-05-viewer-and-asset-pipeline.md
git commit -m "docs: ADR for co-author viewer model + asset pipeline"
```

---

## Task 1: Funnel data contracts (`@panorama/shared/funnel`)

**Files:**
- Create: `packages/shared/src/funnel.ts`
- Create: `packages/shared/src/funnelKeys.ts`
- Create: `packages/shared/src/funnel.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `LeadSchema/Lead`, `DiscoveryResultSchema/DiscoveryResult`, `RoutingSchema/Routing`, `CustomizationOptionSchema/CustomizationOption`, `StarterPackSchema/StarterPack`, `CustomizationStateSchema/CustomizationState`, `EarnedRankLedgerSchema/EarnedRankLedger`, `EoiSchema/Eoi`, `DesignFeeSchema/DesignFee`, plus `parseDiscoveryResult`, `safeParseDiscoveryResult`, `parseCustomizationState`, `safeParseCustomizationState`, `parseEoi`, `safeParseEoi`. Key helpers: `leadKvKey(slug, leadId)`, `leadIndexPrefix(slug)`.

- [ ] **Step 1: Write the failing contract tests** — `packages/shared/src/funnel.test.ts`

```ts
import { test, expect } from "bun:test";
import {
  DiscoveryResultSchema,
  parseDiscoveryResult,
  safeParseDiscoveryResult,
  CustomizationStateSchema,
  EarnedRankLedgerSchema,
  EoiSchema,
  StarterPackSchema,
  leadKvKey,
} from "./funnel";
import { leadKvKey as keyFromKeys } from "./funnelKeys";

test("DiscoveryResult accepts a valid payload and defaults optional fields", () => {
  const r = parseDiscoveryResult({
    leadId: "ld_abc123",
    slug: "ratan-kodigehalli",
    phone: "+919999999999",
    coAuthorScore: 78,
    intent: "self-use",
    budgetTier: "2-5cr",
    familyProfile: "nuclear",
    priority: "design",
    style: "contemporary",
    timeline: "1-2y",
    decisionMakers: ["self", "spouse"],
  });
  expect(r.coAuthorScore).toBe(78);
  expect(r.source).toBe("voice"); // defaulted
});

test("DiscoveryResult rejects an out-of-range score", () => {
  const res = safeParseDiscoveryResult({
    leadId: "ld_abc123", slug: "ratan-kodigehalli", coAuthorScore: 250,
    intent: "self-use", budgetTier: "2-5cr",
  });
  expect(res.success).toBe(false);
});

test("EarnedRankLedger forbids a locked/decreasing price shape (rank-only)", () => {
  const parsed = EarnedRankLedgerSchema.parse({
    leadId: "ld_abc123",
    basePriceInr: 45000000,
    earnedRankBps: 350,
    disclosedSavingsInr: 1500000,
    rankPosition: 12,
  });
  expect(parsed.earnedRankBps).toBe(350);
  // The schema has no `lockedPrice`/`discount` field — compliance by construction.
  expect("lockedPrice" in parsed).toBe(false);
});

test("Eoi is explicitly not-an-offer-to-sell and carries a design snapshot ref", () => {
  const e = EoiSchema.parse({
    leadId: "ld_abc123", slug: "ratan-kodigehalli",
    propertyId: "villa-a", designSnapshotId: "snap_1", rankPosition: 12,
  });
  expect(e.status).toBe("expression-of-interest");
  expect(e.notAnOfferToSell).toBe(true);
});

test("StarterPack bounds options (guardrail against choice paralysis)", () => {
  const p = StarterPackSchema.parse({
    id: "warm-contemporary", label: "Warm Contemporary",
    selections: { finish: "walnut-warm", palette: "sand" },
  });
  expect(p.id).toBe("warm-contemporary");
});

test("leadKvKey is namespaced by slug", () => {
  expect(leadKvKey("ratan-kodigehalli", "ld_abc123")).toBe("lead:ratan-kodigehalli:ld_abc123");
  expect(keyFromKeys("ratan-kodigehalli", "ld_abc123")).toBe("lead:ratan-kodigehalli:ld_abc123");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && bun test src/funnel.test.ts`
Expected: FAIL — cannot resolve `./funnel` / `./funnelKeys`.

- [ ] **Step 3: Write `packages/shared/src/funnelKeys.ts`**

```ts
/** KV key helpers for buyer leads. Leads live in the LEADS namespace, namespaced by tenant slug. */
export function leadKvKey(slug: string, leadId: string): string {
  return `lead:${slug}:${leadId}`;
}
export function leadIndexPrefix(slug: string): string {
  return `lead:${slug}:`;
}
```

- [ ] **Step 4: Write `packages/shared/src/funnel.ts`** (mirrors `schema.ts` conventions)

```ts
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
```

- [ ] **Step 5: Re-export from `packages/shared/src/index.ts`** — add after the existing exports:

```ts
export * from "./funnel";
export * from "./funnelKeys";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/shared && bun test src/funnel.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Typecheck the workspace**

Run: `cd packages/shared && bun run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/funnel.ts packages/shared/src/funnelKeys.ts packages/shared/src/funnel.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): co-author funnel contracts (compliance-safe rank ledger, EOI, discovery)"
```

---

## Task 2: Buyer magic-link lead token

**Files:**
- Create: `worker/src/leadToken.ts`
- Create: `worker/src/leadToken.test.ts`

**Interfaces:**
- Consumes: `env.AUTH_SECRET` (existing HMAC secret from `env.ts:17`).
- Produces: `signLeadToken(payload, secret): Promise<string>`, `verifyLeadToken(token, secret): Promise<LeadTokenPayload | null>`. `LeadTokenPayload = { leadId: string; slug: string; exp: number }`.

- [ ] **Step 1: Write failing tests** — `worker/src/leadToken.test.ts`

```ts
import { test, expect } from "bun:test";
import { signLeadToken, verifyLeadToken } from "./leadToken";

const SECRET = "test-secret-value";

test("a freshly signed token verifies and round-trips the payload", async () => {
  const token = await signLeadToken({ leadId: "ld_1", slug: "ratan-kodigehalli", exp: Date.now() + 60_000 }, SECRET);
  const payload = await verifyLeadToken(token, SECRET);
  expect(payload?.leadId).toBe("ld_1");
  expect(payload?.slug).toBe("ratan-kodigehalli");
});

test("a tampered token fails verification", async () => {
  const token = await signLeadToken({ leadId: "ld_1", slug: "s", exp: Date.now() + 60_000 }, SECRET);
  const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
  expect(await verifyLeadToken(tampered, SECRET)).toBeNull();
});

test("an expired token fails verification", async () => {
  const token = await signLeadToken({ leadId: "ld_1", slug: "s", exp: Date.now() - 1 }, SECRET);
  expect(await verifyLeadToken(token, SECRET)).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && bun test src/leadToken.test.ts`
Expected: FAIL — `./leadToken` not found.

- [ ] **Step 3: Implement `worker/src/leadToken.ts`** (WebCrypto HMAC-SHA256, base64url, no deps)

```ts
export interface LeadTokenPayload {
  leadId: string;
  slug: string;
  exp: number; // epoch ms
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(sig);
}

/** token = base64url(payloadJson) + "." + base64url(hmac). */
export async function signLeadToken(payload: LeadTokenPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await hmac(body, secret);
  return `${body}.${sig}`;
}

export async function verifyLeadToken(token: string, secret: string): Promise<LeadTokenPayload | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(body, secret);
  // constant-time-ish compare
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as LeadTokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && bun test src/leadToken.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/leadToken.ts worker/src/leadToken.test.ts
git commit -m "feat(worker): HMAC magic-link lead token for anonymous buyer sessions"
```

---

## Task 3: Discovery webhook adapter + lead store

**Files:**
- Create: `worker/src/funnelRoutes.ts`
- Create: `worker/src/funnelRoutes.test.ts`
- Modify: `worker/src/index.ts:87-194` (add the route)

**Interfaces:**
- Consumes: `Env.LEADS` (Task 4), `Env.FUNNEL_WEBHOOK_SECRET` (Task 4), `Env.AUTH_SECRET`; `resolveSlug` (`./tenant`), `json`/`apiError` (`./http`), `captureEvent` (`./telemetry`); `DiscoveryResultSchema`, `LeadSchema`, `leadKvKey`, `RoutingSchema` (`@panorama/shared`); `signLeadToken` (`./leadToken`).
- Produces: `handleDiscovery(slug, request, env, ctx): Promise<Response>`; internal `toDiscoveryResult(raw, leadId, slug): unknown` — **the single mapping to reconcile with the real voice payload.**

- [ ] **Step 1: Write failing tests** — `worker/src/funnelRoutes.test.ts` (in-memory KV fake, mirrors `worker.test.ts`)

```ts
import { test, expect } from "bun:test";
import { handleDiscovery } from "./funnelRoutes";
import { leadKvKey } from "@panorama/shared";

function fakeKv() {
  const m = new Map<string, string>();
  return {
    store: m,
    async get(k: string, _t?: string) { const v = m.get(k); return v == null ? null : (_t === "json" ? JSON.parse(v) : v); },
    async put(k: string, v: string) { m.set(k, v); },
    async list() { return { objects: [], keys: [] }; },
  } as unknown as KVNamespace;
}
function env(overrides: Record<string, unknown> = {}) {
  return { LEADS: fakeKv(), CONFIG: fakeKv(), FUNNEL_WEBHOOK_SECRET: "hook-secret", AUTH_SECRET: "auth-secret", PRODUCT_APEX: "vantyx.test", ...overrides } as any;
}
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

test("rejects a webhook without the shared secret (401)", async () => {
  const req = new Request("https://x/api/discovery", { method: "POST", body: JSON.stringify({}) });
  const res = await handleDiscovery("ratan-kodigehalli", req, env(), ctx);
  expect(res.status).toBe(401);
});

test("accepts a valid voice payload, stores the lead, returns a lead token + landing url", async () => {
  const e = env();
  const req = new Request("https://x/api/discovery", {
    method: "POST",
    headers: { "x-funnel-secret": "hook-secret", "content-type": "application/json" },
    body: JSON.stringify({
      phone: "+919999999999", score: 78, intent: "self-use", budget: "2-5cr",
      family: "nuclear", style: "contemporary", timeline: "1-2y",
    }),
  });
  const res = await handleDiscovery("ratan-kodigehalli", req, e, ctx);
  expect(res.status).toBe(200);
  const body = await res.json() as any;
  expect(body.leadToken).toBeTruthy();
  expect(body.landingUrl).toContain(body.leadId);
  const stored = e.LEADS.store.get(leadKvKey("ratan-kodigehalli", body.leadId));
  expect(stored).toBeTruthy();
  expect(JSON.parse(stored).discovery.coAuthorScore).toBe(78);
});

test("a malformed payload after mapping is a 422", async () => {
  const req = new Request("https://x/api/discovery", {
    method: "POST",
    headers: { "x-funnel-secret": "hook-secret", "content-type": "application/json" },
    body: JSON.stringify({ score: 999 }), // out of range, no intent
  });
  const res = await handleDiscovery("ratan-kodigehalli", req, env(), ctx);
  expect(res.status).toBe(422);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && bun test src/funnelRoutes.test.ts`
Expected: FAIL — `./funnelRoutes` not found.

- [ ] **Step 3: Implement `worker/src/funnelRoutes.ts`**

```ts
import type { Env } from "./env";
import { json, apiError } from "./http";
import { captureEvent } from "./telemetry";
import { signLeadToken } from "./leadToken";
import {
  safeParseDiscoveryResult,
  RoutingSchema,
  leadKvKey,
  type DiscoveryResult,
  type Routing,
} from "@panorama/shared";

const LEAD_TTL_MS = 1000 * 60 * 60 * 24 * 400; // ~13 months; the wait window is longer, refreshed on activity

/** Cheap, collision-resistant lead id (no Math.random dependence on determinism needs here). */
function newLeadId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  let s = "";
  for (const b of bytes) s += b.toString(36).padStart(2, "0");
  return `ld_${s}`;
}

/**
 * THE integration seam. Map the external voice-stack webhook payload → our DiscoveryResult shape.
 * ⚠️ Reconcile these field reads with the real voice payload before M1. Everything else is stable.
 */
function toDiscoveryResult(raw: Record<string, unknown>, leadId: string, slug: string): unknown {
  return {
    leadId,
    slug,
    phone: raw.phone,
    source: "voice",
    coAuthorScore: raw.score ?? raw.coAuthorScore,
    intent: raw.intent,
    budgetTier: raw.budget ?? raw.budgetTier,
    familyProfile: raw.family ?? raw.familyProfile,
    priority: raw.priority,
    style: raw.style,
    timeline: raw.timeline,
    decisionMakers: raw.decisionMakers ?? raw.decision_makers ?? [],
    raw,
    receivedAt: new Date().toISOString(),
  };
}

/** With a single property, routing derives a tier/segment from the score — not a property choice. */
function routeLead(d: DiscoveryResult, propertyId: string): Routing {
  const tier =
    d.coAuthorScore >= 70 ? "priority" :
    d.coAuthorScore >= 40 ? "standard" :
    d.budgetTier === "under-2cr" ? "education" : "nurture";
  return RoutingSchema.parse({ leadId: d.leadId, propertyId, tier, landingVariant: d.style ?? "default" });
}

/** POST /api/discovery — the AI voice call posts its structured result here (secret-guarded, no user auth). */
export async function handleDiscovery(slug: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
  const secret = request.headers.get("x-funnel-secret");
  if (!env.FUNNEL_WEBHOOK_SECRET || secret !== env.FUNNEL_WEBHOOK_SECRET) {
    return apiError(401, "unauthorized", "Invalid webhook secret.");
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, "bad_request", "Body must be JSON.");
  }

  const leadId = newLeadId();
  const parsed = safeParseDiscoveryResult(toDiscoveryResult(raw, leadId, slug));
  if (!parsed.success) return apiError(422, "invalid_discovery", "Discovery payload failed validation.");
  const discovery = parsed.data;

  // Single Kodigehalli property for M0/M1. Multi-property routing is M3.
  const propertyId = "villa-a";
  const routing = routeLead(discovery, propertyId);

  const record = { lead: { leadId, slug, phone: discovery.phone ?? "", source: "voice", createdAt: new Date().toISOString() }, discovery, routing };
  await env.LEADS.put(leadKvKey(slug, leadId), JSON.stringify(record), { expirationTtl: Math.floor(LEAD_TTL_MS / 1000) });

  const exp = Date.now() + LEAD_TTL_MS;
  const leadToken = await signLeadToken({ leadId, slug, exp }, env.AUTH_SECRET ?? "dev-secret");
  const landingUrl = `/landing?lead=${leadId}&t=${encodeURIComponent(leadToken)}`;

  captureEvent(env, ctx, leadId, "discovery_received", { slug, tier: routing.tier, score: discovery.coAuthorScore });

  return json({ ok: true, leadId, leadToken, routing, landingUrl });
}
```

- [ ] **Step 4: Wire the route in `worker/src/index.ts`** — add inside `route()` after the `/api/telemetry` block (`worker/src/index.ts:107`), and import at top:

```ts
// top of file, with the other imports:
import { handleDiscovery } from "./funnelRoutes";

// inside route(), after the telemetry block:
if (pathname === "/api/discovery") {
  if (!slug) return needTenant();
  return handleDiscovery(slug, request, env, ctx);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd worker && bun test src/funnelRoutes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full worker suite to confirm no regressions**

Run: `cd worker && bun test`
Expected: PASS (existing `worker.test.ts` + new tests).

- [ ] **Step 7: Commit**

```bash
git add worker/src/funnelRoutes.ts worker/src/funnelRoutes.test.ts worker/src/index.ts
git commit -m "feat(worker): /api/discovery webhook — voice-call → DiscoveryResult + lead token"
```

---

## Task 4: Env bindings, secrets & KV namespace

**Files:**
- Modify: `worker/src/env.ts`
- Modify: `worker/wrangler.toml` (or `wrangler.jsonc` — match the repo's existing format)

**Interfaces:**
- Produces: `Env.LEADS: KVNamespace`, `Env.FUNNEL_WEBHOOK_SECRET?: string`.

- [ ] **Step 1: Extend `worker/src/env.ts`** — add to the `Env` interface:

```ts
  /** Buyer-lead documents, keyed `lead:<slug>:<leadId>`. High-write, separate lifecycle from CONFIG. */
  LEADS: KVNamespace;
  /** Shared secret the external AI voice stack sends as `x-funnel-secret` to POST /api/discovery. */
  FUNNEL_WEBHOOK_SECRET?: string;
```

- [ ] **Step 2: Declare the `LEADS` KV namespace in wrangler config.** First inspect the existing format:

Run: `ls worker/wrangler.* && sed -n '1,60p' worker/wrangler.toml 2>/dev/null || sed -n '1,60p' worker/wrangler.jsonc 2>/dev/null`

Then create the namespace and add the binding (TOML shown; use JSONC equivalent if that's the repo format):

```bash
cd worker && bunx wrangler kv namespace create LEADS
# copy the printed id into wrangler config:
```
```toml
[[kv_namespaces]]
binding = "LEADS"
id = "<paste-id-from-wrangler>"
```

- [ ] **Step 3: Set the webhook secret**

```bash
cd worker && bunx wrangler secret put FUNNEL_WEBHOOK_SECRET
# also add FUNNEL_WEBHOOK_SECRET + a LEADS binding to worker/.dev.vars for local dev
```

- [ ] **Step 4: Typecheck the worker**

Run: `cd worker && bun run typecheck`
Expected: no errors (the new bindings are referenced by Task 3's handler).

- [ ] **Step 5: Commit**

```bash
git add worker/src/env.ts worker/wrangler.toml
git commit -m "chore(worker): add LEADS KV + FUNNEL_WEBHOOK_SECRET bindings for the funnel"
```

---

## Self-Review

**Spec coverage (M0 exit criteria):**
- ✅ Viewer capability + asset-pipeline decision recorded (Task 0) — resolves the #1 unknown.
- ✅ Voice-call integration seam is a single authenticated endpoint with an isolated mapping function (Task 3) — the "integrate it" ask.
- ✅ Compliance-safe contracts: earned-**rank** ledger with no locked-price field; EOI `notAnOfferToSell: true`; design fee `creditedToUnit: false` (Task 1) — carries the strategy brief's legal guardrails into the type system.
- ✅ Buyer identity primitive (magic-link token) for anonymous, resumable leads (Task 2) — the foundation for M2's return/resume.
- ✅ Storage + infra for leads (Task 4).

**Known deferrals (correctly out of M0 scope):** the `TenantConfig` migration for the customization axis (M1); the viewer customization UI (M1); saved-state resume + WhatsApp loop + family co-design (M2); tenant authoring + payments hardening + compliance copy pass (M3).

**The one open external input:** `toDiscoveryResult()` field mapping must be reconciled with the real voice-stack payload before M1 — isolated to one function, flagged in-code.

**Type consistency:** `leadKvKey` is defined once in `funnelKeys.ts` and re-exported through `funnel.ts` + `index.ts`; the Worker imports it from `@panorama/shared`. `DiscoveryResult`/`Routing` types flow from `@panorama/shared` into `funnelRoutes.ts` unchanged.

---

## Execution Handoff

Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.
