import {
  LABEL_PROMPT,
  LABEL_SCHEMA,
  LABEL_SYSTEM_PROMPT,
  parseLabelReading,
  type LabelImageType,
  type LabelResult
} from "@/domain/label";
import { AiError, requestJson } from "@/lib/claude";

/** Reads the nutrition table of a photo with the AI; the photo is not kept. */
export async function readLabelImage(image: {
  data: string;
  mediaType: LabelImageType;
}): Promise<LabelResult> {
  try {
    const answer = await requestJson("label", {
      system: LABEL_SYSTEM_PROMPT,
      prompt: [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
        { type: "text", text: LABEL_PROMPT }
      ],
      schema: LABEL_SCHEMA as unknown as Record<string, unknown>
    });
    return parseLabelReading(answer);
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.message };
    throw error;
  }
}
