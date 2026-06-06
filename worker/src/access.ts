import type { Env } from "./env";
import { getCookie } from "./auth";

/**
 * Cloudflare Access (Zero Trust) JWT verification. When ACCESS_AUD + ACCESS_TEAM_DOMAIN are set,
 * the edge authenticates the user (passwordless email-OTP) and forwards a signed JWT in the
 * `Cf-Access-Jwt-Assertion` header (or `CF_Authorization` cookie). We verify it against the team's
 * public keys (RS256), check the audience + issuer + expiry, and return the authenticated email.
 * No-op (returns null) until configured, so the existing session auth keeps working.
 */
export type AccessIdentity = { email: string };

type Jwk = { kid: string; kty: string; n: string; e: string };

// In-memory JWKS cache (keys rotate rarely; 1h TTL).
let jwksCache: { url: string; keys: Map<string, CryptoKey>; exp: number } | null = null;

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function decodeJson(seg: string): unknown {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(seg)));
}

async function getKeys(teamDomain: string): Promise<Map<string, CryptoKey>> {
  const url = `${teamDomain.replace(/\/$/, "")}/cdn-cgi/access/certs`;
  const now = Date.now();
  if (jwksCache && jwksCache.url === url && jwksCache.exp > now) return jwksCache.keys;
  const res = await fetch(url);
  const data = (await res.json()) as { keys?: Jwk[] };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of data.keys ?? []) {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    keys.set(jwk.kid, key);
  }
  jwksCache = { url, keys, exp: now + 3600_000 };
  return keys;
}

/** True when Access is configured (env present) — callers switch auth strategy on this. */
export function accessEnabled(env: Env): boolean {
  return !!(env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN);
}

export async function verifyAccessJwt(request: Request, env: Env): Promise<AccessIdentity | null> {
  if (!accessEnabled(env)) return null;
  const token =
    request.headers.get("cf-access-jwt-assertion") || getCookie(request, "CF_Authorization");
  if (!token) return null;
  const [headerB64, payloadB64, sigB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !sigB64) return null;
  try {
    const header = decodeJson(headerB64) as { kid?: string; alg?: string };
    const claims = decodeJson(payloadB64) as {
      aud?: string[] | string;
      iss?: string;
      email?: string;
      exp?: number;
      nbf?: number;
    };
    if (!header.kid || header.alg !== "RS256") return null;

    const key = (await getKeys(env.ACCESS_TEAM_DOMAIN!)).get(header.kid);
    if (!key) return null;
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    if (!ok) return null;

    const aud = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
    if (!aud.includes(env.ACCESS_AUD!)) return null;
    const iss = env.ACCESS_TEAM_DOMAIN!.replace(/\/$/, "");
    if (claims.iss && claims.iss.replace(/\/$/, "") !== iss) return null;
    const nowSec = Date.now() / 1000;
    if (!claims.exp || claims.exp < nowSec) return null;
    if (claims.nbf && claims.nbf > nowSec + 60) return null;
    if (!claims.email) return null;

    return { email: claims.email.toLowerCase() };
  } catch {
    return null;
  }
}
