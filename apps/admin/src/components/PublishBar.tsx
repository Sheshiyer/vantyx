import { cn } from "../lib/ui";

type Props = {
  version: number;
  dirty: boolean;
  busy: string | null;
  toast: string | null;
  onSave: () => void;
  onPublish: () => void;
};

export function PublishBar({ version, dirty, busy, toast, onSave, onPublish }: Props) {
  return (
    <footer className="border-t border-white/10 bg-[#0b1220]/95 px-6 py-3 backdrop-blur">
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
