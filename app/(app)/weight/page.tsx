import { WeightChart } from "../../components/WeightChart";
import { WeightLog } from "../../components/WeightLog";
import { WeightProgressCard } from "../../components/WeightProgressCard";
import { dayInMadrid } from "@/domain/day";
import { isPace } from "@/domain/target";
import { weightProgress, weightTrend } from "@/domain/weight";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadWeighIns } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function WeightPage() {
  await requireCurrentUser();

  const today = dayInMadrid();
  const [weighIns, profile] = await Promise.all([
    loadWeighIns(),
    prisma.profile.findFirst({ select: { targetWeightKg: true, pace: true } })
  ]);
  const targetWeightKg = profile?.targetWeightKg ?? null;
  const progress = weightProgress(weighIns, targetWeightKg);

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink">Peso</h1>

      <WeightLog today={today} weighIns={weighIns}>
        {progress ? (
          <>
            <WeightProgressCard
              pace={profile && isPace(profile.pace) ? profile.pace : null}
              progress={progress}
              targetWeightKg={targetWeightKg}
              today={today}
            />
            <WeightChart
              points={weightTrend(weighIns)}
              targetKg={targetWeightKg}
              today={today}
            />
          </>
        ) : (
          <section className="rounded-lg border border-dashed border-line bg-white px-4 py-10 text-center text-sm leading-6 text-muted">
            Apunta tu primer pesaje para ver la tendencia y tu progreso.
          </section>
        )}
      </WeightLog>
    </>
  );
}
