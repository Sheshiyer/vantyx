/**
 * vantyx new-client — provision a brand-new tenant from one command.
 *
 * Builds + validates a TenantConfig (from a --spec JSON or quick flags), optionally maps a folder of
 * panorama images into per-slot R2 keys, then either prints the exact provisioning commands (default,
 * a safe dry-run) or executes them with `--apply`:
 *   1. seed KV          config:<slug>            (wrangler kv key put, remote)
 *   2. upload assets    vantyx-tenants/<slug>/…  (wrangler r2 object put, remote)
 *   3. invite the admin POST /api/auth/invite    (x-admin-secret: $ADMIN_SECRET)
 *
 * Run:
 *   bun cli/src/new-client.ts --spec client.json --assets ./images --admin-email a@b.com [--apply]
 *   bun cli/src/new-client.ts --slug marina-two --name "Marina Two" \
 *       --views "sea:Sea View" --times "day:Day,night:Night" --floors "10f:10th,11f:11th" --assets ./img
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { argv, env, exit } from "node:process";
import { parseTenantConfig, type TenantConfig } from "@panorama/shared";

const WORKER_DIR = resolve(import.meta.dirname, "..", "..", "worker");
const OUT_DIR = resolve(import.meta.dirname, "..", "out");
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

// ---- args ----
function parseArgs(args: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function die(msg: string): never {
  console.error(`✗ ${msg}`);
  exit(1);
}

/** "id:Label,id2:Label2" → [{id,label}] */
function parsePairs(spec: string): { id: string; label: string }[] {
  return spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [id, ...rest] = s.split(":");
      return { id: id.trim(), label: (rest.join(":").trim() || id.trim()) };
    });
}

// ---- build the draft config ----
function buildDraft(a: Record<string, string | boolean>): Record<string, unknown> {
  if (typeof a.spec === "string") {
    const raw = JSON.parse(readFileSync(resolve(String(a.spec)), "utf8")) as Record<string, unknown>;
    // Allow a slug override on top of the spec.
    if (typeof a.slug === "string") raw.tenant = { ...(raw.tenant as Record<string, unknown>), slug: a.slug };
    return raw;
  }
  // Quick-scaffold mode.
  if (typeof a.slug !== "string" || typeof a.name !== "string") {
    die("Provide --spec <file.json>, or --slug + --name (+ --views/--times/--floors).");
  }
  const views = typeof a.views === "string" ? parsePairs(a.views) : [{ id: "main", label: "Main View" }];
  const times = typeof a.times === "string" ? parsePairs(a.times) : [{ id: "day", label: "Day" }];
  const floors = typeof a.floors === "string" ? parsePairs(a.floors) : [];
  return {
    tenant: { slug: a.slug, name: a.name },
    branding: { appTitle: a.name },
    views,
    times,
    floors: floors.map((f, i) => ({ id: f.id, label: f.label, order: i + 1, slots: [] })),
  };
}

/** Scan an assets dir laid out as <floorId>/<timeId>/<viewId>.<ext> and return discovered slot images. */
function scanAssets(dir: string): { rel: string; floorId: string; timeId: string; viewId: string; abs: string }[] {
  const root = resolve(dir);
  if (!existsSync(root)) die(`--assets dir not found: ${root}`);
  const found: { rel: string; floorId: string; timeId: string; viewId: string; abs: string }[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const abs = join(d, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (IMAGE_RE.test(name)) {
        const rel = relative(root, abs).split("\\").join("/");
        const parts = rel.split("/");
        if (parts.length === 3) {
          found.push({ rel, floorId: parts[0], timeId: parts[1], viewId: parts[2].replace(IMAGE_RE, ""), abs });
        }
      }
    }
  };
  walk(root);
  return found;
}

/** Patch slots so every discovered image is wired into the right floor/view/time cell. */
function applyAssets(draft: Record<string, unknown>, assets: ReturnType<typeof scanAssets>): void {
  const floors = draft.floors as { id: string; slots: Record<string, unknown>[] }[];
  for (const img of assets) {
    const floor = floors.find((f) => f.id === img.floorId);
    if (!floor) {
      console.warn(`  ! image ${img.rel} has no matching floor "${img.floorId}" — skipped`);
      continue;
    }
    floor.slots = floor.slots ?? [];
    const existing = floor.slots.find((s) => s.viewId === img.viewId && s.timeId === img.timeId);
    if (existing) existing.image = img.rel;
    else floor.slots.push({ viewId: img.viewId, timeId: img.timeId, enabled: true, image: img.rel });
  }
}

// ---- provisioning steps ----
function run(label: string, cmd: string, args: string[], cwd: string): void {
  console.log(`  → ${label}: ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) die(`${label} failed (exit ${r.status})`);
}

async function invite(workerUrl: string, _slug: string, email: string): Promise<void> {
  const secret = env.ADMIN_SECRET;
  if (!secret) {
    console.warn("  ! ADMIN_SECRET not set — skipping invite. Invite from the admin Team UI once you're an owner.");
    return;
  }
  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, "")}/api/auth/invite`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ email }),
    });
    const body = (await res.json().catch(() => ({}))) as { activateUrl?: string; emailed?: boolean; error?: string };
    if (!res.ok) {
      console.warn(`  ! invite failed (HTTP ${res.status}): ${body.error ?? ""} — retry once TLS is ready.`);
      return;
    }
    console.log(`  ✓ invited ${email} as owner${body.emailed ? " (emailed)" : ""}: ${body.activateUrl ?? ""}`);
  } catch (e) {
    console.warn(`  ! invite request failed (${e instanceof Error ? e.message : String(e)}) — the subdomain's TLS may still be provisioning; retry in ~1 min.`);
  }
}

