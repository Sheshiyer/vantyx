import type { Env } from "./env";

export type UserStatus = "invited" | "active" | "disabled";
export type UserRecord = {
  email: string;
  salt: string;
  hash: string;
  status: UserStatus;
  createdAt: string;
};
export type InviteRecord = { slug: string; email: string; exp: number };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const userKey = (slug: string, email: string) => `user:${slug}:${normalizeEmail(email)}`;
const inviteKey = (token: string) => `invite:${token}`;

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
  ttlMs = 24 * 3600 * 1000,
): Promise<string> {
  const token = randomToken();
  const invite: InviteRecord = { slug, email: normalizeEmail(email), exp: Date.now() + ttlMs };
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

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
