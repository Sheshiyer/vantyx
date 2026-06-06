import { slotRevObjectKey, tenantBucketKey, UPLOAD_LIMITS } from "@panorama/shared";
import type { Env } from "./env";
import { json, apiError } from "./http";
import { requireAuth } from "./auth";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Short random revision token so each upload writes a NEW key (never overwrites the live image). */
function mintRev(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * POST /api/uploads?floorId=&timeId=&viewId=
 * Accepts an already-downscaled image (the admin downscales browser-side) and stores it at a new
 * per-rev key — non-destructive. Returns the relative key for the admin to stage into the draft.
 */
export async function handleUpload(slug: string, request: Request, env: Env): Promise<Response> {
  const denied = await requireAuth(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const floorId = url.searchParams.get("floorId");
  const timeId = url.searchParams.get("timeId");
  const viewId = url.searchParams.get("viewId");
  if (!floorId || !timeId || !viewId) {
    return apiError(400, "bad_request", "floorId, timeId and viewId query params are required.");
  }

  const contentType = (request.headers.get("content-type") ?? "").split(";")[0]!.trim();
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) {
    return apiError(415, "unsupported_type", `Allowed types: ${UPLOAD_LIMITS.allowedTypes.join(", ")}.`);
  }

  const declaredLen = Number(request.headers.get("content-length") ?? "0");
  if (declaredLen > UPLOAD_LIMITS.maxBytes) {
    return apiError(413, "too_large", `Max ${Math.round(UPLOAD_LIMITS.maxBytes / 1024 / 1024)} MB.`);
  }
  if (!request.body) return apiError(400, "bad_request", "Empty upload body.");

  let relKey: string;
  try {
    relKey = slotRevObjectKey({ floorId, timeId, viewId, rev: mintRev(), ext });
  } catch {
    return apiError(400, "bad_request", "Invalid slot coordinates.");
  }

  await env.MEDIA.put(tenantBucketKey(slug, relKey), request.body, {
    httpMetadata: { contentType },
  });

  return json({ key: relKey });
}
