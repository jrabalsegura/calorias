// Diary days are calendar dates in Europe/Madrid stored as YYYY-MM-DD.
// Arithmetic on them is done in UTC so DST changes never skip or repeat a day.
export const DIARY_TIME_ZONE = "Europe/Madrid";

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const madridParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: DIARY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

function partsInMadrid(instant: Date) {
  const parts = Object.fromEntries(
    madridParts.formatToParts(instant).map(({ type, value }) => [type, value])
  );

  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

export function dayInMadrid(instant: Date = new Date()): string {
  return partsInMadrid(instant).day;
}

/** Minutes since midnight on the Madrid wall clock. */
export function minutesInMadrid(instant: Date = new Date()): number {
  return partsInMadrid(instant).minutes;
}

export function isValidDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DAY_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toUtcDate(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

export function addDays(day: string, amount: number): string {
  const date = toUtcDate(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

const longDate = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long"
});

const longDateWithYear = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

/** "jueves, 1 de octubre" (with the year only when it is not the current one). */
export function formatLongDay(day: string, today: string): string {
  const format = day.slice(0, 4) === today.slice(0, 4) ? longDate : longDateWithYear;
  return format.format(toUtcDate(day));
}

/** "Hoy", "Ayer", "Mañana" or the long date. */
export function formatRelativeDay(day: string, today: string): string {
  if (day === today) return "Hoy";
  if (day === addDays(today, -1)) return "Ayer";
  if (day === addDays(today, 1)) return "Mañana";

  const label = formatLongDay(day, today);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: string): number {
  return (toUtcDate(day).getUTCDay() + 6) % 7;
}

const shortDate = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short"
});

const shortDateWithYear = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric"
});

/** "mié, 8 oct", or "8 oct 2025" when it is not the current year. */
export function formatShortDay(day: string, today: string): string {
  const format = day.slice(0, 4) === today.slice(0, 4) ? shortDate : shortDateWithYear;
  return format.format(toUtcDate(day)).replace(/\./g, "");
}
