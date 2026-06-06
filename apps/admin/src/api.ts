import type { TenantConfig } from "@panorama/shared";

export class AdminError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AdminError";
    this.code = code;
  }
}

async function jsonOrThrow<T>(res: Response, what: string): Promise<T> {
  if (res.status === 401 || res.status === 403) {
    throw new AdminError("unauthorized", "Your session ended — please sign in again.");
  }
  if (!res.ok) {
    let msg = `${what} failed (HTTP ${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new AdminError("request_failed", msg);
  }
  return (await res.json()) as T;
}

/** GET the DRAFT config (the builder's working copy). */
export async function getDraft(): Promise<TenantConfig> {
  const res = await fetch("/api/config?draft=1", { headers: { accept: "application/json" } });
  return (await jsonOrThrow<{ config: TenantConfig }>(res, "Load draft")).config;
}

/** PUT the draft (live tour untouched). */
export async function putDraft(config: TenantConfig): Promise<void> {
  const res = await fetch("/api/config", {
    method: "PUT",
    // If-Match = optimistic concurrency: server 409s if another editor moved the project.
    headers: { "content-type": "application/json", "if-match": String(config.version) },
    body: JSON.stringify({ config }),
  });
  await jsonOrThrow(res, "Save draft");
}

/** Upload an already-downscaled image; returns the new rev key to stage into the draft. */
export async function uploadImage(
  coords: { floorId: string; timeId: string; viewId: string },
  blob: Blob,
): Promise<string> {
  const q = new URLSearchParams(coords).toString();
  const res = await fetch(`/api/uploads?${q}`, {
    method: "POST",
    headers: { "content-type": "image/jpeg" },
    body: blob,
  });
  return (await jsonOrThrow<{ key: string }>(res, "Upload")).key;
}

/** Atomic publish (draft → live). Returns the new version + the freshly-published config. */
export async function publish(baseVersion: number): Promise<{ version: number; config: TenantConfig }> {
  const res = await fetch("/api/publish", {
    method: "POST",
    headers: { "if-match": String(baseVersion) },
  });
  return jsonOrThrow<{ version: number; config: TenantConfig }>(res, "Publish");
}

/** Roll the live tour back to an archived version; returns the new live version + its config. */
export async function rollback(version: number): Promise<{ version: number; config: TenantConfig }> {
  const res = await fetch("/api/rollback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ version }),
  });
  return jsonOrThrow<{ version: number; config: TenantConfig }>(res, "Rollback");
}

export type HistoryEntry = { version: number; savedAt: string | null };

/** Archived versions available to roll back to (newest first). */
export async function getHistory(): Promise<HistoryEntry[]> {
  const res = await fetch("/api/config/history", { headers: { accept: "application/json" } });
  return (await jsonOrThrow<{ versions: HistoryEntry[] }>(res, "Load history")).versions;
}

export function assetUrl(key: string): string {
  return `/assets/${key}`;
}

// ---- team (owner-only) ----

export type TeamMember = {
  email: string;
  role: Role;
  status: "invited" | "active" | "disabled";
  createdAt: string;
};

export async function getTeam(): Promise<TeamMember[]> {
  const res = await fetch("/api/team", { headers: { accept: "application/json" } });
  return (await jsonOrThrow<{ members: TeamMember[] }>(res, "Load team")).members;
}

export async function inviteTeammate(
  email: string,
  role: Role,
): Promise<{ email: string; role: Role; activateUrl: string; emailed: boolean }> {
  const res = await fetch("/api/team/invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  return jsonOrThrow(res, "Invite teammate");
}

export async function updateTeammate(
  email: string,
  patch: { role?: Role; status?: "active" | "disabled" },
): Promise<TeamMember> {
  const res = await fetch("/api/team/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, ...patch }),
  });
  return (await jsonOrThrow<{ member: TeamMember }>(res, "Update teammate")).member;
}

// ---- auth ----

export type Role = "owner" | "editor";
export type Me = { email: string; slug: string; role: Role };

export async function getMe(): Promise<Me | null> {
  const res = await fetch("/api/auth/me", { headers: { accept: "application/json" } });
  if (res.status === 401) return null;
  if (!res.ok) throw new AdminError("request_failed", "Couldn't check your session.");
  return (await res.json()) as Me;
}

async function authPost<T = unknown>(path: string, body: unknown, what: string): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `${what} failed (HTTP ${res.status}).`;
    if (res.status === 429) msg = "Too many attempts — please wait a few minutes and try again.";
    try {
      const b = (await res.json()) as { error?: string };
      if (b?.error) msg = b.error;
    } catch {
      /* ignore */
    }
    throw new AdminError("auth_failed", msg);
  }
  return (await res.json().catch(() => ({}))) as T;
}

export type AuthConfig = { turnstileSiteKey: string | null };

/** Public SPA bootstrap — currently just the Turnstile site key (null = widget disabled). */
export async function getAuthConfig(): Promise<AuthConfig> {
  try {
    const res = await fetch("/api/auth/config", { headers: { accept: "application/json" } });
    if (!res.ok) return { turnstileSiteKey: null };
    return (await res.json()) as AuthConfig;
  } catch {
    return { turnstileSiteKey: null };
  }
}

export const login = (email: string, password: string, turnstileToken?: string) =>
  authPost("/api/auth/login", { email, password, turnstileToken }, "Sign in");
export const activate = (token: string, password: string, turnstileToken?: string) =>
  authPost("/api/auth/activate", { token, password, turnstileToken }, "Activate");
/** Request a password reset. With no email provider, the server returns the link for the operator. */
export const requestReset = (email: string) =>
  authPost<{ ok: boolean; resetUrl?: string }>("/api/auth/reset-request", { email }, "Reset request");
export const resetPassword = (token: string, password: string, turnstileToken?: string) =>
  authPost("/api/auth/reset", { token, password, turnstileToken }, "Reset password");
export const logout = () => fetch("/api/auth/logout", { method: "POST" }).then(() => undefined);

