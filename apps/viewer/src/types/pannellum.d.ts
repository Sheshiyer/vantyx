// Minimal typings for the vendored Pannellum 2.5.6 global (public/vendor/pannellum).
export interface PannellumViewer {
  loadScene(sceneId: string, pitch?: number, yaw?: number, hfov?: number): void;
  getHfov(): number;
  setHfov(hfov: number, animated?: number | boolean): void;
  setPitch(pitch: number, animated?: number | boolean): void;
  setYaw(yaw: number, animated?: number | boolean): void;
  toggleFullscreen(): void;
  startAutoRotate(speed?: number, pitch?: number): void;
  stopMovement(): void;
  on(type: string, listener: (...args: unknown[]) => void): void;
  destroy(): void;
}

export interface Pannellum {
  viewer(container: HTMLElement, config: Record<string, unknown>): PannellumViewer;
}

declare global {
  interface Window {
    pannellum?: Pannellum;
  }
}
