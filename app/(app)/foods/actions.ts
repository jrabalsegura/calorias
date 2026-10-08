"use server";

import { revalidatePath } from "next/cache";
import {
  foodFromEntry,
  isBaseUnit,
  MAX_KCAL_PER_100,
  MAX_PORTION_AMOUNT,
  parseFoodInput,
  type FoodFormValues,
  type FoodInput
} from "@/domain/food";
import { parseDecimal } from "@/domain/target";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function portionRows(portions: FoodInput["portions"]) {
  return portions.map((portion, position) => ({ ...portion, position }));
}

/** Creates a food (without id) or replaces its values and portions. */
export async function saveFood(
  id: string | null,
  values: FoodFormValues,
  favorite: boolean
): Promise<{ error: string } | { id: string }> {
  await requireCurrentUser();

  const parsed = parseFoodInput(values);
  if (!parsed.ok) return { error: parsed.error };
  const { portions, ...data } = parsed.value;

  let savedId: string;
  if (id) {
    const exists = await prisma.food.count({ where: { id } });
    if (!exists) return { error: "Este alimento ya no existe. Recarga la página." };

    await prisma.$transaction([
      prisma.foodPortion.deleteMany({ where: { foodId: id } }),
      prisma.food.update({
        where: { id },
        data: { ...data, favorite, portions: { create: portionRows(portions) } }
      })
    ]);
    savedId = id;
  } else {
    const food = await prisma.food.create({
      data: {
        ...data,
        favorite,
        source: "manual",
        portions: { create: portionRows(portions) }
      },
      select: { id: true }
    });
    savedId = food.id;
  }

  revalidatePath("/", "layout");
  return { id: savedId };
}

export async function setFoodFavorite(id: string, favorite: boolean): Promise<void> {
  await requireCurrentUser();

  await prisma.food.updateMany({ where: { id }, data: { favorite } });
  revalidatePath("/", "layout");
}

/** Archived foods leave search and recents; past entries keep their copy. */
export async function setFoodArchived(id: string, archived: boolean): Promise<void> {
  await requireCurrentUser();

  await prisma.food.updateMany({ where: { id }, data: { archived } });
  revalidatePath("/", "layout");
}

/**
 * Saves a manual entry as a food and links the entry to it as one "ración".
 * `amount` (optional) is what the entry weighed, in `baseUnit`.
 */
export async function saveEntryAsFood(values: {
  entryId: string;
  amount: string;
  baseUnit: string;
}): Promise<{ error: string } | null> {
  await requireCurrentUser();

  const entry = await prisma.diaryEntry.findUnique({
    where: { id: values.entryId },
    select: { name: true, kcal: true, foodId: true }
  });
  if (!entry) return { error: "Esta entrada ya no existe. Recarga la página." };
  if (!entry.name) return { error: "Ponle un nombre a la entrada antes de guardarla." };
  if (entry.foodId) return { error: "Esta entrada ya es un alimento guardado." };
  if (!isBaseUnit(values.baseUnit)) return { error: "Elige gramos o mililitros." };

  let amount: number | null = null;
  if (values.amount.trim()) {
    amount = parseDecimal(values.amount);
    if (amount === null || amount <= 0 || amount > MAX_PORTION_AMOUNT) {
      return { error: `Escribe la cantidad en ${values.baseUnit} o déjala vacía.` };
    }
  }

  const food = foodFromEntry({ name: entry.name, kcal: entry.kcal }, amount, values.baseUnit);
  if (food.kcalPer100 > MAX_KCAL_PER_100) {
    return {
      error: `Saldrían más de ${MAX_KCAL_PER_100} kcal por 100 ${values.baseUnit}: revisa la cantidad.`
    };
  }

  const { portions, ...data } = food;
  await prisma.$transaction(async (tx) => {
    const created = await tx.food.create({
      data: {
        ...data,
        source: "manual",
        lastUsedAt: new Date(),
        portions: { create: portionRows(portions) }
      },
      select: { id: true }
    });
    await tx.diaryEntry.update({
      where: { id: values.entryId },
      data: { foodId: created.id, quantity: 1, unit: portions[0].name }
    });
  });

  revalidatePath("/", "layout");
  return null;
}
