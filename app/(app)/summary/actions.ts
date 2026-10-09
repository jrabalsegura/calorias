"use server";

import { revalidatePath } from "next/cache";
import { dayInMadrid } from "@/domain/day";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadCheckInState } from "@/lib/summary";

/**
 * Answers this week's check-in. The proposal is calculated again here, so
 * what is saved never comes from the browser. Accepting makes the estimate
 * the expenditure of the target and drops a manual target.
 */
export async function answerCheckIn(accept: boolean): Promise<{ error: string } | null> {
  await requireCurrentUser();

  const state = await loadCheckInState(dayInMadrid());
  if (state.kind === "done") return null;
  if (state.kind !== "ready") {
    return { error: "Ahora mismo no hay ningún check-in pendiente. Recarga la página." };
  }

  const { estimate } = state;
  await prisma.$transaction([
    prisma.weeklyCheckIn.create({
      data: {
        weekStart: state.weekStart,
        intakeKcal: estimate.intakeKcal,
        countedDays: estimate.countedDays,
        trendChangeKg: estimate.trendChangeKg,
        weightSpanDays: estimate.weightSpanDays,
        rawTdee: estimate.rawTdee,
        estimatedTdee: estimate.tdee,
        previousTarget: state.currentTarget,
        proposedTarget: state.proposal.target,
        accepted: accept
      }
    }),
    ...(accept && state.replacesManual
      ? [prisma.profile.updateMany({ data: { manualTargetKcal: null } })]
      : [])
  ]);

  revalidatePath("/", "layout");
  return null;
}
