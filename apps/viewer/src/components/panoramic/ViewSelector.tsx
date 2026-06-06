import type { AxisItem } from "@panorama/shared";
import { cn } from "../../lib/ui";

type Props = {
  views: AxisItem[];
  activeViewId: string;
  onViewChange: (id: string) => void;
};

export function ViewSelector({ views, activeViewId, onViewChange }: Props) {
  return (
    <div className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-black/40 p-1.5 shadow-lg backdrop-blur-md">
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onViewChange(view.id)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-all duration-300",
            activeViewId === view.id
              ? "bg-white text-black shadow-md"
              : "text-white/70 hover:bg-white/10 hover:text-white",
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
