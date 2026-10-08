import { RepeatEntries } from "../../../components/RepeatEntries";
import { addDays, dayInMadrid, isValidDay, minutesInMadrid } from "@/domain/day";
import { isMeal, mealForMinutes } from "@/domain/meals";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { day?: string | string[]; meal?: string | string[]; from?: string | string[] };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** Copy a meal or single entries of another day ("lo mismo que ayer"). */
export default async function RepeatPage({ searchParams }: { searchParams?: Promise<Params> }) {
  await requireCurrentUser();

  const params = await searchParams;
  const today = dayInMadrid();
  const requestedDay = first(params?.day);
  const requestedMeal = first(params?.meal);
  const requestedFrom = first(params?.from);
  const day = isValidDay(requestedDay) ? requestedDay : today;
  const meal = isMeal(requestedMeal) ? requestedMeal : mealForMinutes(minutesInMadrid());
  const from = isValidDay(requestedFrom) ? requestedFrom : addDays(day, -1);

  const entries = await prisma.diaryEntry.findMany({
    where: { day: from },
    orderBy: { createdAt: "asc" },
    select: { id: true, meal: true, name: true, kcal: true, quantity: true, unit: true }
  });

  return (
    <RepeatEntries
      day={day}
      entries={entries}
      from={from}
      key={from}
      meal={meal}
      today={today}
    />
  );
}
