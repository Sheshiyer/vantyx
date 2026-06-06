import type { Env } from "./env";
import { resolveSlug } from "./tenant";
import {
  handleGetConfig,
  handleGetDraft,
  handlePutConfig,
  handlePublish,
  handleRollback,
} from "./config";
import { handleUpload } from "./uploads";
import { handleGetAsset } from "./assets";
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
 *   GET  /assets/*               → image bytes from private R2
 *   *                            → SPA shell (prod: Workers Static Assets; dev: Vite)
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/api/health") {
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }

    const slug = resolveSlug(request, env);
    const needTenant = () => apiError(400, "no_tenant", "No tenant resolved from host.");

    if (pathname === "/api/config") {
      if (!slug) return needTenant();
      if (request.method === "GET") {
        return url.searchParams.get("draft") === "1"
          ? handleGetDraft(slug, request, env)
          : handleGetConfig(slug, request, env);
      }
      if (request.method === "PUT") return handlePutConfig(slug, request, env);
      return apiError(405, "method_not_allowed", "Use GET or PUT.");
    }

    if (pathname === "/api/uploads") {
      if (!slug) return needTenant();
      if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
      return handleUpload(slug, request, env);
    }

    if (pathname === "/api/publish") {
      if (!slug) return needTenant();
      if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
      return handlePublish(slug, request, env);
    }

    if (pathname === "/api/rollback") {
      if (!slug) return needTenant();
      if (request.method !== "POST") return apiError(405, "method_not_allowed", "Use POST.");
      return handleRollback(slug, request, env);
    }

    if (pathname.startsWith(ASSET_PREFIX)) {
      if (!slug) return needTenant();
      const assetPath = decodeURIComponent(pathname.slice(ASSET_PREFIX.length));
      return handleGetAsset(slug, assetPath, request, env);
    }

    // SPA shell — served by Workers Static Assets in production; a notice in local dev (Vite serves it).
    if (env.ASSETS_SPA) return env.ASSETS_SPA.fetch(request);
    return new Response(
      "Vantyx Worker is running. The SPA is served by the build (dev: run `vite`).",
      { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  },
} satisfies ExportedHandler<Env>;
