import Link from "next/link";
import { TargetBreakdown } from "../../components/TargetBreakdown";
import { dayInMadrid } from "@/domain/day";
import { ACTIVITY_LEVELS, formatKg, PACES } from "@/domain/target";
import { requireCurrentUser } from "@/lib/auth";
import { loadTarget } from "@/lib/profile";
import { logoutUser } from "../../login/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireCurrentUser();
  const today = dayInMadrid();
  const goal = await loadTarget(today);

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
              {formatKg(goal.profile.weightKg)} kg →{" "}
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