/**
 * Register a Cloudflare Workers Custom Domain for the tenant subdomain (zero-touch routing + TLS).
 * Gated on CLOUDFLARE_API_TOKEN + account id; degrades to a printed manual step otherwise.
 */
async function registerCustomDomain(
  hostname: string,
  apex: string,
  service: string,
): Promise<{ ok: boolean; reason?: string }> {
  const token = env.CLOUDFLARE_API_TOKEN;
  const account = env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID;
  if (!token || !account) return { ok: false, reason: "no CLOUDFLARE_API_TOKEN/ACCOUNT_ID" };
  const api = "https://api.cloudflare.com/client/v4";
  try {
    let zoneId = env.CF_ZONE_ID;
    if (!zoneId) {
      const zr = await fetch(`${api}/zones?name=${apex}`, { headers: { authorization: `Bearer ${token}` } });
      const zj = (await zr.json().catch(() => ({}))) as { result?: { id?: string }[] };
      zoneId = zj.result?.[0]?.id;
      if (!zoneId) return { ok: false, reason: `zone "${apex}" not found for this token` };
    }
    const res = await fetch(`${api}/accounts/${account}/workers/domains`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ zone_id: zoneId, hostname, service, environment: "production" }),
    });
    if (!res.ok) return { ok: false, reason: `API ${res.status}: ${(await res.text().catch(() => "")).slice(0, 140)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

// ---- main ----
async function main(): Promise<void> {
  const a = parseArgs(argv.slice(2));
  const apply = a.apply === true;
  const apex = typeof a.apex === "string" ? a.apex : "tryvantyx.space";
  const service = typeof a.service === "string" ? a.service : "vantyx";

  const draft = buildDraft(a);
  const assets = typeof a.assets === "string" ? scanAssets(a.assets) : [];
  if (assets.length) applyAssets(draft, assets);

  let config: TenantConfig;
  try {
    config = parseTenantConfig(draft);
  } catch (e) {
    die(`config failed schema validation: ${e instanceof Error ? e.message : String(e)}`);
  }
  const slug = config.tenant.slug;
  const hostname = `${slug}.${apex}`;
  const workerUrl = typeof a.worker === "string" ? a.worker : `https://${hostname}`;
  const slotCount = config.floors.reduce((n, f) => n + f.slots.length, 0);

  mkdirSync(OUT_DIR, { recursive: true });
  const configPath = join(OUT_DIR, `${slug}.config.json`);
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  console.log(`\n● vantyx new-client — ${config.tenant.name} (${slug})`);
  console.log(
    `  ${config.floors.length} floors · ${config.views.length}×${config.times.length} axes · ${slotCount} slots · ${assets.length} images`,
  );
  console.log(`  config → ${configPath}`);
  console.log(apply ? "\n▶ APPLYING (remote):" : "\n▶ DRY RUN — pass --apply to execute. Planned steps:");

  // 1. seed KV
  const kvArgs = ["kv", "key", "put", `config:${slug}`, "--path", configPath, "--binding", "CONFIG", "--remote"];
  if (apply) run("seed KV", "wrangler", kvArgs, WORKER_DIR);
  else console.log(`  → seed KV: (cd worker && wrangler ${kvArgs.join(" ")})`);

  // 2. upload assets
  for (const img of assets) {
    const key = `vantyx-tenants/${slug}/${img.rel}`;
    const r2Args = ["r2", "object", "put", key, "--file", img.abs, "--remote"];
    if (apply) run(`upload ${img.rel}`, "wrangler", r2Args, WORKER_DIR);
    else console.log(`  → upload ${img.rel}: (cd worker && wrangler ${r2Args.join(" ")})`);
  }

  // 3. register the per-tenant Custom Domain (zero-touch subdomain + auto-TLS)
  const cdManual = `add { pattern = "${hostname}", custom_domain = true } to worker/wrangler.toml routes, then \`wrangler deploy\``;
  if (apply) {
    const r = await registerCustomDomain(hostname, apex, service);
    if (r.ok) console.log(`  ✓ custom domain: https://${hostname} (TLS provisioning ~1–2 min)`);
    else console.warn(`  ! custom domain not auto-registered (${r.reason}). Manual: ${cdManual}`);
  } else {
    console.log(`  → custom domain: PUT /accounts/{id}/workers/domains { ${hostname} } — needs CLOUDFLARE_API_TOKEN+ACCOUNT_ID; else ${cdManual}`);
  }

  // 4. invite the first owner (ADMIN_SECRET-gated; mints an owner for this tenant)
  if (typeof a["admin-email"] === "string") {
    if (apply) await invite(workerUrl, slug, String(a["admin-email"]));
    else console.log(`  → invite: POST ${workerUrl}/api/auth/invite  (x-admin-secret: $ADMIN_SECRET) { "${a["admin-email"]}" }`);
  }

  console.log(`\n✓ ${apply ? "Provisioned" : "Planned"}.  Viewer: ${workerUrl}/   Admin: ${workerUrl}/admin`);
  if (!apply) console.log("  Re-run with --apply (and ADMIN_SECRET set) to execute.\n");
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
