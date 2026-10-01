export const MEALS = [
  { id: "breakfast", label: "Desayuno" },
  { id: "midMorning", label: "Almuerzo" },
  { id: "lunch", label: "Comida" },
  { id: "afternoonSnack", label: "Merienda" },
  { id: "dinner", label: "Cena" },
  { id: "snack", label: "Picoteo" }
] as const;

export type Meal = (typeof MEALS)[number]["id"];

const MEAL_IDS = new Set<string>(MEALS.map(({ id }) => id));

export function isMeal(value: unknown): value is Meal {
  return typeof value === "string" && MEAL_IDS.has(value);
}

export function mealLabel(meal: Meal): string {
  return MEALS.find(({ id }) => id === meal)!.label;
}

// Spanish meal times. Anything in the small hours counts as picoteo.
const MEAL_STARTS: [minutes: number, meal: Meal][] = [
  [5 * 60, "breakfast"],
  [11 * 60, "midMorning"],
  [13 * 60 + 30, "lunch"],
  [17 * 60, "afternoonSnack"],
  [20 * 60, "dinner"]
];

/** The meal you are most likely logging at this Madrid wall-clock time. */
export function mealForMinutes(minutesSinceMidnight: number): Meal {
  let meal: Meal = "snack";
  for (const [start, candidate] of MEAL_STARTS) {
    if (minutesSinceMidnight >= start) meal = candidate;
  }
  return meal;
}
