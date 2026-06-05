import { tenantBucketKey } from "@panorama/shared";
import type { Env } from "./env";

/** GET /assets/* — stream a panorama/branding object from the private R2 bucket. */
export async function handleGetAsset(
  slug: string,
  assetPath: string,
  request: Request,
  env: Env,
): Promise<Response> {
  let key: string;
  try {
    key = tenantBucketKey(slug, assetPath);
  } catch {
    return new Response("Bad asset path", { status: 400 });
  }

  const object = await env.MEDIA.get(key, {
    range: request.headers,
    onlyIf: request.headers,
  });

  if (object === null) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  // R2 returns an R2Object (no `body`) when an `onlyIf` precondition isn't met → 304.
  if (!("body" in object) || object.body === null || object.body === undefined) {
    return new Response(null, { status: 304, headers });
  }

  const status = request.headers.get("range") ? 206 : 200;
  return new Response(object.body, { status, headers });
}
