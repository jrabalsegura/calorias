import { AddScreen } from "../../components/AddScreen";
import { dayInMadrid, isValidDay, minutesInMadrid } from "@/domain/day";
import { isMeal, mealForMinutes } from "@/domain/meals";
import { requireCurrentUser } from "@/lib/auth";
import { loadLibrary } from "@/lib/foods";

export const dynamic = "force-dynamic";

type Params = { day?: string | string[]; meal?: string | string[]; food?: string | string[] };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** *Añadir*: search, favourites and recents of the library, and the other ways to log. */
export default async function AddPage({ searchParams }: { searchParams?: Promise<Params> }) {
  await requireCurrentUser();

  const params = await searchParams;
  const today = dayInMadrid();
  const requestedDay = first(params?.day);
  const requestedMeal = first(params?.meal);
  const day = isValidDay(requestedDay) ? requestedDay : today;
  const meal = isMeal(requestedMeal) ? requestedMeal : mealForMinutes(minutesInMadrid());

  const { foods, recentIds } = await loadLibrary(today);

  return (
    <AddScreen
      day={day}
      foods={foods}
      initialFoodId={first(params?.food) ?? null}
      meal={meal}
      recentIds={recentIds}
      today={today}
    />
  );
}
