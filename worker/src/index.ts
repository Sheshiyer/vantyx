import type { Env } from "./env";
import { resolveSlug } from "./tenant";
import {
  handleGetConfig,
  handleGetDraft,
  handlePutConfig,
  handlePublish,
  handleRollback,
  handleGetHistory,
} from "./config";
import { handleUpload } from "./uploads";
import { handleTeamList, handleTeamInvite, handleTeamUpdate } from "./teamRoutes";
import { requireOwner } from "./auth";
import { requireOperator } from "./access";
import { handleConsoleProjects } from "./consoleRoutes";
import {
  handleInvite,
  handleActivate,
  handleLogin,
  handleLogout,
  handleMe,
  handleResetRequest,
  handleReset,
  handleAuthConfig,
} from "./authRoutes";
import { handleGetAsset } from "./assets";
import { runGc } from "./gc";
import { handleTelemetry, logEvent, captureEvent } from "./telemetry";
import { splashResponse } from "./splash";
import { apiError } from "./http";

const ASSET_PREFIX = "/assets/";

/**
 * The single backend. Resolves the tenant from the host, then routes:
 *   GET  /api/health             → liveness
 *   GET  /api/config             → public LIVE config (cached)
 *   GET  /api/config?draft=1      → DRAFT config (Access)         — preview
 *   PUT  /api/config             → write DRAFT only (Access)
 *   POST /api/uploads            → store an uploaded image at a new rev key (Access)
 *   POST /api/publish            → atomic draft → live + history (Access)
 *   POST /api/rollback           → restore an archived version (Access)
 *   GET  /api/config/history     → list archived versions to roll back to (Access)
 *   POST /api/auth/*             → invite/activate/login/logout/reset(-request) + me/config
 *   GET  /assets/*               → image bytes from private R2
 *   *                            → SPA shell (prod: Workers Static Assets; dev: Vite)
 */
