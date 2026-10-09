import { LabelScreen } from "../../../components/LabelScreen";
import { normalizeBarcode } from "@/domain/barcode";
import { dayInMadrid, isValidDay, minutesInMadrid } from "@/domain/day";
import { isMeal, mealForMinutes } from "@/domain/meals";
import { requireCurrentUser } from "@/lib/auth";
import { loadFoodForAdding } from "@/lib/foods";

export const dynamic = "force-dynamic";

type Params = {
  day?: string | string[];
  meal?: string | string[];
  barcode?: string | string[];
  food?: string | string[];
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * *Foto de la etiqueta*: photo → AI reading → review → library food (with
 * the barcode it came from, if any) → quantity → diary.
 */
export default async function LabelPage({ searchParams }: { searchParams?: Promise<Params> }) {
  await requireCurrentUser();

  const params = await searchParams;
  const today = dayInMadrid();
  const requestedDay = first(params?.day);
  const requestedMeal = first(params?.meal);
  const day = isValidDay(requestedDay) ? requestedDay : today;
  const meal = isMeal(requestedMeal) ? requestedMeal : mealForMinutes(minutesInMadrid());
  const requestedBarcode = first(params?.barcode);
  const barcode = requestedBarcode ? normalizeBarcode(requestedBarcode) : null;
  const foodId = first(params?.food);
  const food = foodId ? await loadFoodForAdding(foodId) : null;

  return (
    <LabelScreen
      barcode={barcode}
      day={day}
      initialFood={food}
      key={food?.id ?? "label"}
      meal={meal}
      today={today}
    />
  );
}
