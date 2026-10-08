import { ScanScreen } from "../../../components/ScanScreen";
import { dayInMadrid, isValidDay, minutesInMadrid } from "@/domain/day";
import { isMeal, mealForMinutes } from "@/domain/meals";
import { requireCurrentUser } from "@/lib/auth";
import { loadFoodForAdding } from "@/lib/foods";

export const dynamic = "force-dynamic";

type Params = { day?: string | string[]; meal?: string | string[]; food?: string | string[] };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** *Escanear*: barcode → library or Open Food Facts → quantity → diary. */
export default async function ScanPage({ searchParams }: { searchParams?: Promise<Params> }) {
  await requireCurrentUser();

  const params = await searchParams;
  const today = dayInMadrid();
  const requestedDay = first(params?.day);
  const requestedMeal = first(params?.meal);
  const day = isValidDay(requestedDay) ? requestedDay : today;
  const meal = isMeal(requestedMeal) ? requestedMeal : mealForMinutes(minutesInMadrid());
  const foodId = first(params?.food);
  const food = foodId ? await loadFoodForAdding(foodId) : null;

  // Keyed by the food so coming back with ?food= starts a fresh screen.
  return (
    <ScanScreen day={day} initialFood={food} key={food?.id ?? "scan"} meal={meal} today={today} />
  );
}
