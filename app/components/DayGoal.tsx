import Link from "next/link";
import { formatKcal } from "@/domain/diary";
import { dayProgress } from "@/domain/target";

/** Consumed / target / remaining for the day, or the plain total without a goal. */
export function DayGoal({
  consumed,
  target
}: {
  consumed: number;
  target: number | null;
}) {
  if (target === null) {
    return (
      <section
        aria-label="Total del día"
        className="grid gap-3 rounded-lg border border-line bg-white px-4 py-4 text-center"
      >
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted">Total del día</p>
          <p className="text-4xl font-semibold tabular-nums text-ink">
            {formatKcal(consumed)}
            <span className="ml-1 text-lg font-medium text-muted">kcal</span>
          </p>
        </div>
        <Link className="secondary-button w-full" href="/settings/profile">
          Calcula tu objetivo diario
        </Link>
      </section>
    );
  }

  const progress = dayProgress(consumed, target);

  return (
    <section
      aria-label="Objetivo del día"
      className="grid gap-3 rounded-lg border border-line bg-white px-4 py-4"
    >
      <dl className="grid grid-cols-3 text-center">
        <Figure label="Consumidas" value={progress.consumed} />
        <Figure label="Objetivo" value={progress.target} />
        <Figure
          emphasis
          label={progress.over ? "Te has pasado" : "Restantes"}
          over={progress.over}
          value={Math.abs(progress.remaining)}
        />
      </dl>
      <div
        aria-label={`${formatKcal(progress.consumed)} de ${formatKcal(progress.target)} kcal`}
        aria-valuemax={progress.target}
        aria-valuemin={0}
        aria-valuenow={Math.min(progress.consumed, progress.target)}
        className="h-3 overflow-hidden rounded-full bg-line/60"
        role="progressbar"
      >
        <div
          className={`h-full rounded-full transition-[width] ${
            progress.over ? "bg-red-600" : "bg-accent"
          }`}
          style={{ width: `${progress.fill * 100}%` }}
        />
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  emphasis = false,
  over = false
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  over?: boolean;
}) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd
        className={`text-2xl font-semibold tabular-nums ${
          over ? "text-red-700" : emphasis ? "text-accent" : "text-ink"
        }`}
      >
        {formatKcal(value)}
      </dd>
    </div>
  );
}
