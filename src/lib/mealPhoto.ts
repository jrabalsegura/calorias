import { buildMealPhotoPrompt, MEAL_PHOTO_SYSTEM_PROMPT, NO_FOOD_IN_PHOTO } from "@/domain/mealPhoto";
import type { Photo } from "@/domain/photo";
import { ESTIMATE_SCHEMA, parseEstimate, type EstimateResult } from "@/domain/textEstimate";
import { AiError, requestJson } from "@/lib/claude";
import { loadLibraryReferences } from "@/lib/textEstimate";

/**
 * Recognises the food of a photo with the AI and breaks it down like a
 * description, with the library and the note; the photo is not kept.
 */
export async function estimateMealPhoto(image: Photo, hint: string): Promise<EstimateResult> {
  const library = await loadLibraryReferences();
  try {
    const answer = await requestJson("photo", {
      system: MEAL_PHOTO_SYSTEM_PROMPT,
      prompt: [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
        { type: "text", text: buildMealPhotoPrompt(hint, library) }
      ],
      schema: ESTIMATE_SCHEMA as unknown as Record<string, unknown>
    });
    return parseEstimate(answer, library, NO_FOOD_IN_PHOTO);
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.message };
    throw error;
  }
}
