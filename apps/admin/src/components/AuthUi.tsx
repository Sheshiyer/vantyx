import type { ReactNode } from "react";
import { cn } from "../lib/ui";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="mb-6">
          <div className="text-lg font-semibold tracking-tight text-indigo-300">Vantyx</div>
          <h1 className="mt-2 text-base font-medium text-white/90">{title}</h1>
          {subtitle && <p className="text-xs text-white/50">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  type,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-white/60">{label}</span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-400/60"
      />
    </label>
  );
}

export function Submit({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={cn(
        "w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
        busy ? "cursor-not-allowed bg-indigo-500/40 text-white/50" : "bg-indigo-500 text-white hover:bg-indigo-400",
      )}
    >
      {busy ? "…" : label}
    </button>
  );
}
