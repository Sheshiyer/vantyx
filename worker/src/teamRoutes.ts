import type { Env } from "./env";
import { json, apiError } from "./http";
import {
  listUsers,
  getUser,
  putUser,
  createInvite,
  normalizeEmail,
  roleOf,
  type UserRole,
  type UserRecord,
} from "./users";
import { sendEmail, linkBase, inviteEmail } from "./email";
import { tenantName } from "./authRoutes";
import { captureEvent } from "./telemetry";

/** Pluggable auth guard — requireOwner (per-tenant host) or requireOperator (console host). */
type Authorize = (request: Request, env: Env) => Promise<Response | null>;

function publicMember(u: UserRecord) {
  return { email: u.email, role: roleOf(u), status: u.status, createdAt: u.createdAt };
}

/** GET team — list a tenant's members. */
export async function handleTeamList(
  slug: string,
  request: Request,
  env: Env,
  authorize: Authorize,
): Promise<Response> {
  const denied = await authorize(request, env);
  if (denied) return denied;
  const members = (await listUsers(env, slug)).map(publicMember).sort((a, b) => a.email.localeCompare(b.email));
  return json({ members }, { headers: { "cache-control": "no-store" } });
}

/** POST team/invite { email, role } — invite a teammate (emails the link if configured). */
export async function handleTeamInvite(
  slug: string,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  authorize: Authorize,
): Promise<Response> {
  const denied = await authorize(request, env);
  if (denied) return denied;

  let body: { email?: unknown; role?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "bad_request", "Body must be JSON { email, role }.");
  }
  const email = normalizeEmail(String(body.email ?? ""));
  if (!email.includes("@")) return apiError(400, "bad_request", "A valid email is required.");
  const role: UserRole = body.role === "owner" ? "owner" : "editor";

  const existing = await getUser(env, slug, email);
  if (existing && existing.status === "active") {
    return apiError(409, "already_member", "That person is already an active member.");
  }

  const token = await createInvite(env, slug, email, role);
  await putUser(env, slug, {
    email,
    salt: existing?.salt ?? "",
    hash: existing?.hash ?? "",
    status: "invited",
    role,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });
  const activateUrl = `${linkBase(request, env)}/admin/activate?token=${token}`;
  const tpl = inviteEmail(activateUrl, await tenantName(env, slug));
  const mail = await sendEmail(env, { to: email, ...tpl });
  captureEvent(env, ctx, email, "user_invited", { slug, role, emailed: mail.sent });
  return json({ ok: true, email, role, activateUrl, emailed: mail.sent });
}

/** POST team/update { email, role?, status? } — change a member (last-owner protected). */
export async function handleTeamUpdate(
  slug: string,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  authorize: Authorize,
): Promise<Response> {
  const denied = await authorize(request, env);
  if (denied) return denied;

  let body: { email?: unknown; role?: unknown; status?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError(400, "bad_request", "Body must be JSON.");
  }
  const email = normalizeEmail(String(body.email ?? ""));
  const target = await getUser(env, slug, email);
  if (!target) return apiError(404, "not_found", "No such member.");

  const nextRole: UserRole | undefined =
    body.role === "owner" || body.role === "editor" ? body.role : undefined;
  const nextStatus =
    body.status === "active" || body.status === "disabled" ? (body.status as UserRecord["status"]) : undefined;
  if (!nextRole && !nextStatus) return apiError(400, "bad_request", "Provide a role and/or status to change.");

  // Last-owner protection: never leave the tenant with zero active owners.
  const members = await listUsers(env, slug);
  const activeOwners = members.filter((u) => u.status === "active" && roleOf(u) === "owner");
  const targetIsActiveOwner = roleOf(target) === "owner" && target.status === "active";
  const wouldRemoveOwner = (nextRole && nextRole !== "owner") || nextStatus === "disabled";
  if (targetIsActiveOwner && wouldRemoveOwner && activeOwners.length <= 1) {
    return apiError(409, "last_owner", "You can't remove the only owner — promote someone else first.");
  }

  const updated: UserRecord = {
    ...target,
    role: nextRole ?? roleOf(target),
    status: nextStatus ?? target.status,
  };
  await putUser(env, slug, updated);
  captureEvent(env, ctx, email, "team_member_updated", { slug, role: updated.role, status: updated.status });
  return json({ ok: true, member: publicMember(updated) });
}
