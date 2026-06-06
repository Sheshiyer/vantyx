import { test, expect } from "bun:test";
import worker from "./index";
import { gcTenant } from "./gc";
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

type EnvOpts = {
  config?: TenantConfig;
  assets?: Record<string, string>;
  devMode?: boolean;
  authSecret?: string;
  adminSecret?: string;
  turnstileSecret?: string;
};

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
    delete: async (key: string) => {
      kv.delete(key);
    },
    list: async (opts?: { prefix?: string }) => ({
      keys: [...kv.keys()].filter((k) => k.startsWith(opts?.prefix ?? "")).map((name) => ({ name })),
      list_complete: true,
    }),
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
    delete: async (key: string) => {
      r2.delete(key);
    },
    list: async (opts?: { prefix?: string }) => ({
      objects: [...r2.keys()]
        .filter((k) => k.startsWith(opts?.prefix ?? ""))
        .map((key) => ({ key, uploaded: new Date(0) })),
      truncated: false,
    }),
  };
  const env = {
    CONFIG,
    MEDIA,
    PRODUCT_APEX: APEX,
    DEV_MODE: opts.devMode === false ? undefined : "1",
    AUTH_SECRET: opts.authSecret,
    ADMIN_SECRET: opts.adminSecret,
    TURNSTILE_SECRET: opts.turnstileSecret,
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

test("apex host (no tenant) serves the Vantyx splash, not a tenant", async () => {
  const res = await worker.fetch(req("/", {}, APEX), makeEnv({}));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/html");
  expect(await res.text()).toContain("Vantyx");
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
  const env = makeEnv({ config: sampleConfig, devMode: false, authSecret: "s" });
  const res = await worker.fetch(jsonReq("/api/config", "PUT", { config: sampleConfig }), env);
  expect(res.status).toBe(401);
});

// ---- self-contained auth: invite -> activate -> login -> session ----

function sessionCookie(res: Response): string | null {
  const m = res.headers.get("set-cookie")?.match(/vx_session=([^;]*)/);
  return m ? `vx_session=${m[1]}` : null;
}
const authEnv = () =>
  makeEnv({ config: sampleConfig, devMode: false, authSecret: "test-secret", adminSecret: "admin-secret" });
const inviteReq = (email: string, secret = "admin-secret") =>
  req("/api/auth/invite", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-secret": secret },
    body: JSON.stringify({ email }),
  });
const putWithCookie = (cookie: string, env: Env) =>
  worker.fetch(
    req("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ config: sampleConfig }),
    }),
    env,
  );

test("invite requires the admin secret", async () => {
  const res = await worker.fetch(jsonReq("/api/auth/invite", "POST", { email: "a@b.com" }), authEnv());
  expect(res.status).toBe(401);
});

test("invite -> activate -> me -> authed write; login + wrong password", async () => {
  const env = authEnv();
  const inv = await worker.fetch(inviteReq("ed@itor.com"), env);
  expect(inv.status).toBe(200);
  const token = ((await inv.json()) as { token: string }).token;
  expect(token).toBeTruthy();

  // unauthenticated write is blocked
  expect((await worker.fetch(jsonReq("/api/config", "PUT", { config: sampleConfig }), env)).status).toBe(401);

  // activate sets a password + session
  const act = await worker.fetch(jsonReq("/api/auth/activate", "POST", { token, password: "hunter2pass" }), env);
  expect(act.status).toBe(200);
  const cookie = sessionCookie(act)!;
  expect(cookie).toContain("vx_session=");

  // me reflects the signed-in editor; authed write succeeds
  const me = await worker.fetch(req("/api/auth/me", { headers: { cookie } }), env);
  expect(me.status).toBe(200);
  expect(((await me.json()) as { email: string }).email).toBe("ed@itor.com");
  expect((await putWithCookie(cookie, env)).status).toBe(200);

  // login works with the right password, 401s on the wrong one
  expect((await worker.fetch(jsonReq("/api/auth/login", "POST", { email: "ed@itor.com", password: "hunter2pass" }), env)).status).toBe(200);
  expect((await worker.fetch(jsonReq("/api/auth/login", "POST", { email: "ed@itor.com", password: "nope" }), env)).status).toBe(401);
});

