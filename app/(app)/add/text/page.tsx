import { TextScreen } from "../../../components/TextScreen";
import { dayInMadrid, isValidDay, minutesInMadrid } from "@/domain/day";
import { isMeal, mealForMinutes } from "@/domain/meals";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { day?: string | string[]; meal?: string | string[] };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** *Describir comida*: free text → AI breakdown → review → diary. */
export default async function TextPage({ searchParams }: { searchParams?: Promise<Params> }) {
  await requireCurrentUser();

  const params = await searchParams;
  const today = dayInMadrid();
  const requestedDay = first(params?.day);
  const requestedMeal = first(params?.meal);
  const day = isValidDay(requestedDay) ? requestedDay : today;
  const meal = isMeal(requestedMeal) ? requestedMeal : mealForMinutes(minutesInMadrid());

  return <TextScreen day={day} meal={meal} today={today} />;
}
