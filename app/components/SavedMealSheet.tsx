"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { formatKcal } from "@/domain/diary";
import { formatQuantity } from "@/domain/food";
import type { Meal } from "@/domain/meals";
import type { SavedMealView } from "@/lib/savedMeals";
import { addSavedMeal, deleteSavedMeal } from "../(app)/actions";
import { CloseIcon } from "./icons";
import { MealPicker } from "./MealPicker";

export type SavedMealTarget = { savedMeal: SavedMealView; meal: Meal };

/**
 * Adds a saved meal to the diary, every item preselected, or deletes it.
 * Remount it (key) for every target.
 */
export function SavedMealSheet({
  day,
  target,
  onClose,
  onSaved
}: {
  day: string;
  target: SavedMealTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(
    () => new Set(target?.savedMeal.items.map(({ id }) => id) ?? [])
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (target && dialog && !dialog.open) dialog.showModal();
  }, [target]);

  if (!target) return null;

  const { savedMeal } = target;
  const selectedKcal = savedMeal.items
    .filter(({ id }) => selected.has(id))
    .reduce((sum, { kcal }) => sum + kcal, 0);

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    setError(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const meal = new FormData(event.currentTarget).get("meal");
    startTransition(async () => {
      const result = await addSavedMeal({
        id: savedMeal.id,
        itemIds: [...selected],
        day,
        meal: typeof meal === "string" ? meal : ""
      });
      if (result) {
        setError(result.error);
      } else {
        dialogRef.current?.close();
        onSaved();
      }
    });
  }

  return (
    <dialog
      aria-labelledby="saved-meal-title"
      className="entry-sheet"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <form className="grid gap-4 p-4" noValidate onSubmit={onSubmit}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 text-lg font-semibold text-ink" id="saved-meal-title">
            {savedMeal.name}
          </h2>
          <button
            aria-label="Cerrar"
            className="-mr-2 grid h-12 w-12 shrink-0 place-items-center rounded-lg text-muted active:bg-line/50"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <ul className="overflow-hidden rounded-lg border border-line">
          {savedMeal.items.map((item) => (
            <li className="border-b border-line last:border-b-0" key={item.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2">
                <input
                  checked={selected.has(item.id)}
                  className="h-5 w-5 accent-accent"
                  onChange={(event) => toggle(item.id, event.target.checked)}
                  type="checkbox"
                />
                <span className="grid min-w-0 flex-1">
                  <span className={`truncate ${item.name ? "text-ink" : "italic text-muted"}`}>
                    {item.name ?? "Entrada rápida"}
                  </span>
                  {item.quantity !== null && item.unit !== null ? (
                    <span className="text-sm text-muted">
                      {formatQuantity({ quantity: item.quantity, unit: item.unit })}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-ink">{formatKcal(item.kcal)}</span>
              </label>
            </li>
          ))}
        </ul>

        <MealPicker defaultMeal={target.meal} />

        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          className="primary-button w-full"
          disabled={isPending || selected.size === 0}
          type="submit"
        >
          {isPending
            ? "Añadiendo..."
            : selected.size === 0
              ? "Elige qué añadir"
              : `Añadir ${selected.size} · ${formatKcal(selectedKcal)} kcal`}
        </button>

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
              await deleteSavedMeal(savedMeal.id);
              dialogRef.current?.close();
            });
          }}
          type="button"
        >
          {confirmingDelete ? "Toca otra vez para borrarla" : "Borrar comida guardada"}
        </button>
      </form>
    </dialog>
  );
}
