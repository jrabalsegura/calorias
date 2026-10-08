import {
  buildEstimatePrompt,
  ESTIMATE_SCHEMA,
  ESTIMATE_SYSTEM_PROMPT,
  numberLibrary,
  parseEstimate,
  type EstimateResult
} from "@/domain/textEstimate";
import { AiError, requestJson } from "@/lib/claude";
import { foodSelect, toLibraryFood } from "@/lib/foods";
import { prisma } from "@/lib/prisma";

/**
 * Breaks a description of a meal down with the AI. The library goes with
 * it, so a food you already have is recognised and keeps its own data.
 */
export async function estimateMeal(description: string): Promise<EstimateResult> {
  const rows = await prisma.food.findMany({
    where: { archived: false },
    // Most used first, so the list reads like the user's usual foods.
    orderBy: [{ favorite: "desc" }, { lastUsedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    select: foodSelect
  });
  const library = numberLibrary(rows.map((row) => toLibraryFood(row)));

  try {
    const answer = await requestJson("text", {
      system: ESTIMATE_SYSTEM_PROMPT,
      prompt: buildEstimatePrompt(description, library),
      schema: ESTIMATE_SCHEMA as unknown as Record<string, unknown>
    });
    return parseEstimate(answer, library);
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.message };
    throw error;
  }
}
