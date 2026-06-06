import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The Vantyx admin SPA. In dev it proxies /api + /assets to the Worker (wrangler dev on :8787),
// same-origin like production (where it's served behind Cloudflare Access).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { assetsDir: "_app" },
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:8787",
      "/assets": "http://localhost:8787",
    },
  },
});
