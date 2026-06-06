import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { getTeam, inviteTeammate, updateTeammate, type TeamMember, type Role } from "../api";
import { cn } from "../lib/ui";

const TONE: Record<string, string> = {
  owner: "bg-indigo-500/20 text-indigo-200",
  editor: "bg-white/10 text-white/70",
  active: "bg-emerald-500/15 text-emerald-300",
  invited: "bg-amber-500/15 text-amber-300",
  disabled: "bg-rose-500/15 text-rose-300",
};
function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[kind] ?? "bg-white/10")}>{children}</span>;
}

export function TeamModal({ slug, name, onClose }: { slug: string; name: string; onClose: () => void }) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");

  async function load() {
    try {
      setMembers(await getTeam(slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the team");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return setError("Enter a valid email.");
    setBusy("invite");
    setError("");
    setToast("");
    try {
      const res = await inviteTeammate(slug, email, role);
      setToast(res.emailed ? `Invite emailed to ${res.email}.` : `Invite link: ${res.activateUrl}`);
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(null);
    }
  }

  async function patch(m: TeamMember, p: { role?: Role; status?: "active" | "disabled" }) {
    setBusy(m.email);
    setError("");
    setToast("");
    try {
      await updateTeammate(slug, m.email, p);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-sm font-semibold text-white/90">
            Team · <span className="text-indigo-300">{name}</span>
          </h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white">
            Close
          </button>
        </header>

        <form onSubmit={invite} className="flex flex-wrap items-end gap-2 border-b border-white/10 px-5 py-4">
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1 block text-xs text-white/50">Invite by email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/60"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-white/50">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/60"
            >
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={busy === "invite"}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              busy === "invite" ? "bg-indigo-500/40 text-white/50" : "bg-indigo-500 text-white hover:bg-indigo-400",
            )}
          >
            Send invite
          </button>
        </form>

        {(error || toast) && (
          <p className={cn("break-all px-5 pt-3 text-xs", error ? "text-rose-300" : "text-emerald-300")}>{error || toast}</p>
        )}

        <div className="max-h-[50vh] overflow-auto p-2">
          {members === null ? (
            <p className="p-4 text-sm text-white/40">Loading…</p>
          ) : members.length === 0 ? (
            <p className="p-4 text-sm text-white/40">No members yet.</p>
          ) : (
            members.map((m) => {
              const acting = busy === m.email;
              return (
                <div key={m.email} className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/5">
                  <span className="text-sm text-white/85">{m.email}</span>
                  <Badge kind={m.role}>{m.role}</Badge>
                  <Badge kind={m.status}>{m.status}</Badge>
                  <div className="ml-auto flex gap-1.5">
                    <button
                      onClick={() => patch(m, { role: m.role === "owner" ? "editor" : "owner" })}
                      disabled={acting}
                      className="rounded-md bg-white/5 px-2 py-1 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                    >
                      {m.role === "owner" ? "Make editor" : "Make owner"}
                    </button>
                    <button
                      onClick={() => patch(m, { status: m.status === "disabled" ? "active" : "disabled" })}
                      disabled={acting || m.status === "invited"}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-40",
                        m.status === "disabled"
                          ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                          : "bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
                      )}
                    >
                      {m.status === "disabled" ? "Enable" : "Disable"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