test("a disabled user is blocked even with a valid session cookie (revocation)", async () => {
  const env = authEnv();
  const token = ((await (await worker.fetch(inviteReq("z@z.com"), env)).json()) as { token: string }).token;
  const cookie = sessionCookie(
    await worker.fetch(jsonReq("/api/auth/activate", "POST", { token, password: "longenough" }), env),
  )!;
  expect((await putWithCookie(cookie, env)).status).toBe(200);

  const u = JSON.parse(env._kv.get("user:marina-one:z@z.com")!);
  u.status = "disabled";
  env._kv.set("user:marina-one:z@z.com", JSON.stringify(u));
  expect((await putWithCookie(cookie, env)).status).toBe(403);
});

// ---- resilience: optimistic concurrency + corrupt-config fallback ----

test("publish with a stale If-Match is rejected (409 version_conflict)", async () => {
  const env = makeEnv({ config: sampleConfig }); // live v1 (DEV_MODE)
  await worker.fetch(jsonReq("/api/config", "PUT", { config: sampleConfig }), env);
  await worker.fetch(req("/api/publish", { method: "POST" }), env); // -> live v2
  const res = await worker.fetch(
    req("/api/publish", { method: "POST", headers: { "if-match": "1" } }),
    env,
  );
  expect(res.status).toBe(409);
});

test("PUT draft with a stale If-Match is rejected (409)", async () => {
  const env = makeEnv({ config: sampleConfig });
  await worker.fetch(jsonReq("/api/config", "PUT", { config: sampleConfig }), env);
  await worker.fetch(req("/api/publish", { method: "POST" }), env); // -> stored v2
  const res = await worker.fetch(
    req("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json", "if-match": "1" },
      body: JSON.stringify({ config: sampleConfig }),
    }),
    env,
  );
  expect(res.status).toBe(409);
});

test("a corrupt live config falls back to the last-good history (never 500s)", async () => {
  const env = makeEnv({ config: sampleConfig });
  // publish a v2 so the original v1 gets archived to history
  await worker.fetch(
    jsonReq("/api/config", "PUT", {
      config: { ...sampleConfig, branding: { ...sampleConfig.branding, appTitle: "v2" } },
    }),
    env,
  );
  await worker.fetch(req("/api/publish", { method: "POST" }), env); // live v2, history has v1
  // corrupt the live value (valid JSON, invalid schema)
  env._kv.set(configKvKey("marina-one"), JSON.stringify({ schemaVersion: 1, version: 9, tenant: { slug: "marina-one", name: "x" } }));
  const res = await worker.fetch(req("/api/config"), env);
  expect(res.status).toBe(200);
  expect(res.headers.get("x-vantyx-degraded")).toBe("last-good-history");
  const body = (await res.json()) as { config: TenantConfig };
  expect(body.config.branding.appTitle).toBe("One Marina"); // archived v1
});

// ---- roles & multi-user (Owner + Editor) ----

