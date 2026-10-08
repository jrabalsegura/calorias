"use client";

import Link from "next/link";
import { useState } from "react";
import { formatAmount, searchFoods } from "@/domain/food";
import type { LibraryFood } from "@/lib/foods";
import { CloseIcon, SearchIcon, StarIcon } from "./icons";

/** The whole library to manage it: search, and archived foods apart. */
export function FoodLibrary({ foods }: { foods: LibraryFood[] }) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const active = foods.filter(({ archived }) => !archived);
  const archived = foods.filter((food) => food.archived);
  const shown = query.trim() ? searchFoods(active, query) : active;
  const archivedShown = query.trim() ? searchFoods(archived, query) : archived;

  return (
    <>
      <Link className="primary-button w-full" href="/foods/new">
        Nuevo alimento
      </Link>

      {foods.length > 0 ? (
        <label className="relative block">
          <span className="sr-only">Buscar alimento</span>
          <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-muted">
            <SearchIcon />
          </span>
          <input
            autoComplete="off"
            className="field-input pl-10 pr-12"
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar"
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label="Borrar búsqueda"
              className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted"
              onClick={() => setQuery("")}
              type="button"
            >
              <CloseIcon />
            </button>
          ) : null}
        </label>
      ) : null}

      {foods.length === 0 ? (
        <section className="rounded-lg border border-dashed border-line bg-white px-4 py-10 text-center text-sm leading-6 text-muted">
          Guarda aquí lo que comes a menudo, con sus kcal por 100 g o ml y sus
          porciones, para apuntarlo en dos toques.
        </section>
      ) : shown.length > 0 ? (
        <FoodRows foods={shown} label={`Alimentos (${shown.length})`} />
      ) : (
        <p className="py-4 text-center text-sm text-muted">
          Ningún alimento coincide con «{query.trim()}».
        </p>
      )}

      {archivedShown.length > 0 ? (
        showArchived ? (
          <FoodRows foods={archivedShown} label={`Archivados (${archivedShown.length})`} />
        ) : (
          <button
            className="h-12 text-sm font-semibold text-accent"
            onClick={() => setShowArchived(true)}
            type="button"
          >
            Ver archivados ({archivedShown.length})
          </button>
        )
      ) : null}
    </>
  );
}

function FoodRows({ label, foods }: { label: string; foods: LibraryFood[] }) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-lg border border-line bg-white">
      <h2 className="px-4 pb-2 pt-3 text-sm font-semibold text-muted">{label}</h2>
      <ul className="border-t border-line">
        {foods.map((food) => (
          <li className="border-b border-line last:border-b-0" key={food.id}>
            <Link
              className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-line/40"
              href={`/foods/${food.id}`}
            >
              <span className="grid min-w-0 flex-1">
                <span className="flex items-center gap-1 text-ink">
                  <span className="truncate">{food.name}</span>
                  {food.favorite ? (
                    <StarIcon className="h-4 w-4 shrink-0 text-amber-500" filled />
                  ) : null}
                </span>
                <span className="truncate text-sm text-muted">
                  {[
                    food.brand,
                    food.portions.length > 0
                      ? food.portions.map(({ name }) => name).join(", ")
                      : null
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sin porciones"}
                </span>
              </span>
              <span className="text-right text-sm tabular-nums text-ink">
                {formatAmount(food.kcalPer100)}
                <span className="block text-xs text-muted">kcal/100 {food.baseUnit}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
