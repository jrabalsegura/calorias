"use server";

import { parseLabelImage, type LabelResult } from "@/domain/label";
import { requireCurrentUser } from "@/lib/auth";
import { readLabelImage } from "@/lib/labelReading";

/** Reads a photo of a nutrition label with the AI; nothing is saved yet. */
export async function readLabel(image: { data: string; mediaType: string }): Promise<LabelResult> {
  await requireCurrentUser();

  const parsed = parseLabelImage(image);
  if (!parsed.ok) return parsed;
  return readLabelImage(parsed.value);
}
