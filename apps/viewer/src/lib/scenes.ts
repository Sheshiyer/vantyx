import type { TenantConfig } from "@panorama/shared";
import { assetUrl } from "../api";

/** Stable Pannellum scene id for a (floor, view, time) cell. */
export function sceneId(floorId: string, viewId: string, timeId: string): string {
  return `${floorId}__${viewId}__${timeId}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export type Scene = {
  type: "equirectangular";
  panorama: string;
  hfov: number;
  yaw: number;
  pitch: number;
};
export type SceneMap = Record<string, Scene>;

/** Build the Pannellum scene graph from the config's enabled slots. */
export function buildScenes(config: TenantConfig): SceneMap {
  const scenes: SceneMap = {};
  for (const floor of config.floors) {
    for (const slot of floor.slots) {
      if (!slot.enabled) continue;
      scenes[sceneId(floor.id, slot.viewId, slot.timeId)] = {
        type: "equirectangular",
        panorama: assetUrl(slot.image),
        hfov: slot.hfov ?? config.viewerDefaults.defaultHfov,
        yaw: slot.defaultYaw ?? 0,
        pitch: slot.defaultPitch ?? 0,
      };
    }
  }
  return scenes;
}

export type Selection = { floorId: string; viewId: string; timeId: string };

/** First enabled slot in floor order — the scene shown on load. */
export function initialSelection(config: TenantConfig): Selection | null {
  const floors = [...config.floors].sort((a, b) => a.order - b.order);
  for (const floor of floors) {
    const slot = floor.slots.find((s) => s.enabled);
    if (slot) return { floorId: floor.id, viewId: slot.viewId, timeId: slot.timeId };
  }
  return null;
}

/**
 * Resolve a desired (floor, view, time) to the nearest available enabled slot, so navigation
 * never lands on a black/empty scene when a tenant's matrix is sparse. Prefers: exact →
 * same view (other time) → same time (other view) → the floor's first slot.
 */
export function resolveSelection(
  config: TenantConfig,
  floorId: string,
  viewId: string,
  timeId: string,
): Selection | null {
  const floor = config.floors.find((f) => f.id === floorId);
  if (!floor) return initialSelection(config);

  const enabled = floor.slots.filter((s) => s.enabled);
  if (enabled.length === 0) return initialSelection(config);

  if (enabled.some((s) => s.viewId === viewId && s.timeId === timeId)) {
    return { floorId, viewId, timeId };
  }
  const sameView = enabled.find((s) => s.viewId === viewId);
  if (sameView) return { floorId, viewId, timeId: sameView.timeId };

  const sameTime = enabled.find((s) => s.timeId === timeId);
  if (sameTime) return { floorId, viewId: sameTime.viewId, timeId };

  const first = enabled[0]!;
  return { floorId, viewId: first.viewId, timeId: first.timeId };
}