export default {
  // Error boundary + timing around all routing: an unhandled throw becomes a clean 500 + structured
  // log (Workers observability / `wrangler tail`) instead of a raw crash; 5xx responses are logged too.
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const started = Date.now();
    const url = new URL(request.url);
    try {
      const res = await route(request, env, ctx, url);
      if (res.status >= 500) {
        logEvent({ t: "http.5xx", path: url.pathname, status: res.status, ms: Date.now() - started });
      }
      return res;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logEvent({
        t: "http.error",
        path: url.pathname,
        msg: errMsg,
        stack: err instanceof Error ? err.stack?.slice(0, 600) : undefined,
        ms: Date.now() - started,
      });
      captureEvent(env, ctx, "server", "$exception", {
        $exception_type: err instanceof Error ? err.constructor.name : "Error",
        $exception_message: errMsg,
        $exception_stack_trace_raw: err instanceof Error ? (err.stack?.slice(0, 1000) ?? "") : "",
        path: url.pathname,
      });
      return apiError(500, "internal_error", "Something went wrong on our end.");
    }
  },

  // Scheduled (cron) — garbage-collect orphaned image revs + prune old config history.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runGc(env).then((r) => logEvent({ t: "gc", ...r })).catch((e) => logEvent({ t: "gc.error", msg: String(e) })),
    );
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const { pathname } = url;

  if (pathname === "/api/health") {
    return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
  }

  // Operator console (admin.<apex>): API is path-based (so it works in local dev too); the SPA is
  // served host-based. Both are Access-gated inside the handlers (requireOperator).
  if (pathname.startsWith("/api/console/")) return routeConsoleApi(request, env, ctx, url);
  if (url.host === `admin.${env.PRODUCT_APEX}`) return serveConsoleSpa(request, env, url);

  const slug = resolveSlug(request, env);
  const needTenant = () => apiError(400, "no_tenant", "No tenant resolved from host.");

  // Same-origin telemetry beacon (errors + product events). Tenant is best-effort, not required.
  if (pathname === "/api/telemetry") {
    if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
    return handleTelemetry(slug, request, env, ctx);
  }

  if (pathname.startsWith("/api/auth/")) {
      if (pathname === "/api/auth/config" && request.method === "GET") return handleAuthConfig(env);
      if (!slug) return needTenant();
      if (pathname === "/api/auth/invite" && request.method === "POST") return handleInvite(slug, request, env, ctx);
      if (pathname === "/api/auth/activate" && request.method === "POST") return handleActivate(slug, request, env, ctx);
      if (pathname === "/api/auth/login" && request.method === "POST") return handleLogin(slug, request, env, ctx);
      if (pathname === "/api/auth/reset-request" && request.method === "POST") return handleResetRequest(slug, request, env);
      if (pathname === "/api/auth/reset" && request.method === "POST") return handleReset(slug, request, env, ctx);
      if (pathname === "/api/auth/logout" && request.method === "POST") return handleLogout();
      if (pathname === "/api/auth/me" && request.method === "GET") return handleMe(slug, request, env);
      return apiError(404, "not_found", "Unknown auth route.");
    }

    if (pathname === "/api/config") {
      if (!slug) return needTenant();
      if (request.method === "GET") {
        return url.searchParams.get("draft") === "1"
          ? handleGetDraft(slug, request, env)
          : handleGetConfig(slug, request, env);
      }
      if (request.method === "PUT") return handlePutConfig(slug, request, env, ctx);
      return apiError(405, "method_not_allowed", "Use GET or PUT.");
    }

    if (pathname === "/api/config/history") {
      if (!slug) return needTenant();
      if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
      return handleGetHistory(slug, request, env);
    }

    if (pathname === "/api/team") {
      if (!slug) return needTenant();
      if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
      return handleTeamList(slug, request, env, requireOwner);
    }

    if (pathname === "/api/team/invite") {
      if (!slug) return needTenant();
      if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
      return handleTeamInvite(slug, request, env, ctx, requireOwner);
    }

    if (pathname === "/api/team/update") {
      if (!slug) return needTenant();
      if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
      return handleTeamUpdate(slug, request, env, ctx, requireOwner);
    }

    if (pathname === "/api/uploads") {
      if (!slug) return needTenant();
      if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
      return handleUpload(slug, request, env, ctx);
    }

    if (pathname === "/api/publish") {
      if (!slug) return needTenant();
      if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
      return handlePublish(slug, request, env, ctx);
    }

    if (pathname === "/api/rollback") {
      if (!slug) return needTenant();
      if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
      return handleRollback(slug, request, env, ctx);
    }

    if (pathname.startsWith(ASSET_PREFIX)) {
      if (!slug) return needTenant();
      const assetPath = decodeURIComponent(pathname.slice(ASSET_PREFIX.length));
      return handleGetAsset(slug, assetPath, request, env);
    }

  // No tenant resolved: apex / www → the marketing landing page; any other unresolved host → splash.
  if (!slug) {
    if (url.host === env.PRODUCT_APEX || url.host === `www.${env.PRODUCT_APEX}`) {
      return serveLandingSpa(request, env, url);
    }
    return splashResponse();
  }

  // SPA shell — served by Workers Static Assets in production; a notice in local dev (Vite serves it).
  if (env.ASSETS_SPA) return env.ASSETS_SPA.fetch(request);
  return new Response(
    "Vantyx Worker is running. The SPA is served by the build (dev: run `vite`).",
    { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}

/** Operator console API (`/api/console/*`) — operator-gated (Access). */
async function routeConsoleApi(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const { pathname } = url;
  if (pathname === "/api/console/projects") {
    if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
    return handleConsoleProjects(request, env);
  }
  const team = pathname.match(/^\/api\/console\/projects\/([a-z0-9-]+)\/team(?:\/(invite|update))?$/);
  if (team) {
    const tslug = team[1]!;
    const action = team[2];
    if (!action && request.method === "GET") return handleTeamList(tslug, request, env, requireOperator);
    if (action === "invite" && request.method === "POST") return handleTeamInvite(tslug, request, env, ctx, requireOperator);
    if (action === "update" && request.method === "POST") return handleTeamUpdate(tslug, request, env, ctx, requireOperator);
    return apiError(405, "method_not_allowed", "Use the documented method.");
  }
  return apiError(404, "not_found", "Unknown console route.");
}

/** Serve the operator console SPA from `.assets/console/` (built with --base=/console/). */
async function serveConsoleSpa(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.ASSETS_SPA) {
    return new Response("Vantyx console — run the console dev server.", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (url.pathname.startsWith("/console/") && url.pathname !== "/console/") {
    const res = await env.ASSETS_SPA.fetch(new Request(new URL(url.pathname, url.origin), request));
    if (res.status !== 404) return res;
  }
  // Serve the shell from the directory form ("/console/") — fetching "/console/index.html" would 307.
  return env.ASSETS_SPA.fetch(new Request(new URL("/console/", url.origin), request));
}

/** Serve the marketing landing SPA from `.assets/landing/` (built with --base=/landing/) at the apex. */
async function serveLandingSpa(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.ASSETS_SPA) {
    return new Response("Vantyx landing — run the landing dev server.", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (url.pathname.startsWith("/landing/") && url.pathname !== "/landing/") {
    const res = await env.ASSETS_SPA.fetch(new Request(new URL(url.pathname, url.origin), request));
    if (res.status !== 404) return res;
  }
  return env.ASSETS_SPA.fetch(new Request(new URL("/landing/", url.origin), request));
}
