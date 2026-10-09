import { CheckInCard } from "../../components/CheckInCard";
import { DiaryCalendar } from "../../components/DiaryCalendar";
import { addDays, dayInMadrid, formatLongDay } from "@/domain/day";
import { formatKcal } from "@/domain/diary";
import {
  formatDayRange,
  indexDays,
  isValidMonth,
  LOW_KCAL_DAY,
  recentWeeks,
  summarizePeriod,
  type PeriodSummary
} from "@/domain/summary";
import { calculateTarget, formatKg } from "@/domain/target";
import { weightTrend } from "@/domain/weight";
import { requireCurrentUser } from "@/lib/auth";
import { loadProfile, loadWeighIns } from "@/lib/profile";
import { loadCheckInHistory, loadCheckInState, loadDayRecords } from "@/lib/summary";

export const dynamic = "force-dynamic";

const WEEKS_SHOWN = 8;

export default async function SummaryPage({
  searchParams
}: {
  searchParams?: Promise<{ month?: string | string[] }>;
}) {
  await requireCurrentUser();

  const params = await searchParams;
  const requested = Array.isArray(params?.month) ? params.month[0] : params?.month;
  const today = dayInMadrid();
  const month =
    isValidMonth(requested) && requested <= today.slice(0, 7) ? requested : today.slice(0, 7);

  const [profile, records, weighIns, history] = await Promise.all([
    loadProfile(),
    loadDayRecords(),
    loadWeighIns(),
    loadCheckInHistory()
  ]);
  const days = indexDays(records);
  // Every day is measured against the current target, as in Hoy.
  const target = profile ? calculateTarget({ ...profile, today }).target : null;
  const checkIn = await loadCheckInState(today, { profile, days, weighIns });

  const yesterday = addDays(today, -1);
  const week = summarizePeriod(days, addDays(today, -7), yesterday, target);
  const monthSummary = summarizePeriod(days, addDays(today, -30), yesterday, target);
  const weeks = recentWeeks(days, weightTrend(weighIns), today, WEEKS_SHOWN, target);

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink">Resumen</h1>

      <CheckInCard
        manualTargetKcal={profile?.manualTargetKcal ?? null}
        state={checkIn}
        today={today}
      />

      <section aria-label="Medias" className="grid gap-2">
        <div className="grid grid-cols-2 gap-3">
          <Average label="Últimos 7 días" summary={week} />
          <Average label="Últimos 30 días" summary={monthSummary} />
        </div>
        <p className="text-xs leading-5 text-muted">
          Sin contar hoy. Los días con menos de {formatKcal(LOW_KCAL_DAY)} kcal o
          marcados como incompletos no cuentan; en <i>Hoy</i> puedes marcar un día
          como completo o incompleto.
        </p>
      </section>

      <DiaryCalendar days={days} month={month} target={target} today={today} />

      <section aria-labelledby="weeks-title" className="grid rounded-lg border border-line bg-white">
        <h2 className="px-4 pb-2 pt-4 font-semibold text-ink" id="weeks-title">
          Semanas
        </h2>
        <ul>
          {weeks.map((item) => (
            <li
              className="flex items-center gap-3 border-t border-line px-4 py-3"
              key={item.weekStart}
            >
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-sm font-medium text-ink">
                  {formatDayRange(item.weekStart, item.weekEnd)}
                </span>
                <span className="text-sm text-muted">
                  {item.averageKcal === null
                    ? "Sin días completos"
                    : `${formatKcal(item.averageKcal)} kcal/día` +
                      (item.withinTarget === null
                        ? ""
                        : ` · ${item.withinTarget} de ${item.countedDays} en objetivo`)}
                </span>
              </div>
              <div className="grid justify-items-end gap-0.5 tabular-nums">
                <span className="text-sm font-medium text-ink">
                  {item.trendKg === null ? "—" : `${formatKg(item.trendKg)} kg`}
                </span>
                {item.changeKg !== null ? (
                  <span
                    className={`text-sm ${
                      item.changeKg < 0
                        ? "text-accent"
                        : item.changeKg > 0
                          ? "text-red-700"
                          : "text-muted"
                    }`}
                  >
                    {signed(item.changeKg)} kg
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-3 text-xs leading-5 text-muted">
          A la derecha, el peso de tendencia al final de cada semana y su cambio.
        </p>
      </section>

      {history.length > 0 ? (
        <section
          aria-labelledby="history-title"
          className="grid rounded-lg border border-line bg-white"
        >
          <h2 className="px-4 pb-2 pt-4 font-semibold text-ink" id="history-title">
            Check-ins anteriores
          </h2>
          <ul>
            {history.map((item) => (
              <li className="grid gap-0.5 border-t border-line px-4 py-3" key={item.weekStart}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-ink">
                    {formatLongDay(item.weekStart, today).replace(/^\S+, /, "")}
                  </span>
                  <span
                    className={`text-sm font-medium ${item.accepted ? "text-accent" : "text-muted"}`}
                  >
                    {item.accepted ? "Aceptado" : "Mantenido"}
                  </span>
                </span>
                <span className="text-sm text-muted">
                  Gasto {formatKcal(item.estimatedTdee)} kcal · objetivo{" "}
                  {formatKcal(item.previousTarget)} →{" "}
                  {formatKcal(item.accepted ? item.proposedTarget : item.previousTarget)} kcal
                  {item.accepted ? "" : ` (propuesto ${formatKcal(item.proposedTarget)})`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

const signed = (kg: number) => `${kg > 0 ? "+" : kg < 0 ? "−" : "±"}${formatKg(Math.abs(kg))}`;

function Average({ label, summary }: { label: string; summary: PeriodSummary }) {
  return (
    <div className="grid gap-1 rounded-lg border border-line bg-white p-4">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-ink">
        {summary.averageKcal === null ? "—" : formatKcal(summary.averageKcal)}
        <span className="ml-1 text-sm font-medium text-muted">kcal/día</span>
      </p>
      <p className="text-sm leading-5 text-muted">
        {summary.countedDays === 0
          ? "Sin días completos"
          : summary.withinTarget === null
            ? `${summary.countedDays} ${summary.countedDays === 1 ? "día" : "días"}`
            : `${summary.withinTarget} de ${summary.countedDays} ${
                summary.countedDays === 1 ? "día" : "días"
              } en objetivo`}
        {summary.incompleteDays > 0
          ? ` · ${summary.incompleteDays} incompleto${summary.incompleteDays === 1 ? "" : "s"}`
          : ""}
      </p>
    </div>
  );
}
