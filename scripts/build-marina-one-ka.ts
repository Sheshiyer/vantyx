/**
 * Build a self-contained STATIC site for marina-one-KA into its web/ folder.
 *
 * Curates the messy source (the real 360° stills live only in each "Panorama 360 View" folder;
 * merges the mis-filed Evening/16th from "Evening 2"), downscales 14400px → 8192px via `sips`,
 * generates + validates the config, builds the viewer in static mode, and assembles:
 *     web/index.html     viewer shell with the config inlined (works even via file://)
 *     web/config.json    same config (fallback for static servers)
 *     web/_app/…         viewer JS/CSS bundles
 *     web/vendor/…       vendored Pannellum
 *     web/assets/<f>f/<time>/360.jpg   downscaled panoramas
 *
 * Run:  bun scripts/build-marina-one-ka.ts
 * View: npx serve <web>   (or deploy the folder to any static host)
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { floorLabelFromNumber, parseTenantConfig, type TenantConfig } from "@panorama/shared";

const ROOT = resolve(import.meta.dirname, "..");
const CLIENT = "/Volumes/madara/2026/twc-vault/01-Projects/thoughtseed/ashwinsheth-group/marina-one-KA";
const SOURCE = join(CLIENT, "source");
const WEB = join(CLIENT, "web");
const MAX_PX = 8192;

const TIMES = [
  { id: "morning", label: "Morning", icon: "sunrise" },
  { id: "evening", label: "Evening", icon: "sunset" },
  { id: "night", label: "Night", icon: "moon" },
];
const VIEW = { id: "360", label: "360°" };

// Curation map: which raw source file is which (floor, time).
// NOTE: Evening's 16th-floor shot is mis-filed under "Evening 2/".
const IMAGES: { src: string; floor: number; time: string }[] = [
  { src: "Morning/Panorama 360 View/6th Floor.jpg", floor: 6, time: "morning" },
  { src: "Morning/Panorama 360 View/11th Floor.jpg", floor: 11, time: "morning" },
  { src: "Morning/Panorama 360 View/16th Floor.jpg", floor: 16, time: "morning" },
  { src: "Morning/Panorama 360 View/21st Floor.jpg", floor: 21, time: "morning" },
  { src: "Morning/Panorama 360 View/25th Floor.jpg", floor: 25, time: "morning" },
  { src: "Evening/Panorama 360 View/6th Floor.jpg", floor: 6, time: "evening" },
  { src: "Evening/Panorama 360 View/11th Floor.jpg", floor: 11, time: "evening" },
  { src: "Evening 2/Panorama 360 View/16th Floor.jpg", floor: 16, time: "evening" },
  { src: "Evening/Panorama 360 View/21st Floor.jpg", floor: 21, time: "evening" },
  { src: "Evening/Panorama 360 View/25th Floor.jpg", floor: 25, time: "evening" },
  // Night — all 5 floors captured cleanly in Night/Panorama 360 View/ (note lowercase "16th floor").
  { src: "Night/Panorama 360 View/6th Floor.jpg", floor: 6, time: "night" },
  { src: "Night/Panorama 360 View/11th Floor.jpg", floor: 11, time: "night" },
  { src: "Night/Panorama 360 View/16th floor.jpg", floor: 16, time: "night" },
  { src: "Night/Panorama 360 View/21st Floor.jpg", floor: 21, time: "night" },
  { src: "Night/Panorama 360 View/25th Floor.jpg", floor: 25, time: "night" },
];

const floors = [...new Set(IMAGES.map((i) => i.floor))].sort((a, b) => a - b);

const config: TenantConfig = parseTenantConfig({
  tenant: { slug: "marina-one-ka", name: "Marina One" },
  branding: { appTitle: "Marina One — 360° Experience" },
  views: [VIEW],
  times: TIMES,
  floors: floors.map((n, i) => ({
    id: `${n}f`,
    label: floorLabelFromNumber(n),
    floorNumber: n,
    order: i + 1,
    slots: IMAGES.filter((im) => im.floor === n).map((im) => ({
      viewId: VIEW.id,
      timeId: im.time,
      image: `${n}f/${im.time}/360.jpg`,
    })),
  })),
});

function sh(cmd: string, opts: { cwd?: string; env?: Record<string, string | undefined> } = {}): void {
  execSync(cmd, { stdio: "inherit", ...opts });
}

console.log(`\n▶ Building static site for marina-one-ka → ${WEB}\n`);

// 1) Clean previous outputs (leave the web/ dir itself).
sh("rm -rf assets _app vendor index.html config.json", { cwd: WEB });

// 2) Downscale + place panoramas at assets/<floor>f/<time>/360.jpg.
console.log(`Downscaling ${IMAGES.length} panoramas to ${MAX_PX}px (sips)…`);
for (const im of IMAGES) {
  const srcPath = join(SOURCE, im.src);
  if (!existsSync(srcPath)) {
    console.error(`✗ missing source image: ${im.src}`);
    process.exit(1);
  }
  const key = `${im.floor}f/${im.time}/360.jpg`;
  const dest = join(WEB, "assets", key);
  mkdirSync(dirname(dest), { recursive: true });
  execSync(`sips -Z ${MAX_PX} ${JSON.stringify(srcPath)} --out ${JSON.stringify(dest)}`, { stdio: "ignore" });
  console.log(`  ✓ ${key}`);
}

// 3) Build the viewer in static mode.
console.log("\nBuilding viewer (static mode)…");
sh("bun run build", { cwd: join(ROOT, "apps/viewer"), env: { ...process.env, VITE_STATIC: "1" } });

// 4) Assemble: viewer dist → web/, then inline the config + write config.json.
sh(`cp -R ${JSON.stringify(join(ROOT, "apps/viewer/dist") + "/.")} ${JSON.stringify(WEB)}`);

const indexPath = join(WEB, "index.html");
const tag = `<script>window.__PANORAMA_CONFIG__=${JSON.stringify(config)}</script>`;
const html = readFileSync(indexPath, "utf8").replace("</head>", `    ${tag}\n  </head>`);
writeFileSync(indexPath, html);
writeFileSync(join(WEB, "config.json"), `${JSON.stringify(config, null, 2)}\n`);

const slots = config.floors.reduce((n, f) => n + f.slots.length, 0);
console.log(`\n✅ Done — ${config.floors.length} floors × ${config.times.length} times = ${slots} panoramas.`);
console.log(`   Output:  ${WEB}`);
console.log(`   Preview: npx serve ${JSON.stringify(WEB)}\n`);