const tokenFrom = (url: string) => url.split("token=")[1]!;
const cookieReq = (path: string, method: string, cookie: string, body?: unknown) =>
  req(path, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test("bootstrap invite creates an owner; owner can list the team", async () => {
  const env = authEnv();
  const token = ((await (await worker.fetch(inviteReq("owner@co.com"), env)).json()) as { token: string }).token;
  const cookie = sessionCookie(
    await worker.fetch(jsonReq("/api/auth/activate", "POST", { token, password: "ownerpass1" }), env),
  )!;
  const me = (await (await worker.fetch(req("/api/auth/me", { headers: { cookie } }), env)).json()) as { role: string };
  expect(me.role).toBe("owner");

  const res = await worker.fetch(req("/api/team", { headers: { cookie } }), env);
  expect(res.status).toBe(200);
  const { members } = (await res.json()) as { members: { email: string; role: string }[] };
  expect(members.find((m) => m.email === "owner@co.com")?.role).toBe("owner");
});

test("owner invites an editor; the editor can edit but cannot manage the team", async () => {
  const env = authEnv();
  const ownerTok = ((await (await worker.fetch(inviteReq("owner@co.com"), env)).json()) as { token: string }).token;
  const ownerCookie = sessionCookie(
    await worker.fetch(jsonReq("/api/auth/activate", "POST", { token: ownerTok, password: "ownerpass1" }), env),
  )!;

  const inv = await worker.fetch(cookieReq("/api/team/invite", "POST", ownerCookie, { email: "ed@co.com", role: "editor" }), env);
  expect(inv.status).toBe(200);
  const edTok = tokenFrom(((await inv.json()) as { activateUrl: string }).activateUrl);
  const edCookie = sessionCookie(
    await worker.fetch(jsonReq("/api/auth/activate", "POST", { token: edTok, password: "editorpass1" }), env),
  )!;

  const me = (await (await worker.fetch(req("/api/auth/me", { headers: { cookie: edCookie } }), env)).json()) as { role: string };
  expect(me.role).toBe("editor");
  expect((await putWithCookie(edCookie, env)).status).toBe(200); // editors can edit content
  expect((await worker.fetch(req("/api/team", { headers: { cookie: edCookie } }), env)).status).toBe(403); // but not manage
  expect((await worker.fetch(cookieReq("/api/team/invite", "POST", edCookie, { email: "x@y.com" }), env)).status).toBe(403);
});

test("the last owner cannot be demoted or disabled (lockout protection)", async () => {
  const env = authEnv();
  const tok = ((await (await worker.fetch(inviteReq("solo@co.com"), env)).json()) as { token: string }).token;
  const cookie = sessionCookie(
    await worker.fetch(jsonReq("/api/auth/activate", "POST", { token: tok, password: "solopass12" }), env),
  )!;
  expect((await worker.fetch(cookieReq("/api/team/update", "POST", cookie, { email: "solo@co.com", role: "editor" }), env)).status).toBe(409);
  expect((await worker.fetch(cookieReq("/api/team/update", "POST", cookie, { email: "solo@co.com", status: "disabled" }), env)).status).toBe(409);
});

// ---- Batch 2: self-serve unlock (rate-limiting, reset, history, Turnstile) ----

test("login is rate-limited per email (429 after the window budget)", async () => {
  const env = authEnv();
  const attempt = () =>
    worker.fetch(jsonReq("/api/auth/login", "POST", { email: "brute@x.com", password: "wrong" }), env);
  for (let i = 0; i < 8; i++) expect((await attempt()).status).toBe(401); // 8 allowed (all wrong)
  const limited = await attempt(); // 9th trips the limiter
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBeTruthy();
});

test("password reset: request -> reset -> new password works, old one doesn't", async () => {
  const env = authEnv();
  const token = ((await (await worker.fetch(inviteReq("reset@me.com"), env)).json()) as { token: string }).token;
  await worker.fetch(jsonReq("/api/auth/activate", "POST", { token, password: "origpass1" }), env);

  // request a reset — no email provider, so the link (with token) comes back in the body
  const rr = await worker.fetch(jsonReq("/api/auth/reset-request", "POST", { email: "reset@me.com" }), env);
  expect(rr.status).toBe(200);
  const resetUrl = ((await rr.json()) as { resetUrl?: string }).resetUrl!;
  expect(resetUrl).toContain("/admin/reset?token=");
  const resetToken = new URL(resetUrl).searchParams.get("token")!;

  // set a new password
  const done = await worker.fetch(jsonReq("/api/auth/reset", "POST", { token: resetToken, password: "newpass12" }), env);
  expect(done.status).toBe(200);
  expect(sessionCookie(done)).toContain("vx_session=");

  // new works, old is dead
  expect((await worker.fetch(jsonReq("/api/auth/login", "POST", { email: "reset@me.com", password: "newpass12" }), env)).status).toBe(200);
  expect((await worker.fetch(jsonReq("/api/auth/login", "POST", { email: "reset@me.com", password: "origpass1" }), env)).status).toBe(401);
});

test("reset-request never reveals whether an account exists", async () => {
  const env = authEnv();
  const res = await worker.fetch(jsonReq("/api/auth/reset-request", "POST", { email: "ghost@nobody.com" }), env);
  expect(res.status).toBe(200);
  expect(((await res.json()) as { resetUrl?: string }).resetUrl).toBeUndefined();
});

test("GET /api/config/history lists archived versions newest-first", async () => {
  const env = makeEnv({ config: sampleConfig }); // DEV_MODE
  await worker.fetch(jsonReq("/api/config", "PUT", { config: { ...sampleConfig, branding: { ...sampleConfig.branding, appTitle: "v2" } } }), env);
  await worker.fetch(req("/api/publish", { method: "POST" }), env); // archives v1
  const res = await worker.fetch(req("/api/config/history"), env);
  expect(res.status).toBe(200);
  const { versions } = (await res.json()) as { versions: { version: number }[] };
  expect(versions[0]?.version).toBe(1);
});

test("GET /api/auth/config returns the (absent) Turnstile site key without a tenant", async () => {
  const res = await worker.fetch(req("/api/auth/config", {}, APEX), authEnv());
  expect(res.status).toBe(200);
  expect(((await res.json()) as { turnstileSiteKey: string | null }).turnstileSiteKey).toBeNull();
});

test("when Turnstile is enabled, a login without a token is rejected (403)", async () => {
  const env = makeEnv({ config: sampleConfig, devMode: false, authSecret: "s", adminSecret: "a", turnstileSecret: "ts" });
  const res = await worker.fetch(jsonReq("/api/auth/login", "POST", { email: "x@y.com", password: "whatever1" }), env);
  expect(res.status).toBe(403);
});

// ---- Batch 3: observability (telemetry beacon + error boundary) ----

test("POST /api/telemetry accepts a beacon (204) without a tenant", async () => {
  const res = await worker.fetch(
    req(
      "/api/telemetry",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "event", event: "scene_view", props: { floor: "6f" }, id: "anon1" }),
      },
      APEX,
    ),
    makeEnv({}),
  );
  expect(res.status).toBe(204);
});

