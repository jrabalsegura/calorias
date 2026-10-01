"use client";

import { useState } from "react";
import { minutesInMadrid } from "@/domain/day";
import { formatKcal, type DiaryTotals } from "@/domain/diary";
import { mealForMinutes, MEALS, type Meal } from "@/domain/meals";
import { EntrySheet, type SheetTarget } from "./EntrySheet";

export type DiaryViewEntry = {
  id: string;
  meal: string;
  name: string | null;
  kcal: number;
};

export function DiaryView({
  day,
  entries,
  totals
}: {
  day: string;
  entries: DiaryViewEntry[];
  totals: DiaryTotals;
}) {
  const [target, setTarget] = useState<SheetTarget | null>(null);
  // Remounts the sheet's form on every open so it never shows stale values.
  const [openCount, setOpenCount] = useState(0);

  function open(next: SheetTarget) {
    setTarget(next);
    setOpenCount((count) => count + 1);
  }

  return (
    <>
      <section
        aria-label="Total del día"
        className="grid gap-1 rounded-lg border border-line bg-white px-4 py-4 text-center"
      >
        <p className="text-sm font-medium text-muted">Total del día</p>
        <p className="text-4xl font-semibold tabular-nums text-ink">
          {formatKcal(totals.total)}
          <span className="ml-1 text-lg font-medium text-muted">kcal</span>
        </p>
      </section>

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
              <button
                aria-label={`Añadir a ${label.toLowerCase()}`}
                className="grid h-12 w-12 place-items-center text-accent active:bg-line/50"
                onClick={() => open({ kind: "new", meal })}
                type="button"
              >
                <PlusIcon />
              </button>
            </header>

            {mealEntries.length > 0 ? (
              <ul className="border-t border-line">
                {mealEntries.map((entry) => (
                  <li className="border-b border-line last:border-b-0" key={entry.id}>
                    <button
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-line/40"
                      onClick={() =>
                        open({
                          kind: "edit",
                          entry: { ...entry, meal: entry.meal as Meal }
                        })
                      }
                      type="button"
                    >
                      <span
                        className={`min-w-0 flex-1 truncate ${
                          entry.name ? "text-ink" : "italic text-muted"
                        }`}
                      >
                        {entry.name ?? "Entrada rápida"}
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
        onClick={() =>
          open({ kind: "new", meal: mealForMinutes(minutesInMadrid()) })
        }
        type="button"
      >
        <PlusIcon />
      </button>

      <EntrySheet
        day={day}
        key={openCount}
        onClose={() => setTarget(null)}
        target={target}
      />
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2.2}
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
