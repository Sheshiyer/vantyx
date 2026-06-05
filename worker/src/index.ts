import type { Env } from "./env";
import { resolveSlug } from "./tenant";
import { handleGetConfig } from "./config";
import { handleGetAsset } from "./assets";
import { apiError } from "./http";

const ASSET_PREFIX = "/assets/";

/**
 * The single backend. Resolves the tenant from the Host header, then routes:
 *   GET  /api/health   → liveness
 *   GET  /api/config   → tenant config from KV
 *   POST /api/uploads  → presigned upload (Phase 2)
 *   GET  /assets/*     → image bytes from private R2
 *   *                  → SPA shell (prod: Workers Static Assets; dev: Vite)
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/health") {
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }

    const slug = resolveSlug(request, env);

    if (pathname === "/api/config") {
      if (request.method !== "GET") return apiError(405, "method_not_allowed", "Use GET.");
      if (!slug) return apiError(400, "no_tenant", "No tenant resolved from host.");
      return handleGetConfig(slug, request, env);
    }

    if (pathname === "/api/uploads") {
      return apiError(501, "not_implemented", "Uploads arrive in Phase 2.");
    }

    if (pathname.startsWith(ASSET_PREFIX)) {
      if (!slug) return apiError(400, "no_tenant", "No tenant resolved from host.");
      const assetPath = decodeURIComponent(pathname.slice(ASSET_PREFIX.length));
      return handleGetAsset(slug, assetPath, request, env);
    }

    // SPA shell. Production: served by Workers Static Assets (the built viewer).
    // Local dev: the viewer runs on Vite and proxies /api + /assets to this Worker.
    return new Response(
      "Panorama Worker is running. The viewer SPA is served by the build (dev: run `vite`).",
      { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  },
} satisfies ExportedHandler<Env>;
