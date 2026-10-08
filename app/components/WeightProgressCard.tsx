import Link from "next/link";
import { formatLongDay, formatShortDay } from "@/domain/day";
import { formatKg, PACES, type Pace } from "@/domain/target";
import { PACE_MIN_DAYS, type WeightProgress } from "@/domain/weight";

/** Trend weight, what is lost and left, and the real pace against the chosen one. */
export function WeightProgressCard({
  progress,
  targetWeightKg,
  pace,
  today
}: {
  progress: WeightProgress;
  targetWeightKg: number | null;
  pace: Pace | null;
  today: string;
}) {
  const chosen = PACES.find(({ id }) => id === pace) ?? null;
  const real = progress.realKgPerWeek;

  return (
    <section
      aria-label="Progreso"
      className="grid gap-4 rounded-lg border border-line bg-white p-4"
    >
      <div className="text-center">
        <p className="text-sm font-medium text-muted">Peso de tendencia</p>
        <p className="text-4xl font-semibold tabular-nums text-ink">
          {formatKg(progress.currentKg)}
          <span className="ml-1 text-lg font-medium text-muted">kg</span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-center">
        <Figure
          detail={`desde ${formatKg(progress.startKg)} kg el ${formatShortDay(progress.startDay, today)}`}
          label={progress.lostKg >= 0 ? "Perdido" : "Ganado"}
          value={`${formatKg(Math.abs(progress.lostKg))} kg`}
        />
        {targetWeightKg !== null && progress.remainingKg !== null ? (
          <Figure
            detail={`hasta ${formatKg(targetWeightKg)} kg`}
            label="Falta"
            value={
              progress.remainingKg > 0 ? `${formatKg(progress.remainingKg)} kg` : "¡Nada!"
            }
          />
        ) : (
          <Figure
            detail={
              <Link className="text-accent underline" href="/settings/profile">
                Fija tu objetivo
              </Link>
            }
            label="Falta"
            value="—"
          />
        )}
      </dl>

      <dl className="grid gap-1 border-t border-line pt-3 text-sm">
        <Row
          label="Ritmo real (últimas semanas)"
          value={
            real === null
              ? "—"
              : real >= 0
                ? `−${formatKg(real)} kg/sem`
                : `+${formatKg(-real)} kg/sem`
          }
        />
        {chosen ? (
          <Row
            label={`Ritmo elegido (${chosen.label.toLowerCase()})`}
            value={
              chosen.kgPerWeek === 0
                ? "mantener"
                : `−${formatKg(chosen.kgPerWeek)} kg/sem`
            }
          />
        ) : null}
        {progress.estimatedDate ? (
          <Row
            label="Con el ritmo real llegas hacia el"
            value={formatLongDay(progress.estimatedDate, today).replace(/^\S+, /, "")}
          />
        ) : null}
      </dl>

      {real === null ? (
        <p className="text-sm text-muted">
          El ritmo real aparece con {PACE_MIN_DAYS / 7} semanas de pesajes recientes.
        </p>
      ) : progress.remainingKg !== null && progress.remainingKg > 0 && real <= 0 ? (
        <p className="text-sm text-muted">
          Con la tendencia de las últimas semanas no estás bajando, así que no hay fecha
          estimada.
        </p>
      ) : null}
    </section>
  );
}

function Figure({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
}) {
  return (
    <div className="grid gap-0.5 rounded-lg bg-surface px-2 py-3">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums text-ink">{value}</dd>
      <dd className="text-xs text-muted">{detail}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}
