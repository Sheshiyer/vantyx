import { test, expect } from "bun:test";
import worker from "./index";
import {
  configKvKey,
  configDraftKvKey,
  configHistoryKey,
  parseTenantConfig,
  type TenantConfig,
} from "@panorama/shared";
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

type EnvOpts = { config?: TenantConfig; assets?: Record<string, string>; devMode?: boolean };

/** Stateful in-memory mock of the KV + R2 bindings (shared across a request flow). */
function makeEnv(opts: EnvOpts = {}): Env & { _kv: Map<string, string>; _r2: Map<string, string> } {
  const kv = new Map<string, string>();
  const r2 = new Map<string, string>();
  if (opts.config) kv.set(configKvKey("marina-one"), JSON.stringify(opts.config));
  for (const [k, v] of Object.entries(opts.assets ?? {})) r2.set(k, v);

  const CONFIG = {
    get: async (key: string, type?: string) => {
      const v = kv.get(key);
      if (v === undefined) return null;
      return type === "json" ? JSON.parse(v) : v;
    },
    put: async (key: string, value: string) => {
      kv.set(key, value);
    },
  };
  const MEDIA = {
    get: async (key: string) => {
      const v = r2.get(key);
      if (v === undefined) return null;
      return {
        body: new Response(v).body,
        httpEtag: '"etag"',
        writeHttpMetadata: (h: Headers) => h.set("content-type", "image/jpeg"),
        json: async () => JSON.parse(v),
      };
    },
    put: async (key: string, value: unknown) => {
      r2.set(key, typeof value === "string" ? value : await new Response(value as BodyInit).text());
    },
  };
  const env = {
    CONFIG,
    MEDIA,
    PRODUCT_APEX: APEX,
    DEV_MODE: opts.devMode === false ? undefined : "1",
  } as unknown as Env;
  return Object.assign(env, { _kv: kv, _r2: r2 });
}

const req = (path: string, init?: RequestInit, host = HOST) =>
  new Request(`https://${host}${path}`, init);

const jsonReq = (path: string, method: string, body: unknown) =>
  req(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// ---- read-path (unchanged behaviour) ----

test("GET /api/config returns the live config + ETag", async () => {
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

test("GET /assets/* streams from R2 with immutable caching", async () => {
  const env = makeEnv({
    config: sampleConfig,
    assets: { "marina-one/44f/noon/central-sea.jpg": "JPEGBYTES" },
  });
  const res = await worker.fetch(req("/assets/44f/noon/central-sea.jpg"), env);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toContain("immutable");
  expect(await res.text()).toBe("JPEGBYTES");
});

test("health check is public", async () => {
  const res = await worker.fetch(req("/api/health", {}, APEX), makeEnv({}));
  expect(res.status).toBe(200);
});

// ---- write-path ----

test("POST /api/uploads stores at a new rev key (non-destructive) and returns it", async () => {
  const env = makeEnv({ config: sampleConfig });
  const res = await worker.fetch(
    req("/api/uploads?floorId=44f&timeId=noon&viewId=central-sea", {
      method: "POST",
      headers: { "content-type": "image/jpeg" },
      body: "NEWBYTES",
    }),
    env,
  );
  expect(res.status).toBe(200);
  const { key } = (await res.json()) as { key: string };
  expect(key).toMatch(/^44f\/noon\/central-sea\.[0-9a-f]{10}\.jpg$/);
  // bytes stored under the tenant prefix; the original live image is untouched
  expect(env._r2.get(`marina-one/${key}`)).toBe("NEWBYTES");
});

test("PUT /api/config writes the DRAFT only — live is untouched", async () => {
  const env = makeEnv({ config: sampleConfig });
  const draft = { ...sampleConfig, branding: { ...sampleConfig.branding, appTitle: "Updated Title" } };
  const res = await worker.fetch(jsonReq("/api/config", "PUT", { config: draft }), env);
  expect(res.status).toBe(200);
  // draft KV written, live KV unchanged
  expect(JSON.parse(env._kv.get(configDraftKvKey("marina-one"))!).branding.appTitle).toBe("Updated Title");
  expect(JSON.parse(env._kv.get(configKvKey("marina-one"))!).branding.appTitle).toBe("One Marina");
  // public GET still serves the old live
  const live = (await (await worker.fetch(req("/api/config"), env)).json()) as { config: TenantConfig };
  expect(live.config.branding.appTitle).toBe("One Marina");
});

test("draft preview reflects the draft; publish flips it atomically + backs up history", async () => {
  const env = makeEnv({ config: sampleConfig });
  const draft = { ...sampleConfig, branding: { ...sampleConfig.branding, appTitle: "v2 Title" } };
  await worker.fetch(jsonReq("/api/config", "PUT", { config: draft }), env);

  // preview shows the draft
  const previewed = (await (await worker.fetch(req("/api/config?draft=1"), env)).json()) as {
    config: TenantConfig;
  };
  expect(previewed.config.branding.appTitle).toBe("v2 Title");

  // publish
  const pub = await worker.fetch(req("/api/publish", { method: "POST" }), env);
  expect(pub.status).toBe(200);
  expect(((await pub.json()) as { version: number }).version).toBe(2);

  // live now reflects the draft, at v2
  const live = (await (await worker.fetch(req("/api/config"), env)).json()) as { config: TenantConfig };
  expect(live.config.branding.appTitle).toBe("v2 Title");
  expect(live.config.version).toBe(2);
  // previous live archived to R2 history
  expect(env._r2.has(configHistoryKey("marina-one", 1))).toBe(true);
});

test("POST /api/rollback restores an archived version as a new live version", async () => {
  const env = makeEnv({ config: sampleConfig });
  // publish a v2
  await worker.fetch(
    jsonReq("/api/config", "PUT", {
      config: { ...sampleConfig, branding: { ...sampleConfig.branding, appTitle: "v2 Title" } },
    }),
    env,
  );
  await worker.fetch(req("/api/publish", { method: "POST" }), env);

  // roll back to v1
  const rb = await worker.fetch(jsonReq("/api/rollback", "POST", { version: 1 }), env);
  expect(rb.status).toBe(200);
  const body = (await rb.json()) as { version: number; restoredFrom: number };
  expect(body.restoredFrom).toBe(1);
  expect(body.version).toBe(3); // republished as a new linear version

  const live = (await (await worker.fetch(req("/api/config"), env)).json()) as { config: TenantConfig };
  expect(live.config.branding.appTitle).toBe("One Marina"); // v1 content
  expect(live.config.version).toBe(3);
});

test("write endpoints require auth when not in DEV_MODE", async () => {
  const env = makeEnv({ config: sampleConfig, devMode: false });
  const res = await worker.fetch(jsonReq("/api/config", "PUT", { config: sampleConfig }), env);
  expect(res.status).toBe(401);
});
