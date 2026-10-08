import { DayNav } from "../components/DayNav";
import { DiaryView } from "../components/DiaryView";
import { dayInMadrid, isValidDay } from "@/domain/day";
import { sumDiary } from "@/domain/diary";
import { requireCurrentUser } from "@/lib/auth";
import { loadTarget } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

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

  const [entries, goal] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { day },
      orderBy: { createdAt: "asc" },
      select: { id: true, meal: true, name: true, kcal: true }
    }),
    // Every day is measured against the current target (no history yet).
    loadTarget(today)
  ]);

  return (
    <>
      <DayNav day={day} today={today} />
      <DiaryView
        day={day}
        entries={entries}
        goalKcal={goal?.target.target ?? null}
        totals={sumDiary(entries)}
      />
      {/* Keeps the last meal clear of the floating add button. */}
      <div aria-hidden="true" className="h-12" />
    </>
  );
}
