import { addDays } from "@/domain/day";
import {
  isBaseUnit,
  rankRecentFoods,
  RECENT_WINDOW_DAYS,
  type BaseUnit,
  type FoodPortionData,
  type Quantity
} from "@/domain/food";
import { prisma } from "@/lib/prisma";

export const RECENT_LIMIT = 12;

export type LibraryFood = {
  id: string;
  name: string;
  brand: string | null;
  baseUnit: BaseUnit;
  kcalPer100: number;
  favorite: boolean;
  archived: boolean;
  portions: FoodPortionData[];
  /** Quantity of the latest diary entry with this food, to offer it again. */
  lastUsed: Quantity | null;
};

export const foodSelect = {
  id: true,
  name: true,
  brand: true,
  baseUnit: true,
  kcalPer100: true,
  favorite: true,
  archived: true,
  portions: {
    orderBy: { position: "asc" },
    select: { name: true, amount: true }
  }
} as const;

type FoodRow = {
  id: string;
  name: string;
  brand: string | null;
  baseUnit: string;
  kcalPer100: number;
  favorite: boolean;
  archived: boolean;
  portions: FoodPortionData[];
};

export function toLibraryFood(row: FoodRow, lastUsed: Quantity | null = null): LibraryFood {
  return {
    ...row,
    // Only g and ml are ever saved; the fallback keeps the type honest.
    baseUnit: isBaseUnit(row.baseUnit) ? row.baseUnit : "g",
    lastUsed
  };
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "es", { sensitivity: "base" });

/** Every food, archived ones included, sorted by name. */
export async function loadAllFoods(): Promise<LibraryFood[]> {
  const rows = await prisma.food.findMany({ select: foodSelect });
  return rows.map((row) => toLibraryFood(row)).sort(byName);
}

/**
 * The foods that can be added (not archived), sorted by name, with the
 * quantity last used of each and the ids of the recent ones.
 */
export async function loadLibrary(
  today: string
): Promise<{ foods: LibraryFood[]; recentIds: string[] }> {
  const [rows, uses] = await Promise.all([
    prisma.food.findMany({ where: { archived: false }, select: foodSelect }),
    prisma.diaryEntry.findMany({
      where: {
        foodId: { not: null },
        day: { gte: addDays(today, -RECENT_WINDOW_DAYS), lte: today }
      },
      orderBy: [{ day: "desc" }, { createdAt: "desc" }],
      select: { foodId: true, day: true, quantity: true, unit: true }
    })
  ]);

  const lastUsed = new Map<string, Quantity>();
  for (const { foodId, quantity, unit } of uses) {
    if (foodId && quantity !== null && unit !== null && !lastUsed.has(foodId)) {
      lastUsed.set(foodId, { quantity, unit });
    }
  }

  const foods = rows
    .map((row) => toLibraryFood(row, lastUsed.get(row.id) ?? null))
    .sort(byName);
  const available = new Set(foods.map(({ id }) => id));
  const recentIds = rankRecentFoods(
    uses.flatMap(({ foodId, day }) =>
      foodId && available.has(foodId) ? [{ foodId, day }] : []
    ),
    today,
    RECENT_LIMIT
  );

  return { foods, recentIds };
}
