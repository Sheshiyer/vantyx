import { configKvKey } from "@panorama/shared";
import type { Env } from "./env";
import { json } from "./http";
import { requireOperator } from "./access";
import { listTenants } from "./gc";

export type ProjectSummary = {
  slug: string;
  name: string;
  version: number;
  floors: number;
  publishedAt: string | null;
};

/** GET /api/console/projects — overview of every tenant (operator only). */
export async function handleConsoleProjects(request: Request, env: Env): Promise<Response> {
  const denied = await requireOperator(request, env);
  if (denied) return denied;

  const slugs = await listTenants(env);
  const projects: ProjectSummary[] = [];
  for (const slug of slugs) {
    // Light, resilient read — pick fields without a full schema parse so one bad config never breaks the list.
    const cfg = (await env.CONFIG.get(configKvKey(slug), "json")) as
      | { tenant?: { name?: string }; version?: number; floors?: unknown[]; publishedAt?: string }
      | null;
    projects.push({
      slug,
      name: cfg?.tenant?.name ?? slug,
      version: typeof cfg?.version === "number" ? cfg.version : 0,
      floors: Array.isArray(cfg?.floors) ? cfg.floors.length : 0,
      publishedAt: cfg?.publishedAt ?? null,
    });
  }
  projects.sort((a, b) => a.name.localeCompare(b.name));
  return json({ projects }, { headers: { "cache-control": "no-store" } });
}
