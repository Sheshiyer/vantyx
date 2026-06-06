import type { HistoryEntry } from "../api";
import { cn } from "../lib/ui";

type Props = {
  version: number;
  dirty: boolean;
  busy: string | null;
  toast: string | null;
  onSave: () => void;
  onPublish: () => void;
  history: HistoryEntry[] | null;
  showHistory: boolean;
  onToggleHistory: () => void;
  onRollback: (version: number) => void;
};

function fmt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function PublishBar({
  version,
  dirty,
  busy,
  toast,
  onSave,
  onPublish,
  history,
  showHistory,
  onToggleHistory,
  onRollback,
}: Props) {
  return (
    <footer className="relative border-t border-white/10 bg-[#0b1220]/95 px-6 py-3 backdrop-blur">
      {showHistory && (
        <div className="absolute bottom-full right-6 mb-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#0b1220] shadow-2xl">
          <div className="border-b border-white/10 px-3 py-2 text-xs font-medium text-white/70">
            Version history
          </div>
          <div className="max-h-64 overflow-auto">
            {history === null ? (
              <p className="px-3 py-3 text-xs text-white/40">Loading…</p>
            ) : history.length === 0 ? (
              <p className="px-3 py-3 text-xs text-white/40">No earlier versions yet.</p>
            ) : (
              history.map((h) => (
                <div
                  key={h.version}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-white/5"
                >
                  <span className="text-white/70">
                    v{h.version}
                    {h.savedAt && <span className="ml-2 text-white/35">{fmt(h.savedAt)}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRollback(h.version)}
                    disabled={!!busy}
                    className={cn(
                      "rounded-md px-2 py-1 font-medium transition-colors",
                      busy
                        ? "cursor-not-allowed bg-white/5 text-white/30"
                        : "bg-white/10 text-white hover:bg-white/20",
                    )}
                  >
                    Restore
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-white/40">Live v{version}</span>
        <span className={dirty ? "text-amber-300" : "text-emerald-300"}>
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        {busy && <span className="text-white/60">{busy}</span>}
        {toast && <span className="text-white/80">{toast}</span>}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onToggleHistory}
            className={cn(
              "rounded-lg px-3 py-1.5 font-medium transition-colors",
              showHistory ? "bg-white/20 text-white" : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            History
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!!busy || !dirty}
            className={cn(
              "rounded-lg px-3 py-1.5 font-medium transition-colors",
              !!busy || !dirty
                ? "cursor-not-allowed bg-white/5 text-white/30"
                : "bg-white/10 text-white hover:bg-white/20",
            )}
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={!!busy}
            className={cn(
              "rounded-lg px-4 py-1.5 font-semibold transition-colors",
              busy
                ? "cursor-not-allowed bg-indigo-500/40 text-white/50"
                : "bg-indigo-500 text-white hover:bg-indigo-400",
            )}
          >
            Publish
          </button>
        </div>
      </div>
    </footer>
  );
}
