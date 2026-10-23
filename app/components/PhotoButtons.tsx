"use client";

import { scaledSize, type Photo } from "@/domain/photo";
import { CameraIcon } from "./icons";

/**
 * Reduces the photo on the phone (about 1.500 px, JPEG) so it travels
 * light; browsers already apply the EXIF orientation when drawing it.
 */
export async function shrinkPhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const { width, height } = scaledSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D canvas");
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** *Hacer la foto* with the rear camera and *Elegir de la galería*. */
export function PhotoButtons({
  disabled,
  onPhoto
}: {
  disabled: boolean;
  onPhoto: (file: File) => void;
}) {
  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPhoto(file);
  }
  const state = disabled ? "pointer-events-none opacity-60" : "cursor-pointer";

  return (
    <>
      <label className={`primary-button w-full gap-2 ${state}`}>
        <CameraIcon />
        Hacer la foto
        <input
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={disabled}
          onChange={onChange}
          type="file"
        />
      </label>
      <label className={`secondary-button w-full ${state}`}>
        Elegir de la galería
        <input accept="image/*" className="sr-only" disabled={disabled} onChange={onChange} type="file" />
      </label>
    </>
  );
}
