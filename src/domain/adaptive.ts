import { addDays, daysBetween, weekStart } from "./day";
import { formatKcal } from "./diary";
import { summarizePeriod, type DayIndex } from "./summary";
import {
  calculateTarget,
  formatKg,
  KCAL_PER_KG,
  PACES,
  type TargetInput,
  type TargetResult
} from "./target";
import { weightTrend, type WeighIn } from "./weight";

/** The estimate looks at the last four weeks before the check-in. */
export const ADAPTIVE_WINDOW_DAYS = 28;

/** Minimum data in the window; with less, the formula stays. */
export const MIN_COUNTED_DAYS = 14;
export const MIN_WEIGH_INS = 3;
export const MIN_WEIGHT_SPAN_DAYS = 14;

/** Share of the gap to the new estimate taken each week. */
export const SMOOTHING = 0.5;

/** The estimate never moves more than this in one check-in. */
export const MAX_WEEKLY_CHANGE_KCAL = 150;

/** A previous estimate older than this is ignored (back to the formula). */
export const MAX_PREVIOUS_AGE_DAYS = 35;

const roundTo10 = (value: number) => Math.round(value / 10) * 10;
const roundTo2 = (value: number) => Math.round(value * 100) / 100;

/** The check-in of a week uses data up to the Sunday before it. */
export function checkInWindow(today: string): {
  weekStart: string;
  windowStart: string;
  end: string;
} {
  const start = weekStart(today);
  const end = addDays(start, -1);
  return { weekStart: start, windowStart: addDays(end, -(ADAPTIVE_WINDOW_DAYS - 1)), end };
}

/**
 * Where the smoothing starts from: the last check-in's estimate if it is
 * recent, otherwise the formula.
 */
export function previousEstimate(
  last: { weekStart: string; estimatedTdee: number } | null,
  weekStartDay: string,
  formulaTdee: number
): number {
  if (last && daysBetween(last.weekStart, weekStartDay) <= MAX_PREVIOUS_AGE_DAYS) {
    return last.estimatedTdee;
  }
  return formulaTdee;
}

export type ExpenditureEstimate =
  | {
      ok: true;
      windowStart: string;
      end: string;
      /** Average intake of the counted days. */
      intakeKcal: number;
      countedDays: number;
      /** Trend change between the first and last weigh-in of the window. */
      trendChangeKg: number;
      weightSpanDays: number;
      /** Intake − trend change × 7.700 / days, before smoothing. */
      rawTdee: number;
      previousTdee: number;
      /** Smoothed with the previous estimate and limited, rounded to 10 kcal. */
      tdee: number;
      /** The weekly limit cut the change. */
      limited: boolean;
    }
  | {
      ok: false;
      windowStart: string;
      end: string;
      countedDays: number;
      weighIns: number;
      weightSpanDays: number;
      /** What is missing, to show the user. */
      missing: string[];
    };

/**
 * Real expenditure from what was eaten and how the weight trend moved over
 * the last four weeks up to `end`. Days without data or incomplete are
 * left out of the intake average.
 */
export function estimateExpenditure({
  days,
  weighIns,
  windowStart,
  end,
  previousTdee
}: {
  days: DayIndex;
  weighIns: readonly WeighIn[];
  windowStart: string;
  end: string;
  previousTdee: number;
}): ExpenditureEstimate {
  const intake = summarizePeriod(days, windowStart, end, null);
  const points = weightTrend(weighIns.filter(({ day }) => day <= end)).filter(
    ({ day }) => day >= windowStart
  );
  const first = points[0];
  const last = points.at(-1);
  const weightSpanDays = first && last ? daysBetween(first.day, last.day) : 0;

  const missing: string[] = [];
  if (intake.countedDays < MIN_COUNTED_DAYS) {
    missing.push(
      `Días completos registrados: ${intake.countedDays} de los ${MIN_COUNTED_DAYS} necesarios en las últimas 4 semanas.`
    );
  }
  if (points.length < MIN_WEIGH_INS || weightSpanDays < MIN_WEIGHT_SPAN_DAYS) {
    missing.push(
      `Pesajes: ${points.length} en las últimas 4 semanas; hacen falta al menos ${MIN_WEIGH_INS} que abarquen 2 semanas.`
    );
  }
  if (missing.length > 0 || !first || !last || intake.averageKcal === null) {
    return {
      ok: false,
      windowStart,
      end,
      countedDays: intake.countedDays,
      weighIns: points.length,
      weightSpanDays,
      missing
    };
  }

  const trendChange = last.trend - first.trend;
  const rawTdee = Math.round(
    intake.averageKcal - (trendChange * KCAL_PER_KG) / weightSpanDays
  );
  const wanted = SMOOTHING * (rawTdee - previousTdee);
  const change = Math.max(-MAX_WEEKLY_CHANGE_KCAL, Math.min(MAX_WEEKLY_CHANGE_KCAL, wanted));

  return {
    ok: true,
    windowStart,
    end,
    intakeKcal: intake.averageKcal,
    countedDays: intake.countedDays,
    trendChangeKg: roundTo2(trendChange),
    weightSpanDays,
    rawTdee,
    previousTdee,
    tdee: roundTo10(previousTdee + change),
    limited: Math.abs(wanted) > MAX_WEEKLY_CHANGE_KCAL
  };
}

/**
 * The target with the estimated expenditure and the chosen pace. It goes
 * through the same safety floor as the formula; accepting it replaces a
 * manual target.
 */
export function proposeTarget(input: TargetInput, tdee: number): TargetResult {
  return calculateTarget({ ...input, manualTargetKcal: null, adaptiveTdee: tdee });
}

/** "Tu gasto estimado es X kcal; para seguir a 0,5 kg/semana, tu objetivo pasaría a Y kcal." */
export function checkInMessage(
  tdee: number,
  proposal: TargetResult,
  pace: TargetInput["pace"],
  currentTarget: number
): string {
  const kgPerWeek = PACES.find(({ id }) => id === pace)?.kgPerWeek ?? 0;
  const goal =
    kgPerWeek === 0
      ? "para mantener tu peso"
      : `para seguir a ${formatKg(kgPerWeek)} kg/semana`;
  const outcome =
    proposal.target === currentTarget
      ? `tu objetivo se queda en ${formatKcal(proposal.target)} kcal`
      : `tu objetivo pasaría de ${formatKcal(currentTarget)} a ${formatKcal(proposal.target)} kcal`;
  return `Tu gasto estimado es de ${formatKcal(tdee)} kcal al día; ${goal}, ${outcome}.`;
}
