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
