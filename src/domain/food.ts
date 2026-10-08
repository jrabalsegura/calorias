import { daysBetween } from "./day";
import { MAX_ENTRY_KCAL, MAX_ENTRY_NAME_LENGTH } from "./diary";
import { isMeal, type Meal } from "./meals";
import { parseDecimal } from "./target";

export const BASE_UNITS = [
  { id: "g", label: "Gramos (g)" },
  { id: "ml", label: "Mililitros (ml)" }
] as const;

export type BaseUnit = (typeof BASE_UNITS)[number]["id"];

export function isBaseUnit(value: unknown): value is BaseUnit {
  return value === "g" || value === "ml";
}

export const MAX_FOOD_NAME_LENGTH = 60;
export const MAX_BRAND_LENGTH = 40;
export const MAX_PORTION_NAME_LENGTH = 30;
export const MAX_PORTIONS = 8;
/** Pure fat is about 900 kcal per 100 g; nothing edible goes beyond. */
export const MAX_KCAL_PER_100 = 900;
export const MAX_PORTION_AMOUNT = 5000;
/** Largest quantity accepted, in the base unit (5 kg or 5 l). */
export const MAX_BASE_AMOUNT = 5000;

export type FoodPortionData = { name: string; amount: number };

/** What the quantity picker and the kcal calculation need from a food. */
export type FoodForQuantity = {
  baseUnit: BaseUnit;
  kcalPer100: number;
  portions: readonly FoodPortionData[];
};

/** A diary quantity: `unit` is the base unit or the name of a portion. */
export type Quantity = { quantity: number; unit: string };

/** Amount in the food's base unit, or null when the unit is unknown. */
export function amountInBaseUnit(
  food: FoodForQuantity,
  { quantity, unit }: Quantity
): number | null {
  if (unit === food.baseUnit) return quantity;
  const portion = food.portions.find(({ name }) => name === unit);
  return portion ? quantity * portion.amount : null;
}

/** Whole kcal of a quantity of a food, or null when the unit is unknown. */
export function kcalForQuantity(food: FoodForQuantity, quantity: Quantity): number | null {
  const amount = amountInBaseUnit(food, quantity);
  return amount === null ? null : Math.round((food.kcalPer100 * amount) / 100);
}

const amountFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
  useGrouping: "always"
});

export function formatAmount(value: number): string {
  return amountFormat.format(value);
}

/** "150 g", "250 ml" or "2 × rebanada". */
export function formatQuantity({ quantity, unit }: Quantity): string {
  return isBaseUnit(unit)
    ? `${formatAmount(quantity)} ${unit}`
    : `${formatAmount(quantity)} × ${unit}`;
}

/**
 * The quantity offered when a food is picked: the last one used if it still
 * makes sense, else one portion, else 100 g/ml.
 */
export function defaultQuantity(
  food: FoodForQuantity,
  lastUsed: Quantity | null
): Quantity {
  if (lastUsed && amountInBaseUnit(food, lastUsed) !== null) return lastUsed;
  const portion = food.portions[0];
  return portion ? { quantity: 1, unit: portion.name } : { quantity: 100, unit: food.baseUnit };
}

export type QuantityInputResult =
  | { ok: true; value: Quantity & { kcal: number } }
  | { ok: false; error: string };

/** Validates the quantity picker against the food it measures. */
export function parseQuantityInput(
  food: FoodForQuantity,
  raw: { quantity: unknown; unit: unknown }
): QuantityInputResult {
  const quantity = parseDecimal(raw.quantity);
  if (quantity === null || quantity <= 0) {
    return { ok: false, error: "Escribe la cantidad con un número." };
  }

  const unit = typeof raw.unit === "string" ? raw.unit : "";
  const amount = amountInBaseUnit(food, { quantity, unit });
  if (amount === null) return { ok: false, error: "Elige una unidad." };
  if (amount > MAX_BASE_AMOUNT) {
    return {
      ok: false,
      error: `Como mucho ${formatAmount(MAX_BASE_AMOUNT)} ${food.baseUnit} por entrada.`
    };
  }

  const kcal = kcalForQuantity(food, { quantity, unit })!;
  if (kcal > MAX_ENTRY_KCAL) {
    return {
      ok: false,
      error: `Como mucho ${formatAmount(MAX_ENTRY_KCAL)} kcal por entrada.`
    };
  }

  return { ok: true, value: { quantity: Math.round(quantity * 100) / 100, unit, kcal } };
}

export type FoodInput = {
  name: string;
  brand: string | null;
  baseUnit: BaseUnit;
  kcalPer100: number;
  portions: FoodPortionData[];
};

export type FoodFormValues = {
  name: string;
  brand: string;
  baseUnit: string;
  kcalPer100: string;
  portions: { name: string; amount: string }[];
};

export type FoodInputResult = { ok: true; value: FoodInput } | { ok: false; error: string };

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

