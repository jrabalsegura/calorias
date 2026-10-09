import {
  checkInMessage,
  checkInWindow,
  estimateExpenditure,
  previousEstimate,
  proposeTarget,
  type ExpenditureEstimate
} from "@/domain/adaptive";
import { indexDays, isDayMark, type DayIndex, type DayRecord } from "@/domain/summary";
import { calculateTarget, type TargetResult } from "@/domain/target";
import type { WeighIn } from "@/domain/weight";
import { prisma } from "@/lib/prisma";
import { loadProfile, loadWeighIns, type StoredProfile } from "@/lib/profile";

/** kcal and number of entries of every logged day, with the user's marks. */
export async function loadDayRecords(): Promise<DayRecord[]> {
  const [groups, marks] = await Promise.all([
    prisma.diaryEntry.groupBy({
      by: ["day"],
      _sum: { kcal: true },
      _count: { _all: true }
    }),
    prisma.diaryDay.findMany({ select: { day: true, status: true } })
  ]);
  const markOf = new Map(
    marks.flatMap(({ day, status }) => (isDayMark(status) ? [[day, status] as const] : []))
  );

  return groups.map(({ day, _sum, _count }) => ({
    day,
    kcal: _sum.kcal ?? 0,
    entries: _count._all,
    mark: markOf.get(day) ?? null
  }));
}

export const checkInSelect = {
  weekStart: true,
  intakeKcal: true,
  countedDays: true,
  trendChangeKg: true,
  weightSpanDays: true,
  rawTdee: true,
  estimatedTdee: true,
  previousTarget: true,
  proposedTarget: true,
  accepted: true
} as const;

export type StoredCheckIn = {
  weekStart: string;
  intakeKcal: number;
  countedDays: number;
  trendChangeKg: number;
  weightSpanDays: number;
  rawTdee: number;
  estimatedTdee: number;
  previousTarget: number;
  proposedTarget: number;
  accepted: boolean;
};

export type CheckInState =
  | { kind: "noProfile" }
  /** This week's check-in is already answered. */
  | { kind: "done"; checkIn: StoredCheckIn }
  | {
      kind: "insufficient";
      estimate: Extract<ExpenditureEstimate, { ok: false }>;
    }
  | {
      kind: "ready";
      weekStart: string;
      estimate: Extract<ExpenditureEstimate, { ok: true }>;
      currentTarget: number;
      proposal: TargetResult;
      message: string;
      /** Accepting removes the target set by hand. */
      replacesManual: boolean;
    };

/** This week's check-in: answered, waiting for an answer or short of data. */
export async function loadCheckInState(
  today: string,
  data?: { profile: StoredProfile | null; days: DayIndex; weighIns: WeighIn[] }
): Promise<CheckInState> {
  const window = checkInWindow(today);
  const [existing, last, loaded] = await Promise.all([
    prisma.weeklyCheckIn.findUnique({
      where: { weekStart: window.weekStart },
      select: checkInSelect
    }),
    prisma.weeklyCheckIn.findFirst({
      where: { weekStart: { lt: window.weekStart } },
      orderBy: { weekStart: "desc" },
      select: { weekStart: true, estimatedTdee: true }
    }),
    data ??
      Promise.all([loadProfile(), loadDayRecords(), loadWeighIns()]).then(
        ([profile, records, weighIns]) => ({ profile, days: indexDays(records), weighIns })
      )
  ]);

  const { profile, days, weighIns } = loaded;
  if (!profile) return { kind: "noProfile" };
  if (existing) return { kind: "done", checkIn: existing };

  const input = { ...profile, today };
  const current = calculateTarget(input);
  const estimate = estimateExpenditure({
    days,
    weighIns,
    windowStart: window.windowStart,
    end: window.end,
    previousTdee: previousEstimate(last, window.weekStart, current.formulaTdee)
  });
  if (!estimate.ok) return { kind: "insufficient", estimate };

  const proposal = proposeTarget(input, estimate.tdee);
  return {
    kind: "ready",
    weekStart: window.weekStart,
    estimate,
    currentTarget: current.target,
    proposal,
    message: checkInMessage(estimate.tdee, proposal, profile.pace, current.target),
    replacesManual: profile.manualTargetKcal !== null
  };
}

export function loadCheckInHistory(): Promise<StoredCheckIn[]> {
  return prisma.weeklyCheckIn.findMany({
    orderBy: { weekStart: "desc" },
    take: 12,
    select: checkInSelect
  });
}
