import { useRef } from "react";
import type { TenantConfig, Floor } from "@panorama/shared";
import { assetUrl } from "../api";
import { cn } from "../lib/ui";

type GridProps = {
  config: TenantConfig;
  floor: Floor;
  busy: boolean;
  onReplace: (viewId: string, timeId: string, file: File) => void;
};

export function SlotGrid({ config, floor, busy, onReplace }: GridProps) {
  const singleView = config.views.length <= 1;
  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-white/90">
        {floor.label}
        {floor.elevation != null && (
          <span className="ml-2 text-sm font-normal text-white/40">{floor.elevation} m</span>
        )}
      </h2>

      {config.views.map((view) => (
        <section key={view.id} className="space-y-3">
          {!singleView && (
            <h3 className="text-sm font-medium uppercase tracking-wide text-white/50">{view.label}</h3>
          )}
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, config.times.length)}, minmax(150px, 1fr))` }}
          >
            {config.times.map((time) => {
              const slot = floor.slots.find((s) => s.viewId === view.id && s.timeId === time.id);
              return (
                <SlotCell
                  key={time.id}
                  label={time.label}
                  image={slot?.enabled ? slot.image : undefined}
                  busy={busy}
                  onPick={(file) => onReplace(view.id, time.id, file)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function SlotCell({
  label,
  image,
  busy,
  onPick,
}: {
  label: string;
  image?: string;
  busy: boolean;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
      <div className="aspect-[2/1] bg-black/40">
        {image ? (
          <img src={assetUrl(image)} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/30">No image</div>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-white/70">{label}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            busy ? "cursor-not-allowed text-white/30" : "bg-white/10 text-white hover:bg-white/20",
          )}
        >
          Replace
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
