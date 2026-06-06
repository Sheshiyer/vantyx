import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The Vantyx operator console. Served behind Cloudflare Access at admin.tryvantyx.space, from
// `.assets/console/` (hence base=/console/). In dev it proxies /api to the Worker (wrangler dev :8787).
export default defineConfig({
  base: "/console/",
  plugins: [react(), tailwindcss()],
  build: { assetsDir: "_app" },
  server: {
    port: 5176,
    proxy: { "/api": "http://localhost:8787" },
  },
});