/** Validates the food form. Empty portion rows are ignored. */
export function parseFoodInput(raw: FoodFormValues): FoodInputResult {
  const name = cleanText(raw.name, MAX_FOOD_NAME_LENGTH);
  if (!name) return { ok: false, error: "Escribe el nombre del alimento." };

  if (!isBaseUnit(raw.baseUnit)) return { ok: false, error: "Elige gramos o mililitros." };
  const baseUnit = raw.baseUnit;

  const kcalPer100 = parseDecimal(raw.kcalPer100);
  if (kcalPer100 === null || kcalPer100 > MAX_KCAL_PER_100) {
    return {
      ok: false,
      error: `Escribe las kcal por 100 ${baseUnit} (0-${MAX_KCAL_PER_100}).`
    };
  }

  const portions: FoodPortionData[] = [];
  const seen = new Set<string>();
  for (const row of raw.portions) {
    const portionName = cleanText(row.name, MAX_PORTION_NAME_LENGTH);
    const amountText = typeof row.amount === "string" ? row.amount.trim() : "";
    if (!portionName && !amountText) continue;

    if (!portionName) return { ok: false, error: "Cada porción necesita un nombre." };
    const key = normalizeText(portionName);
    if (isBaseUnit(key)) {
      return { ok: false, error: `«${portionName}» ya es la unidad base.` };
    }
    if (seen.has(key)) {
      return { ok: false, error: `La porción «${portionName}» está repetida.` };
    }
    seen.add(key);

    const amount = parseDecimal(amountText);
    if (amount === null || amount <= 0 || amount > MAX_PORTION_AMOUNT) {
      return {
        ok: false,
        error: `Escribe cuántos ${baseUnit} son «${portionName}» (hasta ${formatAmount(MAX_PORTION_AMOUNT)}).`
      };
    }
    portions.push({ name: portionName, amount: Math.round(amount * 10) / 10 });
  }
  if (portions.length > MAX_PORTIONS) {
    return { ok: false, error: `Como mucho ${MAX_PORTIONS} porciones.` };
  }

  return {
    ok: true,
    value: {
      name,
      brand: cleanText(raw.brand, MAX_BRAND_LENGTH) || null,
      baseUnit,
      kcalPer100: Math.round(kcalPer100 * 10) / 10,
      portions
    }
  };
}

/** The name copied into a diary entry: "Pan de molde (Bimbo)". */
export function foodEntryName(food: { name: string; brand: string | null }): string {
  const name = food.brand ? `${food.name} (${food.brand})` : food.name;
  return name.slice(0, MAX_ENTRY_NAME_LENGTH);
}

/** Lower case without accents or extra spaces, for searching and comparing. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export type SearchableFood = { id: string; name: string; brand: string | null };

/**
 * Foods whose name or brand contain every word of the query, ignoring
 * accents and case. Names that start with the query come first; ties keep
 * the incoming order (callers pass them sorted by preference).
 */
export function searchFoods<T extends SearchableFood>(foods: readonly T[], query: string): T[] {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];

  const matches: { food: T; rank: number }[] = [];
  for (const food of foods) {
    const name = normalizeText(food.name);
    const haystack = `${name} ${normalizeText(food.brand ?? "")}`;
    if (!words.every((word) => haystack.includes(word))) continue;

    const rank = name.startsWith(words[0])
      ? 0
      : name.split(" ").some((part) => part.startsWith(words[0]))
        ? 1
        : 2;
    matches.push({ food, rank });
  }

  // Array.prototype.sort is stable, so equal ranks keep the incoming order.
  return matches.sort((a, b) => a.rank - b.rank).map(({ food }) => food);
}

/** Uses older than this do not count towards recents. */
export const RECENT_WINDOW_DAYS = 60;
/** A use loses half its weight every two weeks. */
export const RECENT_HALF_LIFE_DAYS = 14;

/**
 * Food ids ranked by frequency and recency: each use adds 0.5^(age / 14 days),
 * so a food eaten daily beats one eaten once yesterday, and something eaten
 * often months ago drops out.
 */
export function rankRecentFoods(
  uses: readonly { foodId: string; day: string }[],
  today: string,
  limit: number
): string[] {
  const scores = new Map<string, { score: number; lastDay: string }>();

  for (const { foodId, day } of uses) {
    const age = daysBetween(day, today);
    if (age < 0 || age > RECENT_WINDOW_DAYS) continue;

    const weight = 0.5 ** (age / RECENT_HALF_LIFE_DAYS);
    const current = scores.get(foodId);
    scores.set(foodId, {
      score: (current?.score ?? 0) + weight,
      lastDay: current && current.lastDay > day ? current.lastDay : day
    });
  }

  return [...scores]
    .sort(
      ([, a], [, b]) =>
        b.score - a.score || (a.lastDay < b.lastDay ? 1 : a.lastDay > b.lastDay ? -1 : 0)
    )
    .slice(0, limit)
    .map(([foodId]) => foodId);
}

export type CopyableEntry = {
  name: string | null;
  quantity: number | null;
  unit: string | null;
  kcal: number;
  foodId: string | null;
  source: string;
  note: string | null;
};

/**
 * New entries for `day` and `meal` with the values of the originals as they
 * were saved: kcal are copied, not recalculated from the food.
 */
export function copyEntries(
  entries: readonly CopyableEntry[],
  day: string,
  meal: Meal
): (CopyableEntry & { day: string; meal: Meal })[] {
  if (!isMeal(meal)) throw new Error(`Unknown meal: ${meal}`);
  return entries.map(({ name, quantity, unit, kcal, foodId, source, note }) => ({
    day,
    meal,
    name,
    quantity,
    unit,
    kcal,
    foodId,
    source,
    note
  }));
}

/** Name of the portion a saved manual entry becomes. */
export const ENTRY_PORTION_NAME = "ración";

/**
 * Turns a manual entry into a food. With the amount it weighed, the kcal per
 * 100 are worked out and the entry becomes one "ración" of that amount;
 * without it, the food is one "ración" of 100 g/ml with the entry's kcal, so
 * logging one ración again gives the same kcal.
 */
export function foodFromEntry(
  entry: { name: string; kcal: number },
  amount: number | null,
  baseUnit: BaseUnit
): FoodInput {
  const portionAmount = amount ?? 100;
  return {
    name: entry.name.slice(0, MAX_FOOD_NAME_LENGTH),
    brand: null,
    baseUnit,
    kcalPer100: Math.round(((entry.kcal * 100) / portionAmount) * 10) / 10,
    portions: [{ name: ENTRY_PORTION_NAME, amount: portionAmount }]
  };
}
