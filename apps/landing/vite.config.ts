import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The Vantyx marketing landing page. Served at the apex (tryvantyx.space) from `.assets/landing/`
// (hence base=/landing/). In dev it proxies /api to the Worker (wrangler dev :8787).
export default defineConfig({
  base: "/landing/",
  plugins: [react(), tailwindcss()],
  build: { assetsDir: "_app" },
  server: {
    port: 5178,
    proxy: { "/api": "http://localhost:8787" },
  },
});
