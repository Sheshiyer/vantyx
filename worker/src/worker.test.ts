import { test, expect } from "bun:test";
import worker from "./index";
import { configKvKey, parseTenantConfig, type TenantConfig } from "@panorama/shared";
import type { Env } from "./env";

const APEX = "pano.example.com";
const HOST = `marina-one.${APEX}`;

const sampleConfig = parseTenantConfig({
  tenant: { slug: "marina-one", name: "Marina One" },
  branding: { appTitle: "One Marina" },
  views: [{ id: "central-sea", label: "Sea View" }],
  times: [{ id: "noon", label: "Day", icon: "sun" }],
  floors: [
    {
      id: "44f",
      label: "44th Floor",
      elevation: 154,
      slots: [{ viewId: "central-sea", timeId: "noon", image: "44f/noon/central-sea.jpg" }],
    },
  ],
});

function makeEnv(opts: { config?: TenantConfig; assets?: Record<string, string> } = {}): Env {
  const assets = opts.assets ?? {};
  const CONFIG = {
    get: async (key: string) =>
      key === configKvKey("marina-one") && opts.config ? opts.config : null,
  };
  const MEDIA = {
    get: async (key: string) => {
      const body = assets[key];
      if (body === undefined) return null;
      return {
        body: new Response(body).body,
        httpEtag: '"etag"',
        writeHttpMetadata: (h: Headers) => h.set("content-type", "image/jpeg"),
      };
    },
  };
  return { CONFIG, MEDIA, PRODUCT_APEX: APEX } as unknown as Env;
}

const req = (path: string, init?: RequestInit, host = HOST) =>
  new Request(`https://${host}${path}`, init);

test("GET /api/config returns the tenant config", async () => {
  const res = await worker.fetch(req("/api/config"), makeEnv({ config: sampleConfig }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { config: TenantConfig };
  expect(body.config.tenant.slug).toBe("marina-one");
  expect(res.headers.get("etag")).toBe('"v1"');
});

test("GET /api/config 404s an unprovisioned tenant", async () => {
  const res = await worker.fetch(req("/api/config"), makeEnv({}));
  expect(res.status).toBe(404);
});

test("apex host resolves no tenant -> 400", async () => {
  const res = await worker.fetch(req("/api/config", {}, APEX), makeEnv({ config: sampleConfig }));
  expect(res.status).toBe(400);
});

test("If-None-Match matching the version yields 304", async () => {
  const res = await worker.fetch(
    req("/api/config", { headers: { "if-none-match": '"v1"' } }),
    makeEnv({ config: sampleConfig }),
  );
  expect(res.status).toBe(304);
});

test("GET /assets/* streams bytes from R2 with immutable caching", async () => {
  const env = makeEnv({
    config: sampleConfig,
    assets: { "marina-one/44f/noon/central-sea.jpg": "JPEGBYTES" },
  });
  const res = await worker.fetch(req("/assets/44f/noon/central-sea.jpg"), env);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toContain("immutable");
  expect(await res.text()).toBe("JPEGBYTES");
});

test("missing asset -> 404", async () => {
  const res = await worker.fetch(req("/assets/does-not-exist.jpg"), makeEnv({ config: sampleConfig }));
  expect(res.status).toBe(404);
});

test("uploads endpoint is Phase-2 (501)", async () => {
  const res = await worker.fetch(req("/api/uploads", { method: "POST" }), makeEnv({ config: sampleConfig }));
  expect(res.status).toBe(501);
});

test("health check is public", async () => {
  const res = await worker.fetch(req("/api/health", {}, APEX), makeEnv({}));
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("ok");
});
