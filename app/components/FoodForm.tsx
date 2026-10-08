"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  BASE_UNITS,
  MAX_BRAND_LENGTH,
  MAX_FOOD_NAME_LENGTH,
  MAX_PORTION_NAME_LENGTH,
  MAX_PORTIONS,
  type FoodFormValues
} from "@/domain/food";
import type { LibraryFood } from "@/lib/foods";
import { saveFood, setFoodArchived } from "../(app)/foods/actions";
import { CloseIcon, StarIcon } from "./icons";
import { decimalText } from "./QuantityPicker";

const EMPTY_PORTION = { name: "", amount: "" };

/**
 * Creates or edits a food. Changes only apply to new entries: the diary keeps
 * the name and kcal it copied.
 */
export function FoodForm({
  food,
  initialName,
  next
}: {
  food: LibraryFood | null;
  initialName: string;
  /** Where to go after creating it; the new food's id is added as ?food=. */
  next: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FoodFormValues>(() =>
    food
      ? {
          name: food.name,
          brand: food.brand ?? "",
          baseUnit: food.baseUnit,
          kcalPer100: decimalText(food.kcalPer100),
          portions: food.portions.map(({ name, amount }) => ({
            name,
            amount: decimalText(amount)
          }))
        }
      : { name: initialName, brand: "", baseUnit: "g", kcalPer100: "", portions: [] }
  );
  const [favorite, setFavorite] = useState(food?.favorite ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(patch: Partial<FoodFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function updatePortion(index: number, patch: Partial<(typeof values.portions)[number]>) {
    update({
      portions: values.portions.map((portion, i) =>
        i === index ? { ...portion, ...patch } : portion
      )
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveFood(food?.id ?? null, values, favorite);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(
        next ? `${next}${next.includes("?") ? "&" : "?"}food=${result.id}` : "/foods"
      );
    });
  }

  const unit = values.baseUnit === "ml" ? "ml" : "g";

  return (
    <form className="grid gap-4" noValidate onSubmit={onSubmit}>
      <section className="grid gap-4 rounded-lg border border-line bg-white p-4">
        <label className="field-label">
          Nombre
          <input
            autoComplete="off"
            className="field-input"
            enterKeyHint="next"
            maxLength={MAX_FOOD_NAME_LENGTH}
            onChange={(event) => update({ name: event.target.value })}
            placeholder="Ej.: pan de molde integral"
            type="text"
            value={values.name}
          />
        </label>

        <label className="field-label">
          <span>
            Marca <span className="font-normal text-muted">(opcional)</span>
          </span>
          <input
            autoComplete="off"
            className="field-input"
            enterKeyHint="next"
            maxLength={MAX_BRAND_LENGTH}
            onChange={(event) => update({ brand: event.target.value })}
            type="text"
            value={values.brand}
          />
        </label>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium text-ink">Se mide en</legend>
          <div className="grid grid-cols-2 gap-2">
            {BASE_UNITS.map(({ id, label }) => (
              <label className="relative" key={id}>
                <input
                  checked={values.baseUnit === id}
                  className="peer sr-only"
                  name="baseUnit"
                  onChange={() => update({ baseUnit: id })}
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

        <label className="field-label">
          Calorías por 100 {unit}
          <span className="relative">
            <input
              autoComplete="off"
              className="field-input pr-14 text-right text-xl font-semibold tabular-nums"
              enterKeyHint="done"
              inputMode="decimal"
              onChange={(event) => update({ kcalPer100: event.target.value })}
              placeholder="0"
              type="text"
              value={values.kcalPer100}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-base text-muted">
              kcal
            </span>
          </span>
        </label>
      </section>

      <section aria-labelledby="portions-title" className="grid gap-3 rounded-lg border border-line bg-white p-4">
        <div>
          <h2 className="font-semibold text-ink" id="portions-title">
            Porciones
          </h2>
          <p className="text-sm text-muted">
            Para apuntarlo sin pesar: «rebanada = 30 {unit}», «vaso = 250 {unit}».
          </p>
        </div>

        {values.portions.map((portion, index) => (
          <div className="flex items-center gap-2" key={index}>
            <input
              aria-label={`Nombre de la porción ${index + 1}`}
              autoComplete="off"
              className="field-input flex-1"
              maxLength={MAX_PORTION_NAME_LENGTH}
              onChange={(event) => updatePortion(index, { name: event.target.value })}
              placeholder="rebanada"
              type="text"
              value={portion.name}
            />
            <span className="relative w-28 shrink-0">
              <input
                aria-label={`${unit} de la porción ${index + 1}`}
                autoComplete="off"
                className="field-input pr-9 text-right tabular-nums"
                inputMode="decimal"
                onChange={(event) => updatePortion(index, { amount: event.target.value })}
                placeholder="0"
                type="text"
                value={portion.amount}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-base text-muted">
                {unit}
              </span>
            </span>
            <button
              aria-label={`Quitar la porción ${index + 1}`}
              className="-mr-2 grid h-12 w-10 shrink-0 place-items-center text-muted active:bg-line/50"
              onClick={() =>
                update({ portions: values.portions.filter((_, i) => i !== index) })
              }
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        ))}

        {values.portions.length < MAX_PORTIONS ? (
          <button
            className="secondary-button w-full"
            onClick={() => update({ portions: [...values.portions, EMPTY_PORTION] })}
            type="button"
          >
            Añadir porción
          </button>
        ) : null}
      </section>

      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line bg-white px-4">
        <input
          checked={favorite}
          className="sr-only"
          onChange={(event) => setFavorite(event.target.checked)}
          type="checkbox"
        />
        <span className={favorite ? "text-amber-500" : "text-muted"}>
          <StarIcon filled={favorite} />
        </span>
        <span className="flex-1 font-medium text-ink">Favorito</span>
        <span className="text-sm text-muted">{favorite ? "Sí" : "No"}</span>
      </label>

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button className="primary-button w-full" disabled={isPending} type="submit">
        {isPending ? "Guardando..." : food ? "Guardar cambios" : "Crear alimento"}
      </button>

      {food ? (
        <>
          <p className="text-center text-sm leading-6 text-muted">
            Los cambios solo afectan a lo que apuntes a partir de ahora.
          </p>
          <button
            className="secondary-button w-full"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await setFoodArchived(food.id, !food.archived);
                router.push("/foods");
              })
            }
            type="button"
          >
            {food.archived ? "Recuperar del archivo" : "Archivar"}
          </button>
          {food.archived ? null : (
            <p className="text-center text-sm leading-6 text-muted">
              Archivado deja de salir al añadir; tus días pasados no cambian.
            </p>
          )}
        </>
      ) : null}
    </form>
  );
}
