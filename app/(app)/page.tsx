import Link from "next/link";
import { DayCompleteness } from "../components/DayCompleteness";
import { DayNav } from "../components/DayNav";
import { DiaryView } from "../components/DiaryView";
import { dayInMadrid, isValidDay } from "@/domain/day";
import { sumDiary } from "@/domain/diary";
import { isDayMark } from "@/domain/summary";
import { requireCurrentUser } from "@/lib/auth";
import { foodSelect, toLibraryFood } from "@/lib/foods";
import { loadTarget } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { loadCheckInState } from "@/lib/summary";

export const dynamic = "force-dynamic";

export default async function TodayPage({
  searchParams
}: {
  searchParams?: Promise<{ day?: string | string[] }>;
}) {
  await requireCurrentUser();

  const params = await searchParams;
  const requested = Array.isArray(params?.day) ? params.day[0] : params?.day;
  const today = dayInMadrid();
  const day = isValidDay(requested) ? requested : today;

  const [entries, goal, mark, checkIn] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { day },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        meal: true,
        name: true,
        kcal: true,
        quantity: true,
        unit: true,
        food: { select: foodSelect }
      }
    }),
    // Every day is measured against the current target (no history yet).
    loadTarget(today),
    prisma.diaryDay.findUnique({ where: { day }, select: { status: true } }),
    day === today ? loadCheckInState(today) : null
  ]);
  const totals = sumDiary(entries);

  return (
    <>
      <DayNav day={day} today={today} />
      {checkIn?.kind === "ready" ? (
        <Link
          className="grid gap-0.5 rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 active:bg-accent/10"
          href="/summary"
        >
          <span className="font-semibold text-accent">Check-in semanal listo</span>
          <span className="text-sm text-ink">Revisa tu gasto real y tu objetivo.</span>
        </Link>
      ) : null}
      <DiaryView
        day={day}
        entries={entries.map(({ food, ...entry }) => ({
          ...entry,
          food: food ? toLibraryFood(food) : null
        }))}
        goalKcal={goal?.target.target ?? null}
        totals={totals}
      />
      <DayCompleteness
        record={{
          day,
          kcal: totals.total,
          entries: entries.length,
          mark: isDayMark(mark?.status) ? mark.status : null
        }}
      />
      {/* Keeps the last meal clear of the floating add button. */}
      <div aria-hidden="true" className="h-12" />
    </>
  );
}
