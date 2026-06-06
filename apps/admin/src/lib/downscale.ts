// Browser-side image processing — mirrors the server-side `sips -Z 8192` step in-canvas, so the
// Worker only ever receives (and stores) a ~5 MB asset. The raw ~50 MB 360° never hits the network.

export type ImageMeta = { width: number; height: number };

export async function readImageMeta(file: File): Promise<ImageMeta> {
  const bitmap = await createImageBitmap(file);
  const meta = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return meta;
}

/** Downscale to a max edge of `maxPx`, re-encode as JPEG. Returns the (much smaller) Blob. */
export async function downscaleToJpeg(file: File, maxPx = 8192, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas 2D context unavailable");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Image encoding failed");
  return blob;
}

/** True if the image is (near) 2:1 equirectangular — a soft check we can warn on. */
export function isEquirectangular({ width, height }: ImageMeta, tolerance = 0.04): boolean {
  return Math.abs(width / height - 2) <= 2 * tolerance;
}
