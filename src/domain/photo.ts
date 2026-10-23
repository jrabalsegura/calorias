/** Longest side of a photo once reduced on the phone, in pixels. */
export const PHOTO_MAX_SIDE = 1500;
/** Base64 text accepted by the server (about 3,7 MB of image). */
export const MAX_PHOTO_BASE64 = 5_000_000;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

export type Photo = { data: string; mediaType: PhotoType };

export type PhotoResult = { ok: true; value: Photo } | { ok: false; error: string };

/** Checks the photo the phone sends: an image in base64, not too big. */
export function parsePhoto(raw: { data: unknown; mediaType: unknown }): PhotoResult {
  const mediaType = PHOTO_TYPES.find((type) => type === raw.mediaType);
  if (!mediaType) return { ok: false, error: "La foto tiene que ser JPEG, PNG o WebP." };
  const data = typeof raw.data === "string" ? raw.data : "";
  if (data.length < 100 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return { ok: false, error: "No se ha podido leer la foto. Prueba con otra." };
  }
  if (data.length > MAX_PHOTO_BASE64) {
    return { ok: false, error: "La foto es demasiado grande. Prueba con otra." };
  }
  return { ok: true, value: { data, mediaType } };
}

/** Size of a photo reduced so its longest side is at most `maxSide`. */
export function scaledSize(
  width: number,
  height: number,
  maxSide = PHOTO_MAX_SIDE
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
