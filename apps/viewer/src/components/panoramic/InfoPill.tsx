import type { TenantConfig } from "@panorama/shared";
import { cn } from "../../lib/ui";

type Props = {
  config: TenantConfig;
  floorId: string;
  viewId: string;
  timeId: string;
  className?: string;
};

export function InfoPill({ config, floorId, viewId, timeId, className }: Props) {
  const floorLabel = config.floors.find((f) => f.id === floorId)?.label ?? "";
  const viewLabel = config.views.find((v) => v.id === viewId)?.label ?? "";
  const timeLabel = config.times.find((t) => t.id === timeId)?.label ?? "";

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-full border border-white/10 bg-black/40 px-6 py-2 text-sm font-medium uppercase tracking-wide text-white shadow-lg backdrop-blur-md",
        className,
      )}
    >
      <span className="font-bold text-white/90">{floorLabel}</span>
      {config.views.length > 1 && (
        <>
          <span className="h-4 w-px bg-white/20" />
          <span className="text-white/80">{viewLabel}</span>
        </>
      )}
      <span className="h-4 w-px bg-white/20" />
      <span className="text-white/80">{timeLabel}</span>
    </div>
  );
}
