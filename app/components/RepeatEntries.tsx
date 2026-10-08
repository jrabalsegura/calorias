"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addDays, formatRelativeDay, isValidDay } from "@/domain/day";
import { formatKcal } from "@/domain/diary";
import { formatQuantity } from "@/domain/food";
import { mealLabel, MEALS, type Meal } from "@/domain/meals";
import { copyDiaryEntries } from "../(app)/actions";
import { addHref, diaryHref } from "./links";
import { MealPicker } from "./MealPicker";
import { PageHeader } from "./PageHeader";

type RepeatEntry = {
  id: string;
  meal: string;
  name: string | null;
  kcal: number;
  quantity: number | null;
  unit: string | null;
};

/**
 * Entries of the `from` day to copy into `day`. The same meal comes
 * preselected, so "lo mismo que ayer" is a single tap.
 */
export function RepeatEntries({
  day,
  today,
  meal,
  from,
  entries
}: {
  day: string;
  today: string;
  meal: Meal;
  from: string;
  entries: RepeatEntry[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(
    () => new Set(entries.filter((entry) => entry.meal === meal).map(({ id }) => id))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fromHref = (next: string) => `/add/repeat?day=${day}&meal=${meal}&from=${next}`;
  const selectedKcal = entries
    .filter(({ id }) => selected.has(id))
    .reduce((sum, { kcal }) => sum + kcal, 0);

  function toggle(ids: string[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setError(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = new FormData(event.currentTarget).get("meal");
    startTransition(async () => {
      const result = await copyDiaryEntries({
        ids: [...selected],
        day,
        meal: typeof target === "string" ? target : ""
      });
      if (result) setError(result.error);
      else router.push(diaryHref(day, today));
    });
  }

  return (
    <>
      <PageHeader
        backHref={addHref(day, meal)}
        backLabel="Volver a Añadir"
        subtitle={`A ${formatRelativeDay(day, today).toLowerCase()} · ${mealLabel(meal)}`}
        title="Repetir"
      />

      <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2 rounded-lg border border-line bg-white">
        <button
          aria-label="Día anterior"
          className="grid h-12 w-12 place-items-center text-ink active:bg-line/50"
          onClick={() => router.replace(fromHref(addDays(from, -1)))}
          type="button"
        >
          <Chevron direction="left" />
        </button>
        <label className="relative grid min-h-12 cursor-pointer place-items-center text-center">
          <span className="text-sm text-muted">Copiar de</span>
          <span className="font-semibold text-ink">{formatRelativeDay(from, today)}</span>
          <input
            aria-label="Elegir el día que copiar"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(event) => {
              if (isValidDay(event.target.value)) router.replace(fromHref(event.target.value));
            }}
            type="date"
            value={from}
          />
        </label>
        <button
          aria-label="Día siguiente"
          className="grid h-12 w-12 place-items-center text-ink active:bg-line/50"
          onClick={() => router.replace(fromHref(addDays(from, 1)))}
          type="button"
        >
          <Chevron direction="right" />
        </button>
      </div>

      {entries.length === 0 ? (
        <section className="rounded-lg border border-dashed border-line bg-white px-4 py-10 text-center text-sm leading-6 text-muted">
          Ese día no tiene nada apuntado.
        </section>
      ) : (
        <form className="grid gap-4" noValidate onSubmit={onSubmit}>
          {MEALS.map(({ id: mealId, label }) => {
            const mealEntries = entries.filter((entry) => entry.meal === mealId);
            if (mealEntries.length === 0) return null;
            const ids = mealEntries.map(({ id }) => id);
            const allSelected = ids.every((id) => selected.has(id));

            return (
              <section
                aria-label={label}
                className="overflow-hidden rounded-lg border border-line bg-white"
                key={mealId}
              >
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4">
                  <input
                    checked={allSelected}
                    className="h-5 w-5 accent-accent"
                    onChange={() => toggle(ids, !allSelected)}
                    type="checkbox"
                  />
                  <span className="flex-1 font-semibold text-ink">{label}</span>
                  <span className="text-sm tabular-nums text-muted">
                    {formatKcal(mealEntries.reduce((sum, { kcal }) => sum + kcal, 0))} kcal
                  </span>
                </label>
                <ul className="border-t border-line">
                  {mealEntries.map((entry) => (
                    <li className="border-b border-line last:border-b-0" key={entry.id}>
                      <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2">
                        <input
                          checked={selected.has(entry.id)}
                          className="h-5 w-5 accent-accent"
                          onChange={(event) => toggle([entry.id], event.target.checked)}
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
              </section>
            );
          })}

          <section className="grid gap-4 rounded-lg border border-line bg-white p-4">
            <MealPicker defaultMeal={meal} />

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
                  ? "Elige qué repetir"
                  : `Añadir ${selected.size} · ${formatKcal(selectedKcal)} kcal`}
            </button>
          </section>
        </form>
      )}
    </>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d={direction === "left" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
    </svg>
  );
}
