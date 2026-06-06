import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// VITE_STATIC=1 → self-contained static build (relative base; config from an inlined
// window.__PANORAMA_CONFIG__ or co-located config.json). Default build targets the Worker.
const isStatic = process.env.VITE_STATIC === "1";

// The viewer is a static SPA. In dev it proxies /api + /assets to the Worker
// (wrangler dev on :8787) so everything is same-origin, exactly like production.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isStatic ? "./" : "/",
  // App bundles go to /_app so panorama content can live at assets/<key> in both modes.
  build: { assetsDir: "_app" },
  // NOTE: `bun run build` emits a benign esbuild warning — "Cannot find base config file
  // astro/tsconfigs/strict" — from the surrounding Obsidian vault's tsconfig.json (outside this
  // repo). It does not affect output and disappears once this monorepo lives in its own repo root.
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
      "/assets": "http://localhost:8787",
    },
  },
});
