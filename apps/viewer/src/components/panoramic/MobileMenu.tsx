import { useEffect, useState } from "react";
import type { AxisItem, Floor } from "@panorama/shared";
import { Menu, X } from "lucide-react";
import { cn } from "../../lib/ui";
import { timeIcon } from "../../lib/icons";

type Props = {
  floors: Floor[];
  views: AxisItem[];
  times: AxisItem[];
  activeFloorId: string;
  activeViewId: string;
  activeTimeId: string;
  onFloorChange: (id: string) => void;
  onViewChange: (id: string) => void;
  onTimeChange: (id: string) => void;
};

function floorBadge(floor: Floor): string {
  if (floor.floorNumber != null) return String(floor.floorNumber);
  return floor.label.replace(/\D/g, "") || floor.label.slice(0, 2);
}

export function MobileMenu({
  floors,
  views,
  times,
  activeFloorId,
  activeViewId,
  activeTimeId,
  onFloorChange,
  onViewChange,
  onTimeChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const sorted = [...floors].sort((a, b) => a.order - b.order);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="absolute right-6 top-6 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white shadow-lg backdrop-blur-md active:scale-95"
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-40 flex flex-col bg-black/80 backdrop-blur-xl transition-all duration-300",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <h2 className="text-xl font-bold tracking-wide text-white">Controls</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          <section>
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-white/50">Floor Level</h3>
            <div className="grid grid-cols-4 gap-3">
              {sorted.map((floor) => (
                <button
                  key={floor.id}
                  onClick={() => onFloorChange(floor.id)}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-xl border text-sm font-bold transition-all",
                    activeFloorId === floor.id
                      ? "border-white bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  )}
                >
                  {floorBadge(floor)}
                </button>
              ))}
            </div>
          </section>

          {views.length > 1 && (
          <section>
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-white/50">Perspective</h3>
            <div className="flex flex-col gap-2">
              {views.map((view) => (
                <button
                  key={view.id}
                  onClick={() => onViewChange(view.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                    activeViewId === view.id
                      ? "border-white/50 bg-white/10 text-white"
                      : "border-white/10 bg-transparent text-white/60 hover:bg-white/5",
                  )}
                >
                  <span className="text-sm font-medium">{view.label}</span>
                  {activeViewId === view.id && (
                    <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                  )}
                </button>
              ))}
            </div>
          </section>
          )}

          <section>
            <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-white/50">Time of Day</h3>
            <div className="flex justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5">
              {times.map((time) => {
                const Icon = timeIcon(time.icon ?? time.id);
                return (
                  <button
                    key={time.id}
                    onClick={() => onTimeChange(time.id)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-1 rounded-xl py-3 transition-all",
                      activeTimeId === time.id
                        ? "bg-white/10 text-white shadow-sm"
                        : "text-white/40 hover:text-white/70",
                    )}
                  >
                    <Icon size={20} />
                    <span className="text-[10px] font-medium">{time.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
