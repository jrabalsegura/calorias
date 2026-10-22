import { prisma } from "@/lib/prisma";

export type SavedMealView = {
  id: string;
  name: string;
  items: {
    id: string;
    name: string | null;
    quantity: number | null;
    unit: string | null;
    kcal: number;
  }[];
};

/** Every saved meal, the last used first and then the newest. */
export async function loadSavedMeals(): Promise<SavedMealView[]> {
  const rows = await prisma.savedMeal.findMany({
    orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      items: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, quantity: true, unit: true, kcal: true }
      }
    }
  });
  return rows.filter(({ items }) => items.length > 0);
}
