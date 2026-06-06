import type { TenantConfig } from "@panorama/shared";

export class AdminError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AdminError";
    this.code = code;
  }
}

async function jsonOrThrow<T>(res: Response, what: string): Promise<T> {
  if (res.status === 401 || res.status === 403) {
    throw new AdminError("unauthorized", "Not signed in. This page is protected by Cloudflare Access.");
  }
  if (!res.ok) {
    let msg = `${what} failed (HTTP ${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new AdminError("request_failed", msg);
  }
  return (await res.json()) as T;
}

/** GET the DRAFT config (the builder's working copy). */
export async function getDraft(): Promise<TenantConfig> {
  const res = await fetch("/api/config?draft=1", { headers: { accept: "application/json" } });
  return (await jsonOrThrow<{ config: TenantConfig }>(res, "Load draft")).config;
}

/** PUT the draft (live tour untouched). */
export async function putDraft(config: TenantConfig): Promise<void> {
  const res = await fetch("/api/config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ config }),
  });
  await jsonOrThrow(res, "Save draft");
}

/** Upload an already-downscaled image; returns the new rev key to stage into the draft. */
export async function uploadImage(
  coords: { floorId: string; timeId: string; viewId: string },
  blob: Blob,
): Promise<string> {
  const q = new URLSearchParams(coords).toString();
  const res = await fetch(`/api/uploads?${q}`, {
    method: "POST",
    headers: { "content-type": "image/jpeg" },
    body: blob,
  });
  return (await jsonOrThrow<{ key: string }>(res, "Upload")).key;
}

/** Atomic publish (draft → live). Returns the new live version. */
export async function publish(): Promise<number> {
  const res = await fetch("/api/publish", { method: "POST" });
  return (await jsonOrThrow<{ version: number }>(res, "Publish")).version;
}

/** Roll the live tour back to an archived version. */
export async function rollback(version: number): Promise<number> {
  const res = await fetch("/api/rollback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ version }),
  });
  return (await jsonOrThrow<{ version: number }>(res, "Rollback")).version;
}

export function assetUrl(key: string): string {
  return `/assets/${key}`;
}
