// Replays the weekly check-in on the last weeks of a database, as if every
// proposal had been accepted, to see whether the estimated expenditure is
// coherent with the real evolution. Only reads.
//   DATABASE_URL=file:/ruta/calorias.db node --import tsx scripts/check-in-report.ts [semanas]
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import {
  checkInWindow,
  estimateExpenditure,
  proposeTarget
} from "../src/domain/adaptive";
import { addDays } from "../src/domain/day";
import { indexDays, isDayMark, summarizePeriod } from "../src/domain/summary";
import { calculateTarget, isActivity, isPace, isSex } from "../src/domain/target";
import { currentTrendKg, weightProgress } from "../src/domain/weight";

loadEnvConfig(process.cwd(), true);

const weeks = Number(process.argv[2] ?? 8);
const prisma = new PrismaClient();

async function main() {
  const [profile, groups, marks, weighIns] = await Promise.all([
    prisma.profile.findFirst(),
    prisma.diaryEntry.groupBy({ by: ["day"], _sum: { kcal: true }, _count: { _all: true } }),
    prisma.diaryDay.findMany(),
    prisma.weightEntry.findMany({ orderBy: { day: "asc" }, select: { day: true, kg: true } })
  ]);
  if (!profile || !isSex(profile.sex) || !isActivity(profile.activity) || !isPace(profile.pace)) {
    throw new Error("No hay perfil.");
  }
  const markOf = new Map(marks.map(({ day, status }) => [day, status]));
  const days = indexDays(
    groups.map(({ day, _sum, _count }) => {
      const mark = markOf.get(day);
      return {
        day,
        kcal: _sum.kcal ?? 0,
        entries: _count._all,
        mark: isDayMark(mark) ? mark : null
      };
    })
  );

  console.log(
    `Diario: ${groups.length} días con entradas (${groups[0]?.day ?? "—"} → ${groups.at(-1)?.day ?? "—"}); ` +
      `${weighIns.length} pesajes (${weighIns[0]?.day ?? "—"} → ${weighIns.at(-1)?.day ?? "—"}).`
  );
  const progress = weightProgress(weighIns, profile.targetWeightKg);
  if (progress) {
    console.log(
      `Tendencia: ${progress.startKg} → ${progress.currentKg} kg; ritmo real ${progress.realKgPerWeek ?? "—"} kg/semana.\n`
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const { weekStart: thisWeek } = checkInWindow(today);
  let previous: number | null = null;

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const monday = addDays(thisWeek, -7 * index);
    const window = checkInWindow(monday);
    const weightKg = currentTrendKg(weighIns.filter(({ day }) => day <= window.end));
    if (weightKg === null) {
      console.log(`${monday}: sin pesajes`);
      continue;
    }
    const input = {
      sex: profile.sex,
      birthDate: profile.birthDate,
      heightCm: profile.heightCm,
      activity: profile.activity,
      pace: profile.pace,
      targetWeightKg: profile.targetWeightKg,
      manualTargetKcal: null,
      weightKg,
      today: monday
    };
    const formula = calculateTarget(input);
    const estimate = estimateExpenditure({
      days,
      weighIns,
      windowStart: window.windowStart,
      end: window.end,
      previousTdee: previous ?? formula.formulaTdee
    });
    const intake = summarizePeriod(days, window.windowStart, window.end, null);

    if (!estimate.ok) {
      console.log(
        `${monday}: fórmula ${formula.formulaTdee} kcal; media ${intake.averageKcal ?? "—"} kcal ` +
          `(${intake.countedDays} días). Faltan datos: ${estimate.missing.join(" ")}`
      );
      continue;
    }
    previous = estimate.tdee;
    console.log(
      `${monday}: media ${estimate.intakeKcal} kcal (${estimate.countedDays} días), ` +
        `tendencia ${estimate.trendChangeKg} kg en ${estimate.weightSpanDays} días → ` +
        `gasto ${estimate.rawTdee} (sin suavizar), estimado ${estimate.tdee}` +
        `${estimate.limited ? " (limitado)" : ""}, fórmula ${formula.formulaTdee}; ` +
        `objetivo propuesto ${proposeTarget(input, estimate.tdee).target} kcal`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
