import { ZoomIn, ZoomOut, RotateCcw, Maximize, Play, Pause } from "lucide-react";

type Props = {
  isRotating: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullscreen: () => void;
  onToggleRotate: () => void;
};

const BTN =
  "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white transition-colors hover:bg-white/10";

export function ControlPanel({
  isRotating,
  onZoomIn,
  onZoomOut,
  onReset,
  onFullscreen,
  onToggleRotate,
}: Props) {
  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-4">
      <div className="rounded-full bg-black/20 p-2 backdrop-blur-sm">
        <ul className="flex items-center space-x-2">
          <li>
            <button onClick={onZoomOut} className={BTN} title="Zoom out" aria-label="Zoom out">
              <ZoomOut size={20} />
            </button>
          </li>
          <li>
            <button onClick={onZoomIn} className={BTN} title="Zoom in" aria-label="Zoom in">
              <ZoomIn size={20} />
            </button>
          </li>
          <li>
            <button onClick={onReset} className={BTN} title="Reset view" aria-label="Reset view">
              <RotateCcw size={20} />
            </button>
          </li>
          <li>
            <button
              onClick={onToggleRotate}
              className={BTN}
              title={isRotating ? "Pause auto-rotate" : "Auto-rotate"}
              aria-label="Toggle auto-rotate"
            >
              {isRotating ? <Pause size={20} /> : <Play size={20} />}
            </button>
          </li>
          <li>
            <button onClick={onFullscreen} className={BTN} title="Fullscreen" aria-label="Fullscreen">
              <Maximize size={20} />
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
