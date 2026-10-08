import Link from "next/link";
import { TargetBreakdown } from "../../components/TargetBreakdown";
import { formatUsd, monthStart, summarizeAiCalls } from "@/domain/aiUsage";
import { dayInMadrid } from "@/domain/day";
import { formatKcal } from "@/domain/diary";
import { ACTIVITY_LEVELS, formatKg, PACES } from "@/domain/target";
import { requireCurrentUser } from "@/lib/auth";
import { aiSettings } from "@/lib/claude";
import { loadTarget } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { logoutUser } from "../../login/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireCurrentUser();
  const today = dayInMadrid();
  const [goal, foodCount, aiCalls] = await Promise.all([
    loadTarget(today),
    prisma.food.count({ where: { archived: false } }),
    prisma.aiCall.findMany({
      where: { day: { gte: monthStart(today) } },
      select: { ok: true, inputTokens: true, outputTokens: true, costUsd: true }
    })
  ]);
  const ai = aiSettings();
  const aiMonth = summarizeAiCalls(aiCalls);

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink">Ajustes</h1>

      <section
        aria-label="Objetivo"
        className="grid gap-4 rounded-lg border border-line bg-white p-4"
      >
        {goal ? (
          <>
            <TargetBreakdown
              pace={goal.profile.pace}
              result={goal.target}
              today={today}
            />
            <p className="text-sm text-muted">
              {formatKg(goal.profile.weightKg)} kg (tendencia) →{" "}
              {formatKg(goal.profile.targetWeightKg)} kg · actividad{" "}
              {ACTIVITY_LEVELS.find(
                ({ id }) => id === goal.profile.activity
              )?.label.toLowerCase()}{" "}
              · ritmo{" "}
              {PACES.find(({ id }) => id === goal.profile.pace)?.label.toLowerCase()}
            </p>
            <Link className="secondary-button w-full" href="/settings/profile">
              Editar perfil y objetivo
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted">
              Aún no has calculado tu objetivo diario de calorías.
            </p>
            <Link className="primary-button w-full" href="/settings/profile">
              Calcular mi objetivo
            </Link>
          </>
        )}
      </section>

      <Link
        className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-white px-4 active:bg-line/40"
        href="/foods"
      >
        <span className="grid flex-1">
          <span className="font-semibold text-ink">Mis alimentos</span>
          <span className="text-sm text-muted">
            {foodCount === 1 ? "1 alimento guardado" : `${foodCount} alimentos guardados`}
          </span>
        </span>
        <svg
          aria-hidden="true"
          className="h-5 w-5 text-muted"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="m9 5 7 7-7 7" />
        </svg>
      </Link>

      <section aria-labelledby="ai-title" className="grid gap-3 rounded-lg border border-line bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-ink" id="ai-title">
            IA
          </h2>
          <p className="truncate text-sm text-muted">
            {ai.configured ? `${ai.model} · esfuerzo ${ai.effort}` : "Sin configurar"}
          </p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="grid gap-1">
            <p className="text-sm text-muted">Gasto estimado este mes</p>
            <p className="text-sm text-muted">
              {aiMonth.calls === 1 ? "1 consulta" : `${aiMonth.calls} consultas`}
              {aiMonth.failed > 0 ? ` (${aiMonth.failed} fallidas)` : ""} ·{" "}
              {formatKcal(aiMonth.inputTokens + aiMonth.outputTokens)} tokens
            </p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-ink">
            {aiMonth.costIncomplete ? "≥ " : ""}
            {formatUsd(aiMonth.costUsd)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-line bg-white p-4">
        <div className="grid gap-1">
          <p className="text-sm text-muted">Sesión iniciada como</p>
          <p className="font-semibold text-ink">{user.username}</p>
        </div>
        <form action={logoutUser}>
          <button className="secondary-button w-full" type="submit">
            Cerrar sesión
          </button>
        </form>
      </section>
    </>
  );
}
