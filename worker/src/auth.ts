import type { Env } from "./env";
import { apiError } from "./http";

type AccessClaims = { aud?: string | string[]; exp?: number; email?: string };

function decodeJwtPayload(jwt: string): AccessClaims | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64)) as AccessClaims;
  } catch {
    return null;
  }
}

/**
 * Guard a write-path endpoint. Returns an error Response to short-circuit, or null if allowed.
 *
 * - Local dev: `DEV_MODE=1` bypasses (there's no Cloudflare Access in front of `wrangler dev`).
 * - Prod: requires the `Cf-Access-Jwt-Assertion` header Cloudflare Access injects; checks audience
 *   + expiry. TODO hardening: verify the RS256 signature against the team JWKS. Until then the
 *   Worker's /api write routes MUST only be reachable behind an Access policy.
 */
export function requireAuth(request: Request, env: Env): Response | null {
  if (env.DEV_MODE === "1") return null;

  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) return apiError(401, "unauthorized", "Cloudflare Access authentication required.");

  const claims = decodeJwtPayload(jwt);
  if (!claims) return apiError(401, "unauthorized", "Malformed access token.");

  if (env.ACCESS_AUD) {
    const aud = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
    if (!aud.includes(env.ACCESS_AUD)) {
      return apiError(403, "forbidden", "Access token audience mismatch.");
    }
  }
  if (claims.exp && claims.exp * 1000 < Date.now()) {
    return apiError(401, "unauthorized", "Access token expired.");
  }
  return null;
}
