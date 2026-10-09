import Link from "next/link";
import { ProfileForm } from "../../../components/ProfileForm";
import { dayInMadrid } from "@/domain/day";
import { requireCurrentUser } from "@/lib/auth";
import { loadProfile } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const EMPTY_FORM = {
  sex: "",
  birthDate: "",
  heightCm: "",
  weightKg: "",
  targetWeightKg: "",
  activity: "",
  pace: "moderate",
  manualTargetKcal: ""
};

const decimal = (value: number) => String(value).replace(".", ",");

/** First-time wizard, and later the profile editor in Ajustes. */
export default async function ProfilePage() {
  await requireCurrentUser();

  const today = dayInMadrid();
  const [profile, consumed] = await Promise.all([
    loadProfile(),
    prisma.diaryEntry.aggregate({ where: { day: today }, _sum: { kcal: true } })
  ]);

  const initial = profile
    ? {
        sex: profile.sex,
        birthDate: profile.birthDate,
        heightCm: decimal(profile.heightCm),
        weightKg: decimal(profile.weightKg),
        targetWeightKg: decimal(profile.targetWeightKg),
        activity: profile.activity,
        pace: profile.pace,
        manualTargetKcal:
          profile.manualTargetKcal === null ? "" : String(profile.manualTargetKcal)
      }
    : EMPTY_FORM;

  return (
    <>
      <header className="flex items-center gap-1">
        {profile ? (
          <Link
            aria-label="Volver a Ajustes"
            className="-ml-3 grid h-12 w-12 place-items-center rounded-lg text-ink active:bg-line/50"
            href="/settings"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="m15 5-7 7 7 7" />
            </svg>
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold text-ink">
          {profile ? "Perfil y objetivo" : "Calcula tu objetivo"}
        </h1>
      </header>
      {profile ? null : (
        <p className="text-sm leading-6 text-muted">
          Con estos datos calculamos cuántas calorías te tocan al día según el ritmo al
          que quieras bajar. Podrás cambiarlos cuando quieras en Ajustes.
        </p>
      )}
      <ProfileForm
        adaptiveSince={profile?.adaptiveSince ?? null}
        adaptiveTdee={profile?.adaptiveTdee ?? null}
        consumedToday={consumed._sum.kcal ?? 0}
        initial={initial}
        today={today}
        wizard={!profile}
      />
    </>
  );
}
