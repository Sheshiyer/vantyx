import type { TenantConfig, ConfigResponse } from "@panorama/shared";

// In a static build (VITE_STATIC=1) the viewer is self-contained: it reads the config from an
// inlined global or a co-located config.json, and assets from ./assets. Otherwise it talks to
// the Worker (same-origin /api/config + /assets), which resolves the tenant from the host.
const STATIC = import.meta.env.VITE_STATIC === "1";

export class ConfigError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ConfigError";
    this.code = code;
  }
}

export async function fetchConfig(): Promise<TenantConfig> {
  return STATIC ? fetchStaticConfig() : fetchWorkerConfig();
}

async function fetchWorkerConfig(): Promise<TenantConfig> {
  let res: Response;
  try {
    res = await fetch("/api/config", { headers: { accept: "application/json" } });
  } catch {
    throw new ConfigError("network", "Couldn’t reach the server. Is the Worker running?");
  }
  if (res.status === 404) {
    throw new ConfigError("not_provisioned", "This panorama hasn’t been set up yet.");
  }
  if (!res.ok) {
    throw new ConfigError("fetch_failed", `Failed to load configuration (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as ConfigResponse;
  return data.config;
}

async function fetchStaticConfig(): Promise<TenantConfig> {
  const inline = (globalThis as { __PANORAMA_CONFIG__?: TenantConfig }).__PANORAMA_CONFIG__;
  if (inline) return inline;
  let res: Response;
  try {
    res = await fetch("config.json", { headers: { accept: "application/json" } });
  } catch {
    throw new ConfigError("network", "Couldn’t load config.json — serve this folder with a static server.");
  }
  if (!res.ok) {
    throw new ConfigError("fetch_failed", `Failed to load config.json (HTTP ${res.status}).`);
  }
  return (await res.json()) as TenantConfig;
}

/** Resolve a stored object key to a URL: same-origin Worker route, or relative path in a static build. */
export function assetUrl(key: string): string {
  return STATIC ? `assets/${key}` : `/assets/${key}`;
}
