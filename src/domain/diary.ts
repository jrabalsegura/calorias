import { isMeal, MEALS, type Meal } from "./meals";

export const MAX_ENTRY_KCAL = 10000;
export const MAX_ENTRY_NAME_LENGTH = 80;

export type DiaryTotalsEntry = { meal: string; kcal: number };

export type DiaryTotals = {
  total: number;
  byMeal: Record<Meal, number>;
};

export function sumDiary(entries: readonly DiaryTotalsEntry[]): DiaryTotals {
  const byMeal = Object.fromEntries(MEALS.map(({ id }) => [id, 0])) as Record<
    Meal,
    number
  >;
  let total = 0;

  for (const { meal, kcal } of entries) {
    // An unknown meal (never expected) still counts towards the day.
    if (isMeal(meal)) byMeal[meal] += kcal;
    total += kcal;
  }

  return { total, byMeal };
}

export type EntryInput = { meal: Meal; name: string | null; kcal: number };

export type EntryInputResult =
  | { ok: true; value: EntryInput }
  | { ok: false; error: string };

/** Validates the quick-entry form. Accepts "250", "250,5" or "250.5". */
export function parseEntryInput(raw: {
  meal: unknown;
  name: unknown;
  kcal: unknown;
}): EntryInputResult {
  if (!isMeal(raw.meal)) {
    return { ok: false, error: "Elige una comida." };
  }

  const kcalText = typeof raw.kcal === "string" ? raw.kcal.trim() : "";
  if (!/^\d+([.,]\d+)?$/.test(kcalText)) {
    return { ok: false, error: "Escribe las kcal con un número." };
  }

  const kcal = Math.round(Number(kcalText.replace(",", ".")));
  if (kcal > MAX_ENTRY_KCAL) {
    return {
      ok: false,
      error: `Como mucho ${MAX_ENTRY_KCAL.toLocaleString("es-ES")} kcal por entrada.`
    };
  }

  const name =
    typeof raw.name === "string"
      ? raw.name.trim().replace(/\s+/g, " ").slice(0, MAX_ENTRY_NAME_LENGTH)
      : "";

  return { ok: true, value: { meal: raw.meal, name: name || null, kcal } };
}

const kcalFormat = new Intl.NumberFormat("es-ES", { useGrouping: "always" });

export function formatKcal(kcal: number): string {
  return kcalFormat.format(kcal);
}
