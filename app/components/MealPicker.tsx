import { MEALS } from "@/domain/meals";

/** Six meal buttons as radios named "meal", read through FormData. */
export function MealPicker({ defaultMeal }: { defaultMeal: string | undefined }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium text-ink">Comida</legend>
      <div className="grid grid-cols-3 gap-2">
        {MEALS.map(({ id, label }) => (
          <label className="relative" key={id}>
            <input
              className="peer sr-only"
              defaultChecked={id === defaultMeal}
              name="meal"
              type="radio"
              value={id}
            />
            <span className="flex h-12 cursor-pointer items-center justify-center rounded-lg border border-line bg-white text-sm font-medium text-ink peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
