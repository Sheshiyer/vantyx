import { useCallback, useMemo, useRef, useState } from "react";
import type { TenantConfig } from "@panorama/shared";
import { assetUrl } from "../../api";
import { initialSelection, resolveSelection } from "../../lib/scenes";
import { PanoramaViewer, type ViewerControls } from "./PanoramaViewer";
import { FloorSidebar } from "./FloorSidebar";
import { TimeSelector } from "./TimeSelector";
import { ViewSelector } from "./ViewSelector";
import { ControlPanel } from "./ControlPanel";
import { MobileMenu } from "./MobileMenu";
import { InfoPill } from "./InfoPill";

export function PanoramaShell({ config }: { config: TenantConfig }) {
  const initial = useMemo(() => initialSelection(config), [config]);
  const [floorId, setFloorId] = useState(initial?.floorId ?? "");
  const [viewId, setViewId] = useState(initial?.viewId ?? "");
  const [timeId, setTimeId] = useState(initial?.timeId ?? "");
  const [isRotating, setIsRotating] = useState(false);
  const controls = useRef<ViewerControls | null>(null);

  const apply = useCallback(
    (next: { floorId?: string; viewId?: string; timeId?: string }) => {
      const resolved = resolveSelection(
        config,
        next.floorId ?? floorId,
        next.viewId ?? viewId,
        next.timeId ?? timeId,
      );
      if (resolved) {
        setFloorId(resolved.floorId);
        setViewId(resolved.viewId);
        setTimeId(resolved.timeId);
      }
    },
    [config, floorId, viewId, timeId],
  );

  if (!initial) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-white/70">
        No panoramas have been added yet.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black font-sans selection:bg-white/30">
      <PanoramaViewer ref={controls} config={config} floorId={floorId} viewId={viewId} timeId={timeId} />

      {/* Header gradient + logos + info pill */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center pt-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-black/90 via-black/40 to-transparent" />
        <div className="pointer-events-auto mb-6 flex items-center gap-8">
          {config.branding.logo && (
            <img
              src={assetUrl(config.branding.logo)}
              alt={config.branding.appTitle}
              className="h-16 w-auto drop-shadow-2xl transition-transform hover:scale-105"
            />
          )}
          {config.branding.secondaryLogos.map((logo, i) => (
            <img
              key={i}
              src={assetUrl(logo)}
              alt="Partner logo"
              className="h-12 w-auto opacity-90 grayscale drop-shadow-2xl transition-all duration-300 hover:grayscale-0"
            />
          ))}
        </div>
        <div className="animate-fade-in pointer-events-auto">
          <InfoPill config={config} floorId={floorId} viewId={viewId} timeId={timeId} />
        </div>
      </div>

      {/* Desktop controls */}
      <div className="hidden md:block">
        <FloorSidebar floors={config.floors} activeFloorId={floorId} onFloorChange={(id) => apply({ floorId: id })} />
        {config.views.length > 1 && (
          <ViewSelector views={config.views} activeViewId={viewId} onViewChange={(id) => apply({ viewId: id })} />
        )}
        <TimeSelector times={config.times} activeTimeId={timeId} onTimeChange={(id) => apply({ timeId: id })} />
      </div>

      <ControlPanel
        isRotating={isRotating}
        onZoomIn={() => controls.current?.zoomIn()}
        onZoomOut={() => controls.current?.zoomOut()}
        onReset={() => controls.current?.reset()}
        onFullscreen={() => controls.current?.fullscreen()}
        onToggleRotate={() => setIsRotating(controls.current?.toggleAutoRotate() ?? false)}
      />

      {/* Mobile controls */}
      <div className="md:hidden">
        <MobileMenu
          floors={config.floors}
          views={config.views}
          times={config.times}
          activeFloorId={floorId}
          activeViewId={viewId}
          activeTimeId={timeId}
          onFloorChange={(id) => apply({ floorId: id })}
          onViewChange={(id) => apply({ viewId: id })}
          onTimeChange={(id) => apply({ timeId: id })}
        />
      </div>
    </div>
  );
}
