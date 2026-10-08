import type { Meal } from "@/domain/meals";

/** The diary of a day: "/" for today, "/?day=YYYY-MM-DD" otherwise. */
export function diaryHref(day: string, today: string): string {
  return day === today ? "/" : `/?day=${day}`;
}

/** The *Añadir* screen for a day and meal. */
export function addHref(day: string, meal: Meal): string {
  return `/add?day=${day}&meal=${meal}`;
}

/** The barcode scanner for a day and meal. */
export function scanHref(day: string, meal: Meal): string {
  return `/add/scan?day=${day}&meal=${meal}`;
}

/** The description-in-text screen for a day and meal. */
export function textHref(day: string, meal: Meal): string {
  return `/add/text?day=${day}&meal=${meal}`;
}
