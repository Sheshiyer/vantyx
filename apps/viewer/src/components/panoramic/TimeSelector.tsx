import type { AxisItem } from "@panorama/shared";
import { cn } from "../../lib/ui";
import { timeIcon } from "../../lib/icons";

type Props = {
  times: AxisItem[];
  activeTimeId: string;
  onTimeChange: (id: string) => void;
};

export function TimeSelector({ times, activeTimeId, onTimeChange }: Props) {
  return (
    <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 p-1.5 shadow-lg backdrop-blur-md">
      <ul className="flex items-center gap-1">
        {times.map((time) => {
          const Icon = timeIcon(time.icon ?? time.id);
          const isActive = activeTimeId === time.id;
          return (
            <li key={time.id}>
              <button
                onClick={() => onTimeChange(time.id)}
                title={time.label}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300",
                  isActive
                    ? "scale-110 border-white bg-white text-black shadow-md"
                    : "border-transparent text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon size={20} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
