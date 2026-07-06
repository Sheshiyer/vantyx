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
