"use server";

import { revalidatePath } from "next/cache";
import { isValidDay } from "@/domain/day";
import { parseEntryInput } from "@/domain/diary";
import { copyEntries, foodEntryName, parseQuantityInput } from "@/domain/food";
import { isMeal } from "@/domain/meals";
import { requireCurrentUser } from "@/lib/auth";
import { toLibraryFood, foodSelect } from "@/lib/foods";
import { prisma } from "@/lib/prisma";

export type EntryFormState = {
  status: "idle" | "error" | "saved";
  message: string;
  // Changes on every successful save so the sheet knows when to close.
  savedAt: number;
  // What was sent, so a rejected form is shown again as the user left it.
  values?: { kcal: string; name: string; meal: string };
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function saveEntry(
  _previousState: EntryFormState,
  formData: FormData
): Promise<EntryFormState> {
  await requireCurrentUser();

  const id = field(formData, "id");
  const day = field(formData, "day");
  const values = {
    kcal: field(formData, "kcal"),
    name: field(formData, "name"),
    meal: field(formData, "meal")
  };
  const parsed = parseEntryInput(values);

  if (!parsed.ok) {
    return { status: "error", message: parsed.error, savedAt: 0, values };
  }

  if (id) {
    // Editing only touches what the quick entry shows; the day stays put.
    const { count } = await prisma.diaryEntry.updateMany({
      where: { id },
      data: parsed.value
    });
    if (count === 0) {
      return {
        status: "error",
        message: "Esta entrada ya no existe. Recarga la página.",
        savedAt: 0
      };
    }
  } else {
    if (!isValidDay(day)) {
      return { status: "error", message: "Fecha no válida.", savedAt: 0, values };
    }
    await prisma.diaryEntry.create({
      data: { ...parsed.value, day, source: "manual" }
    });
  }

  revalidatePath("/");
  return { status: "saved", message: "", savedAt: Date.now() };
}

export async function deleteEntry(id: string): Promise<void> {
  await requireCurrentUser();

  await prisma.diaryEntry.deleteMany({ where: { id } });
  revalidatePath("/");
}

/**
 * Adds a food of the library to the diary (without `id`) or changes the
 * quantity and meal of an entry made from one. Name and kcal are copied
 * from the food as it is now.
 */
export async function saveFoodEntry(values: {
  id?: string;
  foodId: string;
  day: string;
  meal: string;
  quantity: string;
  unit: string;
  /** How the food was found; only new entries take it. */
  source?: "library" | "barcode" | "label";
}): Promise<{ error: string } | null> {
  await requireCurrentUser();

  if (!isMeal(values.meal)) return { error: "Elige una comida." };
  if (!values.id && !isValidDay(values.day)) return { error: "Fecha no válida." };

  const row = await prisma.food.findUnique({
    where: { id: values.foodId },
    select: foodSelect
  });
  if (!row) return { error: "Este alimento ya no existe. Recarga la página." };
  const food = toLibraryFood(row);

  const parsed = parseQuantityInput(food, values);
  if (!parsed.ok) return { error: parsed.error };

  const data = {
    meal: values.meal,
    name: foodEntryName(food),
    quantity: parsed.value.quantity,
    unit: parsed.value.unit,
    kcal: parsed.value.kcal,
    foodId: food.id
  };

  if (values.id) {
    const { count } = await prisma.diaryEntry.updateMany({
      where: { id: values.id },
      data
    });
    if (count === 0) return { error: "Esta entrada ya no existe. Recarga la página." };
  } else {
    await prisma.$transaction([
      prisma.diaryEntry.create({
        data: {
          ...data,
          day: values.day,
          source: values.source === "barcode" || values.source === "label" ? values.source : "library"
        }
      }),
      prisma.food.update({ where: { id: food.id }, data: { lastUsedAt: new Date() } })
    ]);
  }

  revalidatePath("/", "layout");
  return null;
}

/** Copies entries of another day into `day` and `meal`, with their saved values. */
export async function copyDiaryEntries(values: {
  ids: string[];
  day: string;
  meal: string;
}): Promise<{ error: string } | null> {
  await requireCurrentUser();

  if (!isValidDay(values.day)) return { error: "Fecha no válida." };
  if (!isMeal(values.meal)) return { error: "Elige una comida." };
  if (values.ids.length === 0) return { error: "Elige qué quieres repetir." };

  const originals = await prisma.diaryEntry.findMany({
    where: { id: { in: values.ids } },
    orderBy: { createdAt: "asc" },
    select: {
      name: true,
      quantity: true,
      unit: true,
      kcal: true,
      foodId: true,
      source: true,
      note: true
    }
  });
  if (originals.length === 0) return { error: "Esas entradas ya no existen." };

  await prisma.diaryEntry.createMany({
    data: copyEntries(originals, values.day, values.meal)
  });

  revalidatePath("/", "layout");
  return null;
}
