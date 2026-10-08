"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { minutesInMadrid } from "@/domain/day";
import { formatKcal, type DiaryTotals } from "@/domain/diary";
import { formatQuantity } from "@/domain/food";
import { mealForMinutes, MEALS, type Meal } from "@/domain/meals";
import type { LibraryFood } from "@/lib/foods";
import { DayGoal } from "./DayGoal";
import { EntrySheet, type SheetTarget } from "./EntrySheet";
import { FoodEntrySheet, type FoodSheetTarget } from "./FoodEntrySheet";
import { PlusIcon } from "./icons";
import { addHref } from "./links";

export type DiaryViewEntry = {
  id: string;
  meal: string;
  name: string | null;
  kcal: number;
  quantity: number | null;
  unit: string | null;
  /** The library food it was made from, to change its quantity. */
  food: LibraryFood | null;
};

export function DiaryView({
  day,
  entries,
  totals,
  goalKcal
}: {
  day: string;
  entries: DiaryViewEntry[];
  totals: DiaryTotals;
  /** Daily kcal target, or null until the profile is filled in. */
  goalKcal: number | null;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [foodTarget, setFoodTarget] = useState<FoodSheetTarget | null>(null);
  // Remounts the sheets on every open so they never show stale values.
  const [openCount, setOpenCount] = useState(0);

  function open(entry: DiaryViewEntry) {
    const meal = entry.meal as Meal;
    if (entry.food) {
      setFoodTarget({
        kind: "edit",
        food: entry.food,
        entry: { id: entry.id, meal, quantity: entry.quantity, unit: entry.unit }
      });
    } else {
      setTarget({ kind: "edit", entry: { ...entry, meal } });
    }
    setOpenCount((count) => count + 1);
  }

  return (
    <>
      <DayGoal consumed={totals.total} target={goalKcal} />

      {MEALS.map(({ id: meal, label }) => {
        const mealEntries = entries.filter((entry) => entry.meal === meal);

        return (
          <section
            aria-label={label}
            className="overflow-hidden rounded-lg border border-line bg-white"
            key={meal}
          >
            <header className="flex items-center gap-2 pl-4">
              <h2 className="flex-1 font-semibold text-ink">{label}</h2>
              <span className="text-sm font-medium tabular-nums text-muted">
                {formatKcal(totals.byMeal[meal])} kcal
              </span>
              <Link
                aria-label={`Añadir a ${label.toLowerCase()}`}
                className="grid h-12 w-12 place-items-center text-accent active:bg-line/50"
                href={addHref(day, meal)}
              >
                <PlusIcon />
              </Link>
            </header>

            {mealEntries.length > 0 ? (
              <ul className="border-t border-line">
                {mealEntries.map((entry) => (
                  <li className="border-b border-line last:border-b-0" key={entry.id}>
                    <button
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-line/40"
                      onClick={() => open(entry)}
                      type="button"
                    >
                      <span className="grid min-w-0 flex-1">
                        <span
                          className={`truncate ${
                            entry.name ? "text-ink" : "italic text-muted"
                          }`}
                        >
                          {entry.name ?? "Entrada rápida"}
                        </span>
                        {entry.quantity !== null && entry.unit !== null ? (
                          <span className="truncate text-sm text-muted">
                            {formatQuantity({ quantity: entry.quantity, unit: entry.unit })}
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular-nums text-ink">
                        {formatKcal(entry.kcal)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}

      <button
        aria-label="Añadir entrada"
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-[max(1rem,calc(50vw-15rem))] z-10 grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg transition active:scale-95"
        onClick={() => router.push(addHref(day, mealForMinutes(minutesInMadrid())))}
        type="button"
      >
        <PlusIcon />
      </button>

      <EntrySheet
        day={day}
        key={`quick-${openCount}`}
        onClose={() => setTarget(null)}
        target={target}
      />
      <FoodEntrySheet
        day={day}
        key={`food-${openCount}`}
        onClose={() => setFoodTarget(null)}
        target={foodTarget}
      />
    </>
  );
}
