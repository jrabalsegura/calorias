import { prisma } from "@/lib/prisma";
import {
  calculateTarget,
  isActivity,
  isPace,
  isSex,
  type ProfileInput,
  type TargetResult
} from "@/domain/target";

export type StoredProfile = ProfileInput;

/** The profile with the latest weigh-in, or null until the wizard is done. */
export async function loadProfile(): Promise<StoredProfile | null> {
  const [profile, weight] = await Promise.all([
    prisma.profile.findFirst(),
    prisma.weightEntry.findFirst({ orderBy: { day: "desc" } })
  ]);
  if (
    !profile ||
    !weight ||
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
    weightKg: weight.kg,
    targetWeightKg: profile.targetWeightKg,
    activity: profile.activity,
    pace: profile.pace,
    manualTargetKcal: profile.manualTargetKcal
  };
}

export async function loadTarget(
  today: string
): Promise<{ profile: StoredProfile; target: TargetResult } | null> {
  const profile = await loadProfile();
  if (!profile) return null;
  return { profile, target: calculateTarget({ ...profile, today }) };
}
