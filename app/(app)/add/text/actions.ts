"use server";

import { revalidatePath } from "next/cache";
import { isValidDay } from "@/domain/day";
import { ENTRY_PORTION_NAME, isBaseUnit, parseFoodInput } from "@/domain/food";
import { isMeal } from "@/domain/meals";
import {
  parseDescription,
  parseTextLines,
  type EstimateResult,
  type TextLineInput
} from "@/domain/textEstimate";
import { requireCurrentUser } from "@/lib/auth";
import { toLibraryFood, foodSelect } from "@/lib/foods";
import { prisma } from "@/lib/prisma";
import { estimateMeal } from "@/lib/textEstimate";

/** Breaks a description down with the AI; nothing is saved yet. */
export async function estimateText(description: string): Promise<EstimateResult> {
  await requireCurrentUser();

  const parsed = parseDescription(description);
  if (!parsed.ok) return parsed;
  return estimateMeal(parsed.value);
}

/** Adds the reviewed lines to the diary as entries with source `text`. */
export async function saveTextEntries(values: {
  day: string;
  meal: string;
  lines: TextLineInput[];
}): Promise<{ error: string } | null> {
  await requireCurrentUser();

  if (!isValidDay(values.day)) return { error: "Fecha no válida." };
  if (!isMeal(values.meal)) return { error: "Elige una comida." };

  const ids = values.lines.flatMap(({ foodId }) => (foodId ? [foodId] : []));
  const rows = ids.length
    ? await prisma.food.findMany({ where: { id: { in: ids } }, select: foodSelect })
    : [];
  const foods = new Map(rows.map((row) => [row.id, toLibraryFood(row)]));

  const parsed = parseTextLines(values.lines, foods);
  if (!parsed.ok) return { error: parsed.error };

  const now = new Date();
  const linked = [...new Set(parsed.value.flatMap(({ foodId }) => (foodId ? [foodId] : [])))];
  await prisma.$transaction([
    ...parsed.value.map((entry) =>
      prisma.diaryEntry.create({
        data: { ...entry, day: values.day, meal: values.meal, source: "text" }
      })
    ),
    prisma.food.updateMany({ where: { id: { in: linked } }, data: { lastUsedAt: now } })
  ]);

  revalidatePath("/", "layout");
  return null;
}

/**
 * Saves a line of the breakdown as a food of the library, with one
 * "ración" of the amount estimated, so next time it is not guessed again.
 */
export async function saveTextLineAsFood(values: {
  name: string;
  unit: string;
  kcalPer100: number;
  amount: number;
}): Promise<{ error: string } | { id: string }> {
  await requireCurrentUser();

  if (!isBaseUnit(values.unit)) return { error: "Unidad no válida." };
  const parsed = parseFoodInput({
    name: values.name,
    brand: "",
    baseUnit: values.unit,
    kcalPer100: String(values.kcalPer100),
    portions:
      values.amount > 0
        ? [{ name: ENTRY_PORTION_NAME, amount: String(Math.round(values.amount * 10) / 10) }]
        : []
  });
  if (!parsed.ok) return { error: parsed.error };

  const { portions, ...data } = parsed.value;
  const food = await prisma.food.create({
    data: {
      ...data,
      source: "text",
      portions: {
        create: portions.map((portion, position) => ({ ...portion, position }))
      }
    },
    select: { id: true }
  });

  revalidatePath("/", "layout");
  return { id: food.id };
}
