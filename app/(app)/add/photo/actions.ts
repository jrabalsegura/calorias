"use server";

import { parseHint } from "@/domain/mealPhoto";
import { parsePhoto } from "@/domain/photo";
import type { EstimateResult } from "@/domain/textEstimate";
import { requireCurrentUser } from "@/lib/auth";
import { estimateMealPhoto } from "@/lib/mealPhoto";

/** Estimates the meal of a photo (and its note) with the AI; nothing is saved yet. */
export async function estimatePhoto(
  image: { data: string; mediaType: string },
  hint: string
): Promise<EstimateResult> {
  await requireCurrentUser();

  const photo = parsePhoto(image);
  if (!photo.ok) return photo;
  const note = parseHint(hint);
  if (!note.ok) return note;
  return estimateMealPhoto(photo.value, note.value);
}
