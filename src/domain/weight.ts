import { addDays, daysBetween, isValidDay } from "./day";
import { parseDecimal } from "./target";

export const MIN_WEIGHT_KG = 30;
export const MAX_WEIGHT_KG = 300;

/**
 * Share of the gap between the trend and a new weigh-in that the trend moves
 * per day (the Hacker's Diet smoothing). A weigh-in after n days without data
 * moves it 1 − (1 − α)ⁿ, so weekly or sparse weigh-ins weigh more each and a
 * long gap lets the trend catch up instead of dragging old values along.
 */
export const TREND_DAILY_ALPHA = 0.1;

/**
 * The real pace compares the trend now with the earliest weigh-in of the
 * last five weeks (about four weeks back with weekly weigh-ins), and needs
 * at least two weeks between them: after a long gap there is no pace until
 * there are recent weigh-ins again.
 */
export const PACE_WINDOW_DAYS = 35;
export const PACE_MIN_DAYS = 14;

export type WeighIn = { day: string; kg: number };
export type TrendPoint = WeighIn & { trend: number };

/** Exponential moving average over weigh-ins sorted by day, tolerating gaps. */
export function weightTrend(weighIns: readonly WeighIn[]): TrendPoint[] {
  const points: TrendPoint[] = [];

  for (const { day, kg } of weighIns) {
    const previous = points.at(-1);
    if (!previous) {
      points.push({ day, kg, trend: kg });
      continue;
    }
    const days = Math.max(1, daysBetween(previous.day, day));
    const alpha = 1 - (1 - TREND_DAILY_ALPHA) ** days;
    points.push({ day, kg, trend: previous.trend + alpha * (kg - previous.trend) });
  }

  return points;
}

const roundTo1 = (value: number) => Math.round(value * 10) / 10;
const roundTo2 = (value: number) => Math.round(value * 100) / 100;

/** Current trend weight rounded to 0,1 kg, as used for the calorie target. */
export function currentTrendKg(weighIns: readonly WeighIn[]): number | null {
  const last = weightTrend(weighIns).at(-1);
  return last ? roundTo1(last.trend) : null;
}

export type WeightProgress = {
  startDay: string;
  startKg: number;
  currentKg: number;
  /** Positive when weight has gone down since the start. */
  lostKg: number;
  /** Still to lose to reach the target (0 once reached), or null without a target. */
  remainingKg: number | null;
  /** kg lost per week according to the trend (negative: gaining), or null without enough data. */
  realKgPerWeek: number | null;
  /** When the target is reached at the real pace, or null if it is not going down. */
  estimatedDate: string | null;
};

/**
 * Progress from the first weigh-in to the current trend, with the real pace
 * of the last weeks.
 */
export function weightProgress(
  weighIns: readonly WeighIn[],
  targetWeightKg: number | null
): WeightProgress | null {
  const points = weightTrend(weighIns);
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;

  const currentKg = roundTo1(last.trend);
  const windowStart = addDays(last.day, -PACE_WINDOW_DAYS);
  const reference = points.find((point) => point.day >= windowStart)!;
  const span = daysBetween(reference.day, last.day);
  const realKgPerWeek =
    span >= PACE_MIN_DAYS ? roundTo2(((reference.trend - last.trend) * 7) / span) : null;

  const remainingKg =
    targetWeightKg === null ? null : roundTo1(Math.max(0, last.trend - targetWeightKg));

  let estimatedDate: string | null = null;
  if (
    remainingKg !== null &&
    remainingKg > 0 &&
    realKgPerWeek !== null &&
    realKgPerWeek > 0
  ) {
    estimatedDate = addDays(last.day, Math.ceil((remainingKg / realKgPerWeek) * 7));
  }

  return {
    startDay: first.day,
    startKg: first.kg,
    currentKg,
    lostKg: roundTo1(first.kg - last.trend),
    remainingKg,
    realKgPerWeek,
    estimatedDate
  };
}

// Chart ranges --------------------------------------------------------------

export const WEIGHT_RANGES = [
  { id: "1m", label: "1 mes", days: 30 },
  { id: "3m", label: "3 meses", days: 91 },
  { id: "all", label: "Todo", days: null }
] as const;

export type WeightRange = (typeof WEIGHT_RANGES)[number]["id"];

/** Points shown for a range ending today. The trend is computed on all data first. */
export function pointsInRange<T extends { day: string }>(
  points: readonly T[],
  range: WeightRange,
  today: string
): T[] {
  const days = WEIGHT_RANGES.find(({ id }) => id === range)?.days ?? null;
  if (days === null) return [...points];
  const from = addDays(today, -days);
  return points.filter(({ day }) => day >= from);
}

// Form ------------------------------------------------------------------------

export type WeightInputResult =
  { ok: true; value: WeighIn } | { ok: false; error: string };

export function isWeightInRange(kg: number | null): kg is number {
  return kg !== null && kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG;
}

/** Validates the weigh-in form: a day up to today and kg with one decimal. */
export function parseWeightInput(
  raw: { day: unknown; kg: unknown },
  today: string
): WeightInputResult {
  if (!isValidDay(raw.day)) return { ok: false, error: "Elige un día válido." };
  if (raw.day > today) return { ok: false, error: "No puedes apuntar un peso futuro." };

  const kg = parseDecimal(raw.kg);
  if (!isWeightInRange(kg)) {
    return {
      ok: false,
      error: `Escribe el peso en kg (${MIN_WEIGHT_KG}-${MAX_WEIGHT_KG}).`
    };
  }

  return { ok: true, value: { day: raw.day, kg: roundTo1(kg) } };
}
