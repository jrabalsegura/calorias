"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { formatKcal } from "@/domain/diary";
import { formatQuantity } from "@/domain/food";
import { MAX_SAVED_MEAL_NAME_LENGTH } from "@/domain/savedMeals";
import { saveMeal } from "../(app)/actions";
import { CloseIcon } from "./icons";

export type SaveMealTarget = {
  /** Label of the diary meal, the default name. */
  label: string;
  entries: {
    id: string;
    name: string | null;
    kcal: number;
    quantity: number | null;
    unit: string | null;
  }[];
};

/**
 * Saves the entries of a meal of the diary as a saved meal, to add them all
 * together from *Añadir* another day. Remount it (key) for every target.
 */
export function SaveMealSheet({
  target,
  onClose
}: {
  target: SaveMealTarget | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(target?.label ?? "");
  const [selected, setSelected] = useState(
    () => new Set(target?.entries.map(({ id }) => id) ?? [])
  );
  const [error, setError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (target && dialog && !dialog.open) dialog.showModal();
  }, [target]);

  if (!target) return null;

  const selectedKcal = target.entries
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
    startTransition(async () => {
      const result = await saveMeal({ entryIds: [...selected], name });
      if (result) setError(result.error);
      else setSavedName(name.trim().replace(/\s+/g, " "));
    });
  }

  const close = () => dialogRef.current?.close();

  return (
    <dialog
      aria-labelledby="save-meal-title"
      className="entry-sheet"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="grid gap-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink" id="save-meal-title">
            Guardar comida
          </h2>
          <button
            aria-label="Cerrar"
            className="-mr-2 grid h-12 w-12 place-items-center rounded-lg text-muted active:bg-line/50"
            onClick={close}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        {savedName ? (
          <>
            <p
              className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-900"
              role="status"
            >
              «{savedName}» guardada. La tienes en <strong>Añadir</strong>, en
              «Comidas guardadas».
            </p>
            <button className="primary-button w-full" onClick={close} type="button">
              Hecho
            </button>
          </>
        ) : (
          <form className="grid gap-4" noValidate onSubmit={onSubmit}>
            <p className="text-sm leading-6 text-muted">
              Se guardan los nombres, cantidades y kcal de ahora, para añadirlo
              todo junto otro día.
            </p>

            <label className="field-label">
              Nombre
              <input
                autoComplete="off"
                className="field-input"
                enterKeyHint="done"
                maxLength={MAX_SAVED_MEAL_NAME_LENGTH}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                placeholder="Ej.: almuerzo de siempre"
                type="text"
                value={name}
              />
            </label>

            <ul className="overflow-hidden rounded-lg border border-line">
              {target.entries.map((entry) => (
                <li className="border-b border-line last:border-b-0" key={entry.id}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2">
                    <input
                      checked={selected.has(entry.id)}
                      className="h-5 w-5 accent-accent"
                      onChange={(event) => toggle(entry.id, event.target.checked)}
                      type="checkbox"
                    />
                    <span className="grid min-w-0 flex-1">
                      <span
                        className={`truncate ${entry.name ? "text-ink" : "italic text-muted"}`}
                      >
                        {entry.name ?? "Entrada rápida"}
                      </span>
                      {entry.quantity !== null && entry.unit !== null ? (
                        <span className="text-sm text-muted">
                          {formatQuantity({ quantity: entry.quantity, unit: entry.unit })}
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums text-ink">{formatKcal(entry.kcal)}</span>
                  </label>
                </li>
              ))}
            </ul>

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
                ? "Guardando..."
                : selected.size === 0
                  ? "Elige qué guardar"
                  : `Guardar ${selected.size} · ${formatKcal(selectedKcal)} kcal`}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
