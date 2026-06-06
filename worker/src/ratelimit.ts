import type { Env } from "./env";

/**
 * Fixed-window rate limiter backed by KV. KV is eventually-consistent across edge locations, so this
 * blunts brute force rather than guaranteeing a hard per-second cap — upgrade to a Durable Object or
 * the native RATE_LIMITER binding when strict limits matter. KV's minimum TTL is 60s, so windowSec
 * must be >= 60. Counters live under the `rl:` prefix (never matched by the tenant GC's `config:`).
 */
export type RateLimitResult = { ok: boolean; remaining: number; retryAfter: number };

type Counter = { n: number; reset: number };

export async function rateLimit(
  env: Env,
  scope: string,
  id: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const key = `rl:${scope}:${id}`;
  const now = Date.now();
  const cur = (await env.CONFIG.get(key, "json")) as Counter | null;

  if (!cur || cur.reset <= now) {
    await env.CONFIG.put(key, JSON.stringify({ n: 1, reset: now + windowSec * 1000 }), {
      expirationTtl: windowSec,
    });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (cur.n >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((cur.reset - now) / 1000)) };
  }
  const ttl = Math.max(60, Math.ceil((cur.reset - now) / 1000));
  await env.CONFIG.put(key, JSON.stringify({ n: cur.n + 1, reset: cur.reset }), { expirationTtl: ttl });
  return { ok: true, remaining: limit - cur.n - 1, retryAfter: 0 };
}

/** Clear a counter after a successful auth so a legit user isn't punished for earlier failures. */
export async function clearRateLimit(env: Env, scope: string, id: string): Promise<void> {
  await env.CONFIG.delete(`rl:${scope}:${id}`);
}

/** Best-effort client IP for bucketing (Cloudflare sets cf-connecting-ip at the edge). */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
}

/**
 * Cloudflare Turnstile verification. A no-op returning true unless TURNSTILE_SECRET is set, so forms
 * keep working until you opt in; once enabled, a missing/invalid token fails closed.
 */
export async function verifyTurnstile(
  env: Env,
  token: string | undefined,
  ip: string,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true; // not enabled
  if (!token) return false;
  try {
    const body = new FormData();
    body.append("secret", env.TURNSTILE_SECRET);
    body.append("response", token);
    if (ip && ip !== "local") body.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const out = (await res.json()) as { success?: boolean };
    return out.success === true;
  } catch {
    return false; // fail closed when the verifier is unreachable but Turnstile is enabled
  }
}
