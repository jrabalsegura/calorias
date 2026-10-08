"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { defaultQuantity, kcalForQuantity } from "@/domain/food";
import { formatKcal } from "@/domain/diary";
import type { Meal } from "@/domain/meals";
import { parseDecimal } from "@/domain/target";
import type { LibraryFood } from "@/lib/foods";
import { deleteEntry, saveFoodEntry } from "../(app)/actions";
import { setFoodFavorite } from "../(app)/foods/actions";
import { CloseIcon, StarIcon } from "./icons";
import { MealPicker } from "./MealPicker";
import { decimalText, QuantityPicker, type QuantityValue } from "./QuantityPicker";

export type FoodSheetTarget =
  | { kind: "new"; food: LibraryFood; meal: Meal }
  | {
      kind: "edit";
      food: LibraryFood;
      entry: { id: string; meal: Meal; quantity: number | null; unit: string | null };
    };

function initialQuantity(target: FoodSheetTarget): QuantityValue {
  const saved =
    target.kind === "edit" && target.entry.quantity !== null && target.entry.unit !== null
      ? { quantity: target.entry.quantity, unit: target.entry.unit }
      : target.food.lastUsed;
  const { quantity, unit } = defaultQuantity(target.food, saved);
  return { quantity: decimalText(quantity), unit };
}

/**
 * Bottom sheet to log a food of the library (quantity and meal) or to change
 * an entry made from one. Remount it (key) for every target.
 */
export function FoodEntrySheet({
  day,
  target,
  onClose,
  onSaved
}: {
  day: string;
  target: FoodSheetTarget | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState<QuantityValue>(() =>
    target ? initialQuantity(target) : { quantity: "", unit: "g" }
  );
  const [favorite, setFavorite] = useState(target?.food.favorite ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (target && dialog && !dialog.open) dialog.showModal();
  }, [target]);

  if (!target) return null;

  const { food } = target;
  const entry = target.kind === "edit" ? target.entry : null;
  const quantity = parseDecimal(value.quantity);
  const kcal = quantity === null ? null : kcalForQuantity(food, { quantity, unit: value.unit });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const meal = new FormData(event.currentTarget).get("meal");
    startTransition(async () => {
      const result = await saveFoodEntry({
        id: entry?.id,
        foodId: food.id,
        day,
        meal: typeof meal === "string" ? meal : "",
        ...value
      });
      if (result) {
        setError(result.error);
      } else {
        dialogRef.current?.close();
        onSaved?.();
      }
    });
  }

  return (
    <dialog
      aria-labelledby="food-sheet-title"
      className="entry-sheet"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <form className="grid gap-4 p-4" noValidate onSubmit={onSubmit}>
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1 pt-2">
            <h2 className="text-lg font-semibold leading-tight text-ink" id="food-sheet-title">
              {food.name}
            </h2>
            {food.brand ? <p className="text-sm text-muted">{food.brand}</p> : null}
          </div>
          <button
            aria-label={favorite ? "Quitar de favoritos" : "Marcar como favorito"}
            aria-pressed={favorite}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg active:bg-line/50 ${
              favorite ? "text-amber-500" : "text-muted"
            }`}
            onClick={() => {
              const next = !favorite;
              setFavorite(next);
              void setFoodFavorite(food.id, next);
            }}
            type="button"
          >
            <StarIcon filled={favorite} />
          </button>
          <button
            aria-label="Cerrar"
            className="-mr-2 grid h-12 w-12 shrink-0 place-items-center rounded-lg text-muted active:bg-line/50"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <QuantityPicker
          food={food}
          onChange={(next) => {
            setValue(next);
            setError(null);
          }}
          value={value}
        />

        <MealPicker defaultMeal={entry?.meal ?? (target.kind === "new" ? target.meal : undefined)} />

        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button className="primary-button w-full" disabled={isPending} type="submit">
          {isPending
            ? "Guardando..."
            : entry
              ? "Guardar cambios"
              : kcal === null
                ? "Añadir"
                : `Añadir · ${formatKcal(kcal)} kcal`}
        </button>

        {entry ? (
          <button
            className={`inline-flex h-12 w-full items-center justify-center rounded-lg text-base font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
              confirmingDelete
                ? "bg-red-600 text-white"
                : "border border-red-200 bg-white text-red-700"
            }`}
            disabled={isPending}
            onClick={() => {
              if (!confirmingDelete) {
                setConfirmingDelete(true);
                return;
              }
              startTransition(async () => {
                await deleteEntry(entry.id);
                dialogRef.current?.close();
              });
            }}
            type="button"
          >
            {confirmingDelete ? "Toca otra vez para borrar" : "Borrar"}
          </button>
        ) : null}
      </form>
    </dialog>
  );
}
