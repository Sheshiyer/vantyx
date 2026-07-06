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
