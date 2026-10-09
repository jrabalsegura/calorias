import { prisma } from "@/lib/prisma";
import {
  calculateTarget,
  isActivity,
  isPace,
  isSex,
  type ProfileInput,
  type TargetResult
} from "@/domain/target";
import { currentTrendKg, type WeighIn } from "@/domain/weight";

export type StoredProfile = ProfileInput & {
  /** Expenditure of the latest accepted check-in, which replaces the formula. */
  adaptiveTdee: number | null;
  /** Monday of that check-in. */
  adaptiveSince: string | null;
};

/** Every weigh-in, oldest first. */
export function loadWeighIns(): Promise<WeighIn[]> {
  return prisma.weightEntry.findMany({
    orderBy: { day: "asc" },
    select: { day: true, kg: true }
  });
}

/**
 * The profile with the current trend weight (not the last weigh-in, so a
 * day of water retention does not move the target), or null until the
 * wizard is done.
 */
export async function loadProfile(): Promise<StoredProfile | null> {
  const [profile, weighIns, checkIn] = await Promise.all([
    prisma.profile.findFirst(),
    loadWeighIns(),
    prisma.weeklyCheckIn.findFirst({
      where: { accepted: true },
      orderBy: { weekStart: "desc" },
      select: { weekStart: true, estimatedTdee: true }
    })
  ]);
  const weightKg = currentTrendKg(weighIns);
  if (
    !profile ||
    weightKg === null ||
    !isSex(profile.sex) ||
    !isActivity(profile.activity) ||
    !isPace(profile.pace)
  ) {
    return null;
  }

  return {
    sex: profile.sex,
    birthDate: profile.birthDate,
    heightCm: profile.heightCm,
    weightKg,
    targetWeightKg: profile.targetWeightKg,
    activity: profile.activity,
    pace: profile.pace,
    manualTargetKcal: profile.manualTargetKcal,
    adaptiveTdee: checkIn?.estimatedTdee ?? null,
    adaptiveSince: checkIn?.weekStart ?? null
  };
}

export async function loadTarget(
  today: string
): Promise<{ profile: StoredProfile; target: TargetResult } | null> {
  const profile = await loadProfile();
  if (!profile) return null;
  return { profile, target: calculateTarget({ ...profile, today }) };
}
