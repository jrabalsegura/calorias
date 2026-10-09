import { formatLongDay } from "@/domain/day";
import { formatKcal } from "@/domain/diary";
import { formatKg, PACES, type Pace, type TargetResult } from "@/domain/target";

export const DISCLAIMER =
  "Es una estimación con fórmulas generales, no un consejo médico.";

/** How the daily target is reached, with the safety notes and the date. */
export function TargetBreakdown({
  result,
  pace,
  today,
  adaptiveSince = null
}: {
  result: TargetResult;
  pace: Pace;
  today: string;
  /** Monday of the check-in the adaptive expenditure comes from. */
  adaptiveSince?: string | null;
}) {
  const paceLabel = PACES.find(({ id }) => id === pace)?.label ?? "";

  return (
    <div className="grid gap-3">
      <div className="text-center">
        <p className="text-sm font-medium text-muted">
          {result.isManual ? "Objetivo diario (fijado a mano)" : "Objetivo diario"}
        </p>
        <p className="text-4xl font-semibold tabular-nums text-ink">
          {formatKcal(result.target)}
          <span className="ml-1 text-lg font-medium text-muted">kcal</span>
        </p>
      </div>

      <dl className="grid gap-1 text-sm">
        <Row label="Metabolismo basal" value={`${formatKcal(result.bmr)} kcal`} />
        {result.tdeeIsAdaptive ? (
          <>
            <Row
              label="Gasto real estimado"
              value={`${formatKcal(result.tdee)} kcal`}
            />
            <Row
              label="Gasto según la fórmula"
              muted
              value={`${formatKcal(result.formulaTdee)} kcal`}
            />
          </>
        ) : (
          <Row
            label="Gasto diario con tu actividad"
            value={`${formatKcal(result.tdee)} kcal`}
          />
        )}
        <Row
          label={`Déficit del ritmo ${paceLabel.toLowerCase()}`}
          value={`−${formatKcal(result.requestedDeficit)} kcal`}
        />
        {result.floorApplied || result.isManual ? (
          <Row
            label="Objetivo según la fórmula"
            value={`${formatKcal(result.recommended)} kcal`}
          />
        ) : null}
        {result.kgPerWeek > 0 ? (
          <Row
            label="Pérdida esperada"
            value={`${formatKg(result.kgPerWeek)} kg/semana`}
          />
        ) : null}
        {result.estimatedDate ? (
          <Row
            label="Peso objetivo hacia el"
            value={formatLongDay(result.estimatedDate, today).replace(/^\S+, /, "")}
          />
        ) : null}
      </dl>

      {result.notes.length > 0 ? (
        <ul className="grid gap-2">
          {result.notes.map((note) => (
            <li
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-900"
              key={note}
            >
              {note}
            </li>
          ))}
        </ul>
      ) : null}

      {result.tdeeIsAdaptive ? (
        <p className="text-xs leading-5 text-muted">
          El gasto real sale de lo que comes y de cómo baja tu peso
          {adaptiveSince
            ? ` (check-in del ${formatLongDay(adaptiveSince, today).replace(/^\S+, /, "")})`
            : ""}
          ; la actividad solo cuenta para la fórmula.
        </p>
      ) : null}

      <p className="text-xs leading-5 text-muted">{DISCLAIMER}</p>
    </div>
  );
}

function Row({
  label,
  value,
  muted = false
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd
        className={`text-right tabular-nums ${muted ? "text-muted" : "font-medium text-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
}
