import type { CopyableEntry } from "./food";

export const MAX_SAVED_MEAL_NAME_LENGTH = 60;

export type SavedMealNameResult = { ok: true; value: string } | { ok: false; error: string };

/** Validates the name of a saved meal: trimmed, with spaces collapsed. */
export function parseSavedMealName(raw: unknown): SavedMealNameResult {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: "Ponle un nombre." };
  if (name.length > MAX_SAVED_MEAL_NAME_LENGTH) {
    return {
      ok: false,
      error: `El nombre no puede pasar de ${MAX_SAVED_MEAL_NAME_LENGTH} caracteres.`
    };
  }
  return { ok: true, value: name };
}

/** The items of a new saved meal: copies of the entries, in their order. */
export function savedMealItems(
  entries: readonly CopyableEntry[]
): (CopyableEntry & { position: number })[] {
  return entries.map(({ name, quantity, unit, kcal, foodId, source, note }, position) => ({
    position,
    name,
    quantity,
    unit,
    kcal,
    foodId,
    source,
    note
  }));
}

/** "Tostada, Café con leche y 1 más": what a saved meal contains, in short. */
export function savedMealSummary(
  items: readonly { name: string | null }[],
  shown = 3
): string {
  const names = items.map(({ name }) => name ?? "Entrada rápida");
  if (names.length <= shown) {
    return names.length <= 1
      ? (names[0] ?? "")
      : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
  }
  const rest = names.length - shown;
  return `${names.slice(0, shown).join(", ")} y ${rest} más`;
}
