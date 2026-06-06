export class ConsoleError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ConsoleError";
    this.code = code;
  }
}

async function jsonOrThrow<T>(res: Response, what: string): Promise<T> {
  if (res.status === 401 || res.status === 403) {
    throw new ConsoleError("unauthorized", "Operator access required — sign in via Cloudflare Access.");
  }
  if (res.status === 503) {
    throw new ConsoleError("not_configured", "Cloudflare Access isn't configured for the console yet.");
  }
  if (!res.ok) {
    let msg = `${what} failed (HTTP ${res.status}).`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b?.error) msg = b.error;
    } catch {
      /* ignore */
    }
    throw new ConsoleError("request_failed", msg);
  }
  return (await res.json()) as T;
}

export type Role = "owner" | "editor";
export type Project = {
  slug: string;
  name: string;
  version: number;
  floors: number;
  publishedAt: string | null;
};
export type TeamMember = {
  email: string;
  role: Role;
  status: "invited" | "active" | "disabled";
  createdAt: string;
};

export async function getProjects(): Promise<Project[]> {
  const res = await fetch("/api/console/projects", { headers: { accept: "application/json" } });
  return (await jsonOrThrow<{ projects: Project[] }>(res, "Load projects")).projects;
}

export async function getTeam(slug: string): Promise<TeamMember[]> {
  const res = await fetch(`/api/console/projects/${slug}/team`, { headers: { accept: "application/json" } });
  return (await jsonOrThrow<{ members: TeamMember[] }>(res, "Load team")).members;
}

export async function inviteTeammate(
  slug: string,
  email: string,
  role: Role,
): Promise<{ email: string; role: Role; activateUrl: string; emailed: boolean }> {
  const res = await fetch(`/api/console/projects/${slug}/team/invite`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  return jsonOrThrow(res, "Invite teammate");
}

export async function updateTeammate(
  slug: string,
  email: string,
  patch: { role?: Role; status?: "active" | "disabled" },
): Promise<TeamMember> {
  const res = await fetch(`/api/console/projects/${slug}/team/update`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, ...patch }),
  });
  return (await jsonOrThrow<{ member: TeamMember }>(res, "Update teammate")).member;
}

export function viewerUrl(slug: string): string {
  return `https://${slug}.tryvantyx.space/`;
}
export function adminUrl(slug: string): string {
  return `https://${slug}.tryvantyx.space/admin`;
}

// PostHog project (logs / analytics) — operators deep-link here for observability.
export const POSTHOG_URL = "https://us.posthog.com/project/367343";
