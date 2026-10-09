import { addDays, isValidDay, weekStart } from "./day";
import { trendOn, type TrendPoint } from "./weight";

/**
 * A day with less than this is taken as not fully logged (a forgotten
 * meal, or only a coffee written down) unless the user marks it complete.
 */
export const LOW_KCAL_DAY = 800;

/** Over the target by up to this share is "a bit over"; beyond, "over". */
export const WAY_OVER_RATIO = 1.1;

export const DAY_MARKS = ["complete", "incomplete"] as const;
export type DayMark = (typeof DAY_MARKS)[number];

export function isDayMark(value: unknown): value is DayMark {
  return DAY_MARKS.some((mark) => mark === value);
}

/** What was logged on a day, with the user's mark if any. */
export type DayRecord = { day: string; kcal: number; entries: number; mark: DayMark | null };

/**
 * - `empty`: nothing logged.
 * - `marked`: marked incomplete by the user.
 * - `low`: incomplete because it has very few kcal.
 * - `counted`: counts for averages and the expenditure estimate.
 */
export type DayStatus = "empty" | "marked" | "low" | "counted";

export function dayStatus(record: DayRecord | undefined): DayStatus {
  if (!record || record.entries === 0) return "empty";
  if (record.mark === "incomplete") return "marked";
  if (record.mark === "complete") return "counted";
  return record.kcal < LOW_KCAL_DAY ? "low" : "counted";
}

export type DayTone = "empty" | "incomplete" | "counted" | "within" | "over" | "wayOver";

/** Colour of a day in the calendar. Without a target, counted days are plain. */
export function dayTone(record: DayRecord | undefined, target: number | null): DayTone {
  const status = dayStatus(record);
  if (status === "empty") return "empty";
  if (status !== "counted") return "incomplete";
  if (target === null) return "counted";
  const kcal = record!.kcal;
  if (kcal <= target) return "within";
  return kcal <= target * WAY_OVER_RATIO ? "over" : "wayOver";
}

export type DayIndex = ReadonlyMap<string, DayRecord>;

export function indexDays(records: readonly DayRecord[]): DayIndex {
  return new Map(records.map((record) => [record.day, record]));
}

export type PeriodSummary = {
  countedDays: number;
  /** Days with something logged that do not count. */
  incompleteDays: number;
  /** Average of the counted days, or null without any. */
  averageKcal: number | null;
  /** Counted days at or under the target, or null without a target. */
  withinTarget: number | null;
};

/** Counted days between two days, both included. */
export function summarizePeriod(
  days: DayIndex,
  from: string,
  to: string,
  target: number | null
): PeriodSummary {
  let countedDays = 0;
  let incompleteDays = 0;
  let total = 0;
  let within = 0;

  for (let day = from; day <= to; day = addDays(day, 1)) {
    const record = days.get(day);
    const status = dayStatus(record);
    if (status === "empty") continue;
    if (status !== "counted") {
      incompleteDays += 1;
      continue;
    }
    countedDays += 1;
    total += record!.kcal;
    if (target !== null && record!.kcal <= target) within += 1;
  }

  return {
    countedDays,
    incompleteDays,
    averageKcal: countedDays > 0 ? Math.round(total / countedDays) : null,
    withinTarget: target === null ? null : within
  };
}

// Weeks ------------------------------------------------------------------------

export type WeekSummary = PeriodSummary & {
  weekStart: string;
  weekEnd: string;
  /** Trend at the end of the week (today for the current one). */
  trendKg: number | null;
  /** Trend change since the previous week (negative: lost). */
  changeKg: number | null;
};

const roundTo1 = (value: number) => Math.round(value * 10) / 10;

/**
 * The last `count` weeks (Monday to Sunday), newest first. Today is left
 * out of the averages because it is still being logged.
 */
export function recentWeeks(
  days: DayIndex,
  trend: readonly TrendPoint[],
  today: string,
  count: number,
  target: number | null
): WeekSummary[] {
  const yesterday = addDays(today, -1);
  const thisWeek = weekStart(today);
  const weeks: WeekSummary[] = [];
  let previousTrend = trendOn(trend, addDays(thisWeek, -7 * count - 1));

  for (let index = count - 1; index >= 0; index -= 1) {
    const start = addDays(thisWeek, -7 * index);
    const end = addDays(start, 6);
    const rawTrend = trendOn(trend, end < today ? end : today);
    weeks.push({
      weekStart: start,
      weekEnd: end,
      ...summarizePeriod(days, start, end < yesterday ? end : yesterday, target),
      trendKg: rawTrend === null ? null : roundTo1(rawTrend),
      changeKg:
        rawTrend === null || previousTrend === null
          ? null
          : roundTo1(rawTrend - previousTrend)
    });
    previousTrend = rawTrend;
  }

  return weeks.reverse();
}

// Calendar ---------------------------------------------------------------------

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value) && isValidDay(`${value}-01`);
}

export function addMonths(month: string, amount: number): string {
  const [year, number] = month.split("-").map(Number);
  const index = year * 12 + number - 1 + amount;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * The days of a month laid out in weeks starting on Monday, with null
 * before the 1st and after the last day.
 */
export function monthGrid(month: string): (string | null)[][] {
  const first = `${month}-01`;
  const cells: (string | null)[] = [];
  for (let day = weekStart(first); day < first; day = addDays(day, 1)) cells.push(null);
  for (let day = first; day.startsWith(month); day = addDays(day, 1)) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

const monthFormat = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  month: "long",
  year: "numeric"
});

/** "Octubre de 2026". */
export function formatMonth(month: string): string {
  const label = monthFormat.format(new Date(`${month}-01T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const dayMonthFormat = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  day: "numeric",
  month: "short"
});

const dayMonth = (day: string) =>
  dayMonthFormat.format(new Date(`${day}T00:00:00Z`)).replace(/\./g, "");

/** "29 sep – 5 oct". */
export function formatDayRange(from: string, to: string): string {
  return `${dayMonth(from)} – ${dayMonth(to)}`;
}
