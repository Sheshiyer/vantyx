import { configKvKey } from "@panorama/shared";
import type { Env } from "./env";
import { json, apiError, tooManyRequests } from "./http";
import {
  getUser,
  putUser,
  createInvite,
  getInvite,
  consumeInvite,
  createReset,
  getReset,
  consumeReset,
  normalizeEmail,
  roleOf,
} from "./users";
import {
  hashPassword,
  verifyPassword,
  makeSessionCookie,
  clearSessionCookie,
  currentSession,
} from "./auth";
import { rateLimit, clearRateLimit, clientIp, verifyTurnstile } from "./ratelimit";
import { sendEmail, linkBase, inviteEmail, resetEmail } from "./email";
import { captureEvent, identifyUser } from "./telemetry";

const WINDOW = 900; // 15-minute fixed window for auth throttling

function withCookie(data: unknown, cookie: string): Response {
  const res = json(data);
  res.headers.append("set-cookie", cookie);
  return res;
}

/** Live tenant display name (for emails), falling back to the slug. */
export async function tenantName(env: Env, slug: string): Promise<string> {
  try {
    const raw = (await env.CONFIG.get(configKvKey(slug), "json")) as { tenant?: { name?: string } } | null;
    return raw?.tenant?.name || slug;
  } catch {
    return slug;
  }
}

/** POST /api/auth/invite — gated by ADMIN_SECRET. Body { email } → invite link (+ emails it if configured). */
export async function handleInvite(slug: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!env.ADMIN_SECRET || request.headers.get("x-admin-secret") !== env.ADMIN_SECRET) {
    return apiError(401, "unauthorized", "Admin secret required.");
  }
  const ip = clientIp(request);
  const rl = await rateLimit(env, "invite", `${slug}:${ip}`, 30, WINDOW); // defense-in-depth atop the secret
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let email: string;
  try {
    email = normalizeEmail(String(((await request.json()) as { email?: unknown }).email ?? ""));
  } catch {
    return apiError(400, "bad_request", "Body must be JSON { email }.");
  }
  if (!email.includes("@")) return apiError(400, "bad_request", "A valid email is required.");

  // The ADMIN_SECRET bootstrap invite provisions a tenant's first OWNER (in-app invites use /api/team).
  const token = await createInvite(env, slug, email, "owner");
  if (!(await getUser(env, slug, email))) {
    await putUser(env, slug, { email, salt: "", hash: "", status: "invited", role: "owner", createdAt: new Date().toISOString() });
  }
  const activateUrl = `${linkBase(request, env)}/admin/activate?token=${token}`;
  const tpl = inviteEmail(activateUrl, await tenantName(env, slug));
  const mail = await sendEmail(env, { to: email, ...tpl });
  captureEvent(env, ctx, email, "user_invited", { slug, emailed: mail.sent });
  // `token` is also returned so the admin UI can copy the link directly (route is ADMIN_SECRET-gated).
  return json({ ok: true, email, token, activateUrl, emailed: mail.sent });
}

/** POST /api/auth/activate { token, password } → set password, activate, start a session. */
export async function handleActivate(slug: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!env.AUTH_SECRET) return apiError(500, "server_misconfigured", "Auth not configured.");
  const ip = clientIp(request);
  const rl = await rateLimit(env, "activate", `${slug}:${ip}`, 20, WINDOW);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let body: { token?: string; password?: string; turnstileToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "bad_request", "Body must be JSON.");
  }
  if (!(await verifyTurnstile(env, body.turnstileToken, ip))) {
    return apiError(403, "challenge_failed", "Verification failed — please retry.");
  }
  const password = body.password ?? "";
  if (password.length < 8) return apiError(422, "weak_password", "Use at least 8 characters.");

  const invite = await getInvite(env, body.token ?? "");
  if (!invite || invite.slug !== slug) {
    return apiError(400, "invalid_invite", "This invite is invalid or has expired.");
  }
  const { salt, hash } = await hashPassword(password);
  await putUser(env, slug, {
    email: invite.email,
    salt,
    hash,
    status: "active",
    role: invite.role ?? "editor",
    createdAt: new Date().toISOString(),
  });
  await consumeInvite(env, body.token ?? "");
  captureEvent(env, ctx, invite.email, "user_account_activated", { slug });
  identifyUser(env, ctx, invite.email, invite.email);
  return withCookie({ ok: true, email: invite.email }, await makeSessionCookie(invite.email, slug, env.AUTH_SECRET));
}

