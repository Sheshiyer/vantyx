import type { Env } from "./env";
import { apiError } from "./http";
import { resolveSlug } from "./tenant";
import { getUser } from "./users";

const enc = new TextEncoder();
const dec = new TextDecoder();
const SESSION_COOKIE = "vx_session";
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days

// ---- encoding helpers ----
function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function fromHex(s: string): Uint8Array {
  const a = new Uint8Array(s.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return a;
}
function b64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---- password hashing (PBKDF2 / SHA-256, 100k iterations) ----
async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const km = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    km,
    256,
  );
  return toHex(new Uint8Array(bits));
}
export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toHex(salt), hash: await pbkdf2(password, salt) };
}
export async function verifyPassword(password: string, saltHex: string, hash: string): Promise<boolean> {
  if (!saltHex || !hash) return false;
  return timingSafeEqual(await pbkdf2(password, fromHex(saltHex)), hash);
}

// ---- session cookie (HMAC-signed) ----
export type Session = { sub: string; slug: string; exp: number };

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}
export async function signSession(payload: Session, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body, secret)}`;
}
export async function verifySession(token: string, secret: string): Promise<Session | null> {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!timingSafeEqual(sig, await hmac(body, secret))) return null;
  try {
    const payload = JSON.parse(dec.decode(fromB64url(body))) as Session;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function makeSessionCookie(email: string, slug: string, secret: string): Promise<string> {
  const token = await signSession({ sub: email, slug, exp: Date.now() + SESSION_TTL_MS }, secret);
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export async function currentSession(request: Request, env: Env): Promise<Session | null> {
  if (!env.AUTH_SECRET) return null;
  const token = getCookie(request, SESSION_COOKIE);
  return token ? verifySession(token, env.AUTH_SECRET) : null;
}

/**
 * Guard a write-path endpoint. Returns an error Response to short-circuit, or null if allowed.
 * DEV_MODE bypasses; else verifies the session cookie, the tenant match, and an active user.
 */
export async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  if (env.DEV_MODE === "1") return null;
  if (!env.AUTH_SECRET) return apiError(500, "server_misconfigured", "Auth is not configured.");

  const session = await currentSession(request, env);
  if (!session) return apiError(401, "unauthorized", "Sign in required.");

  const slug = resolveSlug(request, env);
  if (!slug || session.slug !== slug) {
    return apiError(403, "forbidden", "Session is for a different project.");
  }
  const user = await getUser(env, slug, session.sub);
  if (!user || user.status !== "active") {
    return apiError(403, "forbidden", "Access has been revoked.");
  }
  return null;
}
