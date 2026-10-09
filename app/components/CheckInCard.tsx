"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MAX_WEEKLY_CHANGE_KCAL } from "@/domain/adaptive";
import { addDays, formatLongDay } from "@/domain/day";
import { formatKcal } from "@/domain/diary";
import { formatKg } from "@/domain/target";
import type { CheckInState } from "@/lib/summary";
import { answerCheckIn } from "../(app)/summary/actions";
import { DISCLAIMER } from "./TargetBreakdown";

const dateOf = (day: string, today: string) =>
  formatLongDay(day, today).replace(/^\S+, /, "");

/** This week's check-in: the proposal to accept or keep, or why there is none. */
export function CheckInCard({
  state,
  today,
  manualTargetKcal
}: {
  state: CheckInState;
  today: string;
  manualTargetKcal: number | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function answer(accept: boolean) {
    setError(null);
    startSaving(async () => {
      const result = await answerCheckIn(accept);
      if (result) setError(result.error);
    });
  }

  return (
    <section
      aria-labelledby="check-in-title"
      className={`grid gap-3 rounded-lg border bg-white p-4 ${
        state.kind === "ready" ? "border-accent/50" : "border-line"
      }`}
    >
      <h2 className="font-semibold text-ink" id="check-in-title">
        Check-in semanal
      </h2>

      {state.kind === "noProfile" ? (
        <>
          <p className="text-sm leading-6 text-muted">
            Calcula tu objetivo para que cada semana se ajuste a tu gasto real.
          </p>
          <Link className="secondary-button w-full" href="/settings/profile">
            Calcular mi objetivo
          </Link>
        </>
      ) : null}

      {state.kind === "insufficient" ? (
        <>
          <p className="text-sm leading-6 text-ink">
            Aún no hay datos suficientes para estimar tu gasto real, así que el
            objetivo sigue calculándose con la fórmula.
          </p>
          <ul className="grid list-disc gap-1 pl-5 text-sm leading-5 text-muted">
            {state.estimate.missing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-xs leading-5 text-muted">
            Se miran las 4 semanas hasta el domingo pasado. Los días con muy pocas
            kcal o marcados como incompletos no cuentan.
          </p>
        </>
      ) : null}

      {state.kind === "done" ? (
        <>
          <p className="text-sm leading-6 text-ink">
            {state.checkIn.accepted
              ? `Aceptado: gasto estimado de ${formatKcal(state.checkIn.estimatedTdee)} kcal y objetivo de ${formatKcal(state.checkIn.proposedTarget)} kcal.`
              : `Mantuviste tu objetivo de ${formatKcal(state.checkIn.previousTarget)} kcal (la propuesta era ${formatKcal(state.checkIn.proposedTarget)} kcal).`}
          </p>
          <p className="text-sm text-muted">
            El próximo, el lunes {dateOf(addDays(state.checkIn.weekStart, 7), today)}.
          </p>
        </>
      ) : null}

      {state.kind === "ready" ? (
        <>
          <p className="leading-6 text-ink">{state.message}</p>

          <dl className="grid gap-1 text-sm">
            <Row
              label={`Media comida (${state.estimate.countedDays} días)`}
              value={`${formatKcal(state.estimate.intakeKcal)} kcal`}
            />
            <Row
              label={`Tendencia del peso en ${state.estimate.weightSpanDays} días`}
              value={`${state.estimate.trendChangeKg > 0 ? "+" : state.estimate.trendChangeKg < 0 ? "−" : ""}${formatKg(Math.abs(state.estimate.trendChangeKg))} kg`}
            />
            <Row
              label="Gasto con estos datos"
              value={`${formatKcal(state.estimate.rawTdee)} kcal`}
            />
            <Row
              label="Estimación anterior"
              value={`${formatKcal(state.estimate.previousTdee)} kcal`}
            />
            <Row
              label="Nueva estimación"
              strong
              value={`${formatKcal(state.estimate.tdee)} kcal`}
            />
          </dl>

          {state.estimate.limited ? (
            <p className="text-xs leading-5 text-muted">
              La estimación se acerca a la mitad de lo que dicen los datos y cambia
              como mucho {MAX_WEEKLY_CHANGE_KCAL} kcal por semana, para no reaccionar a una semana rara.
            </p>
          ) : (
            <p className="text-xs leading-5 text-muted">
              La estimación se acerca cada semana a la mitad de lo que dicen los
              datos, para no reaccionar a una semana rara.
            </p>
          )}

          {[
            ...state.proposal.notes,
            ...(state.replacesManual && manualTargetKcal !== null
              ? [
                  `Si lo aceptas, deja de usarse el objetivo que fijaste a mano (${formatKcal(manualTargetKcal)} kcal).`
                ]
              : [])
          ].map((note) => (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-900"
              key={note}
            >
              {note}
            </p>
          ))}

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid gap-2">
            <button
              className="primary-button w-full"
              disabled={isSaving}
              onClick={() => answer(true)}
              type="button"
            >
              Aceptar {formatKcal(state.proposal.target)} kcal
            </button>
            <button
              className="secondary-button w-full"
              disabled={isSaving}
              onClick={() => answer(false)}
              type="button"
            >
              Mantener {formatKcal(state.currentTarget)} kcal
            </button>
          </div>
          <p className="text-xs leading-5 text-muted">{DISCLAIMER}</p>
        </>
      ) : null}
    </section>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd
        className={`text-right tabular-nums text-ink ${strong ? "font-semibold" : "font-medium"}`}
      >
        {value}
      </dd>
    </div>
  );
}