/** POST /api/auth/login { email, password } → session. Rate-limited per email + per IP. */
export async function handleLogin(slug: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!env.AUTH_SECRET) return apiError(500, "server_misconfigured", "Auth not configured.");
  const ip = clientIp(request);
  const ipRl = await rateLimit(env, "login-ip", `${slug}:${ip}`, 40, WINDOW); // blunts spraying many accounts
  if (!ipRl.ok) return tooManyRequests(ipRl.retryAfter);

  let body: { email?: string; password?: string; turnstileToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "bad_request", "Body must be JSON.");
  }
  const email = normalizeEmail(body.email ?? "");
  const emailRl = await rateLimit(env, "login", `${slug}:${email}`, 8, WINDOW); // blunts targeting one account
  if (!emailRl.ok) return tooManyRequests(emailRl.retryAfter);

  if (!(await verifyTurnstile(env, body.turnstileToken, ip))) {
    return apiError(403, "challenge_failed", "Verification failed — please retry.");
  }
  const user = await getUser(env, slug, email);
  const ok = user && user.status === "active" && (await verifyPassword(body.password ?? "", user.salt, user.hash));
  if (!ok) return apiError(401, "invalid_credentials", "Wrong email or password.");

  await clearRateLimit(env, "login", `${slug}:${email}`); // legit sign-in resets the per-email counter
  captureEvent(env, ctx, email, "user_signed_in", { slug });
  identifyUser(env, ctx, email, email);
  return withCookie({ ok: true, email }, await makeSessionCookie(email, slug, env.AUTH_SECRET));
}

/** POST /api/auth/reset-request { email } → emails a reset link if the account exists. Always 200. */
export async function handleResetRequest(slug: string, request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request);
  const ipRl = await rateLimit(env, "reset-ip", `${slug}:${ip}`, 20, WINDOW);
  if (!ipRl.ok) return tooManyRequests(ipRl.retryAfter);

  let email: string;
  try {
    email = normalizeEmail(String(((await request.json()) as { email?: unknown }).email ?? ""));
  } catch {
    return apiError(400, "bad_request", "Body must be JSON { email }.");
  }
  const emailRl = await rateLimit(env, "reset", `${slug}:${email}`, 5, WINDOW);
  if (!emailRl.ok) return tooManyRequests(emailRl.retryAfter);

  const user = await getUser(env, slug, email);
  // Don't reveal whether the account exists. Only mint a token for a real, active user.
  if (user && user.status === "active") {
    const token = await createReset(env, slug, email);
    const resetUrl = `${linkBase(request, env)}/admin/reset?token=${token}`;
    const tpl = resetEmail(resetUrl, await tenantName(env, slug));
    const mail = await sendEmail(env, { to: email, ...tpl });
    // No provider configured (operator phase): surface the link so the operator can relay it.
    if (!mail.sent) return json({ ok: true, resetUrl });
  }
  return json({ ok: true });
}

/** POST /api/auth/reset { token, password } → set a new password for an existing account + session. */
export async function handleReset(slug: string, request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!env.AUTH_SECRET) return apiError(500, "server_misconfigured", "Auth not configured.");
  const ip = clientIp(request);
  const rl = await rateLimit(env, "reset-confirm", `${slug}:${ip}`, 20, WINDOW);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let body: { token?: string; password?: string; turnstileToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "bad_request", "Body must be JSON.");
  }
  if (!(await verifyTurnstile(env, body.turnstileToken, ip))) {
    return apiError(403, "challenge_failed", "Verification failed — please retry.");
  }
  const password = body.password ?? "";
  if (password.length < 8) return apiError(422, "weak_password", "Use at least 8 characters.");

  const reset = await getReset(env, body.token ?? "");
  if (!reset || reset.slug !== slug) {
    return apiError(400, "invalid_token", "This reset link is invalid or has expired.");
  }
  const user = await getUser(env, slug, reset.email);
  if (!user || user.status === "disabled") {
    return apiError(400, "invalid_token", "This reset link is no longer valid.");
  }
  const { salt, hash } = await hashPassword(password);
  await putUser(env, slug, { ...user, salt, hash, status: "active" });
  await consumeReset(env, body.token ?? "");
  captureEvent(env, ctx, reset.email, "user_password_reset", { slug });
  return withCookie({ ok: true, email: reset.email }, await makeSessionCookie(reset.email, slug, env.AUTH_SECRET));
}

/** POST /api/auth/logout → clear the session. */
export function handleLogout(): Response {
  return withCookie({ ok: true }, clearSessionCookie());
}

/** GET /api/auth/config → public bootstrap for the SPA (the Turnstile site key, if any). */
export function handleAuthConfig(env: Env): Response {
  return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null });
}

/** GET /api/auth/me → { email, slug, role } if signed in for this project, else 401. */
export async function handleMe(slug: string, request: Request, env: Env): Promise<Response> {
  if (env.DEV_MODE === "1") return json({ email: "dev@local", slug, role: "owner" });
  const session = await currentSession(request, env);
  if (!session || session.slug !== slug) return apiError(401, "unauthorized", "Not signed in.");
  const user = await getUser(env, slug, session.sub);
  if (!user || user.status !== "active") return apiError(401, "unauthorized", "Not signed in.");
  return json({ email: session.sub, slug, role: roleOf(user) });
}
