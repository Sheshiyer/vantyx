import type { Env } from "./env";
import { json, apiError } from "./http";
import {
  getUser,
  putUser,
  createInvite,
  getInvite,
  consumeInvite,
  normalizeEmail,
} from "./users";
import {
  hashPassword,
  verifyPassword,
  makeSessionCookie,
  clearSessionCookie,
  currentSession,
} from "./auth";

function withCookie(data: unknown, cookie: string): Response {
  const res = json(data);
  res.headers.append("set-cookie", cookie);
  return res;
}

/** POST /api/auth/invite — gated by the ADMIN_SECRET header. Body { email } → invite link. */
export async function handleInvite(slug: string, request: Request, env: Env): Promise<Response> {
  if (!env.ADMIN_SECRET || request.headers.get("x-admin-secret") !== env.ADMIN_SECRET) {
    return apiError(401, "unauthorized", "Admin secret required.");
  }
  let email: string;
  try {
    email = normalizeEmail(String(((await request.json()) as { email?: unknown }).email ?? ""));
  } catch {
    return apiError(400, "bad_request", "Body must be JSON { email }.");
  }
  if (!email.includes("@")) return apiError(400, "bad_request", "A valid email is required.");

  const token = await createInvite(env, slug, email);
  // Pre-create an "invited" record so the editor shows up in the project's editors list.
  if (!(await getUser(env, slug, email))) {
    await putUser(env, slug, {
      email,
      salt: "",
      hash: "",
      status: "invited",
      createdAt: new Date().toISOString(),
    });
  }
  return json({ ok: true, email, token, activateUrl: `/admin/activate?token=${token}` });
}

/** POST /api/auth/activate { token, password } → set password, activate, start a session. */
export async function handleActivate(slug: string, request: Request, env: Env): Promise<Response> {
  if (!env.AUTH_SECRET) return apiError(500, "server_misconfigured", "Auth not configured.");
  let body: { token?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "bad_request", "Body must be JSON.");
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
    createdAt: new Date().toISOString(),
  });
  await consumeInvite(env, body.token ?? "");
  return withCookie({ ok: true, email: invite.email }, await makeSessionCookie(invite.email, slug, env.AUTH_SECRET));
}

/** POST /api/auth/login { email, password } → session. */
export async function handleLogin(slug: string, request: Request, env: Env): Promise<Response> {
  if (!env.AUTH_SECRET) return apiError(500, "server_misconfigured", "Auth not configured.");
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "bad_request", "Body must be JSON.");
  }
  const email = normalizeEmail(body.email ?? "");
  const user = await getUser(env, slug, email);
  const ok = user && user.status === "active" && (await verifyPassword(body.password ?? "", user.salt, user.hash));
  if (!ok) return apiError(401, "invalid_credentials", "Wrong email or password.");
  return withCookie({ ok: true, email }, await makeSessionCookie(email, slug, env.AUTH_SECRET));
}

/** POST /api/auth/logout → clear the session. */
export function handleLogout(): Response {
  return withCookie({ ok: true }, clearSessionCookie());
}

/** GET /api/auth/me → { email, slug } if signed in for this project, else 401. */
export async function handleMe(slug: string, request: Request, env: Env): Promise<Response> {
  if (env.DEV_MODE === "1") return json({ email: "dev@local", slug });
  const session = await currentSession(request, env);
  if (!session || session.slug !== slug) return apiError(401, "unauthorized", "Not signed in.");
  const user = await getUser(env, slug, session.sub);
  if (!user || user.status !== "active") return apiError(401, "unauthorized", "Not signed in.");
  return json({ email: session.sub, slug });
}
