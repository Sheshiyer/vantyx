import { useState } from "react";
import type { Floor } from "@panorama/shared";
import { cn } from "../../lib/ui";

type Props = {
  floors: Floor[];
  activeFloorId: string;
  onFloorChange: (id: string) => void;
};

function floorBadge(floor: Floor): string {
  if (floor.floorNumber != null) return String(floor.floorNumber);
  const digits = floor.label.replace(/\D/g, "");
  return digits || floor.label.slice(0, 2);
}

export function FloorSidebar({ floors, activeFloorId, onFloorChange }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const sorted = [...floors].sort((a, b) => a.order - b.order);

  return (
    <nav className="absolute left-6 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-4">
      <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
      <ul className="relative space-y-3">
        {sorted.map((floor) => {
          const isActive = activeFloorId === floor.id;
          return (
            <li key={floor.id} className="group relative">
              <div
                className={cn(
                  "absolute left-full top-1/2 ml-4 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/80 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md transition-all duration-300",
                  hovered === floor.id || isActive
                    ? "translate-x-0 opacity-100"
                    : "pointer-events-none -translate-x-2 opacity-0",
                )}
              >
                {floor.label}
                <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-black/80" />
              </div>
              <button
                onClick={() => onFloorChange(floor.id)}
                onMouseEnter={() => setHovered(floor.id)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300",
                  isActive
                    ? "scale-110 border-white bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                    : "border-white/20 bg-black/40 text-white/70 hover:border-white/50 hover:bg-black/60 hover:text-white",
                )}
              >
                <span className="text-sm font-bold">{floorBadge(floor)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
