import { useEffect, useState } from "react";
import { getProjects, viewerUrl, adminUrl, POSTHOG_URL, type Project } from "./api";
import { TeamModal } from "./components/TeamModal";
import { cn } from "./lib/ui";

type Status = "loading" | "ready" | "error";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [team, setTeam] = useState<Project | null>(null);

  useEffect(() => {
    let active = true;
    getProjects()
      .then((p) => {
        if (!active) return;
        setProjects(p);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col px-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 py-4">
        <div className="text-base font-semibold tracking-tight">
          <span className="text-indigo-300">Vantyx</span>
          <span className="px-2 text-white/30">·</span>
          <span className="text-white/90">Console</span>
        </div>
        <a
          href={POSTHOG_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto rounded-md bg-white/5 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          Logs &amp; analytics ↗
        </a>
      </header>

      <main className="flex-1 py-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-sm font-medium text-white/80">Projects {status === "ready" && `(${projects.length})`}</h1>
          <span className="text-xs text-white/35">New project: <code className="text-white/55">bun run new-client …</code></span>
        </div>

        {status === "loading" && <p className="py-10 text-center text-sm text-white/40">Loading projects…</p>}
        {status === "error" && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-sm text-rose-200/80">
            {error}
          </div>
        )}
        {status === "ready" && projects.length === 0 && (
          <p className="py-10 text-center text-sm text-white/40">No projects yet — provision one with the new-client CLI.</p>
        )}

        {status === "ready" && projects.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs text-white/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Project</th>
                  <th className="px-4 py-2 font-medium">Live</th>
                  <th className="px-4 py-2 font-medium">Floors</th>
                  <th className="px-4 py-2 font-medium">Published</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.slug} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="text-white/90">{p.name}</div>
                      <div className="text-xs text-white/40">{p.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-white/60">v{p.version}</td>
                    <td className="px-4 py-3 text-white/60">{p.floors}</td>
                    <td className="px-4 py-3 text-white/50">{fmt(p.publishedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <a href={viewerUrl(p.slug)} target="_blank" rel="noreferrer" className={linkCls}>Viewer ↗</a>
                        <a href={adminUrl(p.slug)} target="_blank" rel="noreferrer" className={linkCls}>Admin ↗</a>
                        <button onClick={() => setTeam(p)} className={cn(linkCls, "bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25")}>
                          Team
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {team && <TeamModal slug={team.slug} name={team.name} onClose={() => setTeam(null)} />}
    </div>
  );
}

const linkCls = "rounded-md bg-white/5 px-2 py-1 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white";
