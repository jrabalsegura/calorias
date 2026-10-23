import { PhotoScreen } from "../../../components/PhotoScreen";
import { dayInMadrid, isValidDay, minutesInMadrid } from "@/domain/day";
import { isMeal, mealForMinutes } from "@/domain/meals";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { day?: string | string[]; meal?: string | string[] };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** *Foto del plato*: photo (and a note) → AI breakdown → review → diary. */
export default async function PhotoPage({ searchParams }: { searchParams?: Promise<Params> }) {
  await requireCurrentUser();

  const params = await searchParams;
  const today = dayInMadrid();
  const requestedDay = first(params?.day);
  const requestedMeal = first(params?.meal);
  const day = isValidDay(requestedDay) ? requestedDay : today;
  const meal = isMeal(requestedMeal) ? requestedMeal : mealForMinutes(minutesInMadrid());

  return <PhotoScreen day={day} meal={meal} today={today} />;
}