test("telemetry rejects a non-POST (405) and oversized bodies (413)", async () => {
  expect((await worker.fetch(req("/api/telemetry", {}, APEX), makeEnv({}))).status).toBe(405);
  const big = await worker.fetch(
    req("/api/telemetry", { method: "POST", body: "x".repeat(5000) }, APEX),
    makeEnv({}),
  );
  expect(big.status).toBe(413);
});

test("gcTenant deletes orphaned image revs but keeps referenced ones", async () => {
  const cfg = parseTenantConfig({
    tenant: { slug: "marina-one", name: "M" },
    branding: { appTitle: "M" },
    views: [{ id: "360", label: "360" }],
    times: [{ id: "noon", label: "Day" }],
    floors: [
      { id: "6f", label: "6th", slots: [{ viewId: "360", timeId: "noon", image: "6f/noon/360.keep.jpg" }] },
    ],
  });
  const env = makeEnv({ config: cfg });
  env._r2.set("marina-one/6f/noon/360.keep.jpg", "KEEP"); // referenced
  env._r2.set("marina-one/6f/noon/360.orphan.jpg", "ORPHAN"); // not referenced, old -> sweep
  const res = await gcTenant(env, "marina-one", Date.now());
  expect(res.deletedImages).toBe(1);
  expect(env._r2.has("marina-one/6f/noon/360.keep.jpg")).toBe(true);
  expect(env._r2.has("marina-one/6f/noon/360.orphan.jpg")).toBe(false);
});

// ---- operator console (admin.<apex>, Access-gated) ----

test("GET /api/console/projects lists tenants (operator)", async () => {
  const env = makeEnv({ config: sampleConfig }); // DEV_MODE bypasses operator gate
  const res = await worker.fetch(req("/api/console/projects"), env);
  expect(res.status).toBe(200);
  const { projects } = (await res.json()) as { projects: { slug: string; name: string; floors: number }[] };
  const p = projects.find((x) => x.slug === "marina-one");
  expect(p?.name).toBe("Marina One");
  expect(p?.floors).toBe(1);
});

test("console can manage any project's team without a tenant host (operator)", async () => {
  const env = makeEnv({ config: sampleConfig });
  env._kv.set(
    "user:marina-one:a@b.com",
    JSON.stringify({ email: "a@b.com", salt: "", hash: "", status: "active", role: "owner", createdAt: "t" }),
  );
  const res = await worker.fetch(req("/api/console/projects/marina-one/team"), env);
  expect(res.status).toBe(200);
  const { members } = (await res.json()) as { members: { email: string; role: string }[] };
  expect(members.find((m) => m.email === "a@b.com")?.role).toBe("owner");
});

test("console is locked until Cloudflare Access is configured (503)", async () => {
  const env = makeEnv({ config: sampleConfig, devMode: false, authSecret: "s" }); // no ACCESS_AUD
  const res = await worker.fetch(req("/api/console/projects"), env);
  expect(res.status).toBe(503);
});
