import type { Env } from "./env";

export type UserStatus = "invited" | "active" | "disabled";
export type UserRole = "owner" | "editor";
export type UserRecord = {
  email: string;
  salt: string;
  hash: string;
  status: UserStatus;
  role?: UserRole; // optional for back-compat; a missing role means "owner" (the original sole editor)
  createdAt: string;
};
export type InviteRecord = { slug: string; email: string; role?: UserRole; exp: number };
export type ResetRecord = { slug: string; email: string; exp: number };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Effective role — users created before roles existed are treated as owners. */
export function roleOf(user: { role?: UserRole } | null | undefined): UserRole {
  return user?.role ?? "owner";
}

/** All user records for a tenant (scans `user:<slug>:` KV keys). */
export async function listUsers(env: Env, slug: string): Promise<UserRecord[]> {
  const prefix = `user:${slug}:`;
  const out: UserRecord[] = [];
  let cursor: string | undefined;
  do {
    const res = await env.CONFIG.list({ prefix, cursor });
    for (const k of res.keys) {
      const u = (await env.CONFIG.get(k.name, "json")) as UserRecord | null;
      if (u) out.push(u);
    }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return out;
}

const userKey = (slug: string, email: string) => `user:${slug}:${normalizeEmail(email)}`;
const inviteKey = (token: string) => `invite:${token}`;
const resetKey = (token: string) => `reset:${token}`;

export async function getUser(env: Env, slug: string, email: string): Promise<UserRecord | null> {
  return (await env.CONFIG.get(userKey(slug, email), "json")) as UserRecord | null;
}

export async function putUser(env: Env, slug: string, user: UserRecord): Promise<void> {
  await env.CONFIG.put(userKey(slug, user.email), JSON.stringify(user));
}

export async function createInvite(
  env: Env,
  slug: string,
  email: string,
  role: UserRole = "editor",
  ttlMs = 24 * 3600 * 1000,
): Promise<string> {
  const token = randomToken();
  const invite: InviteRecord = { slug, email: normalizeEmail(email), role, exp: Date.now() + ttlMs };
  await env.CONFIG.put(inviteKey(token), JSON.stringify(invite), {
    expirationTtl: Math.ceil(ttlMs / 1000),
  });
  return token;
}

export async function getInvite(env: Env, token: string): Promise<InviteRecord | null> {
  if (!token) return null;
  const inv = (await env.CONFIG.get(inviteKey(token), "json")) as InviteRecord | null;
  if (!inv) return null;
  if (inv.exp < Date.now()) {
    await env.CONFIG.delete(inviteKey(token));
    return null;
  }
  return inv;
}

export async function consumeInvite(env: Env, token: string): Promise<void> {
  await env.CONFIG.delete(inviteKey(token));
}

/** Short-lived password-reset token (1h default) for an existing account. */
export async function createReset(
  env: Env,
  slug: string,
  email: string,
  ttlMs = 3600 * 1000,
): Promise<string> {
  const token = randomToken();
  const reset: ResetRecord = { slug, email: normalizeEmail(email), exp: Date.now() + ttlMs };
  await env.CONFIG.put(resetKey(token), JSON.stringify(reset), {
    expirationTtl: Math.ceil(ttlMs / 1000),
  });
  return token;
}

export async function getReset(env: Env, token: string): Promise<ResetRecord | null> {
  if (!token) return null;
  const r = (await env.CONFIG.get(resetKey(token), "json")) as ResetRecord | null;
  if (!r) return null;
  if (r.exp < Date.now()) {
    await env.CONFIG.delete(resetKey(token));
    return null;
  }
  return r;
}

export async function consumeReset(env: Env, token: string): Promise<void> {
  await env.CONFIG.delete(resetKey(token));
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
