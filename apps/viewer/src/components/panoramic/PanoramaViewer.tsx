import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { TenantConfig } from "@panorama/shared";
import { loadPannellum } from "../../lib/pannellumLoader";
import { buildScenes, sceneId, clamp } from "../../lib/scenes";
import type { PannellumViewer } from "../../types/pannellum";

export type ViewerControls = {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  toggleAutoRotate: () => boolean;
  fullscreen: () => void;
};

type Props = {
  config: TenantConfig;
  floorId: string;
  viewId: string;
  timeId: string;
  onReady?: () => void;
};

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

function welcomeHtml(name: string): string {
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">
    <span style="font-size:1.1rem;letter-spacing:.2em;text-transform:uppercase;opacity:.85">Welcome to</span>
    <span style="font-size:1.9rem;font-weight:700;letter-spacing:-.01em">${escapeHtml(name)}</span>
    <span style="font-size:.85rem;opacity:.65;margin-top:.4rem">Click to explore</span>
  </div>`;
}

export const PanoramaViewer = forwardRef<ViewerControls, Props>(function PanoramaViewer(
  { config, floorId, viewId, timeId, onReady },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<PannellumViewer | null>(null);
  const scenesRef = useRef<Set<string>>(new Set());
  const lastSceneRef = useRef<string | null>(null);
  const rotatingRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn() {
        const v = viewerRef.current;
        if (v) v.setHfov(clamp(v.getHfov() - 12, config.viewerDefaults.minHfov, config.viewerDefaults.maxHfov), 300);
      },
      zoomOut() {
        const v = viewerRef.current;
        if (v) v.setHfov(clamp(v.getHfov() + 12, config.viewerDefaults.minHfov, config.viewerDefaults.maxHfov), 300);
      },
      reset() {
        const v = viewerRef.current;
        if (!v) return;
        v.setYaw(0, 600);
        v.setPitch(0, 600);
        v.setHfov(config.viewerDefaults.defaultHfov, 600);
      },
      toggleAutoRotate() {
        const v = viewerRef.current;
        if (!v) return rotatingRef.current;
        rotatingRef.current = !rotatingRef.current;
        if (rotatingRef.current) v.startAutoRotate(config.viewerDefaults.autoRotateSpeed || -2);
        else v.stopMovement();
        return rotatingRef.current;
      },
      fullscreen() {
        viewerRef.current?.toggleFullscreen();
      },
    }),
    [config],
  );

  // Initialize once per config.
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const pannellum = await loadPannellum();
      if (!mounted || !containerRef.current) return;

      const scenes = buildScenes(config);
      scenesRef.current = new Set(Object.keys(scenes));
      const wanted = sceneId(floorId, viewId, timeId);
      const first = scenesRef.current.has(wanted) ? wanted : (Object.keys(scenes)[0] ?? "");
      lastSceneRef.current = first || null;

      viewerRef.current = pannellum.viewer(containerRef.current, {
        autoLoad: false,
        showControls: false,
        compass: config.viewerDefaults.compass,
        strings: { loadButtonLabel: welcomeHtml(config.tenant.name) },
        default: {
          firstScene: first,
          sceneFadeDuration: config.viewerDefaults.sceneFadeDuration,
          hfov: config.viewerDefaults.defaultHfov,
          minHfov: config.viewerDefaults.minHfov,
          maxHfov: config.viewerDefaults.maxHfov,
        },
        scenes,
      });

      if (onReady) viewerRef.current.on("load", onReady);
    })();

    return () => {
      mounted = false;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
    // Re-init only when the config changes (rare — on load).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Switch scenes on selection change.
  useEffect(() => {
    const id = sceneId(floorId, viewId, timeId);
    const v = viewerRef.current;
    if (v && scenesRef.current.has(id) && lastSceneRef.current !== id) {
      v.loadScene(id);
      lastSceneRef.current = id;
    }
  }, [floorId, viewId, timeId]);

  return <div ref={containerRef} className="absolute inset-0" />;
});
