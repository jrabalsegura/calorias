"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatRelativeDay } from "@/domain/day";
import { formatKcal } from "@/domain/diary";
import {
  defaultQuantity,
  formatAmount,
  formatQuantity,
  kcalForQuantity,
  searchFoods
} from "@/domain/food";
import { mealLabel, type Meal } from "@/domain/meals";
import type { LibraryFood } from "@/lib/foods";
import { EntrySheet, type SheetTarget } from "./EntrySheet";
import { FoodEntrySheet, type FoodSheetTarget } from "./FoodEntrySheet";
import {
  BarcodeIcon,
  BoltIcon,
  CloseIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  StarIcon,
  TextIcon
} from "./icons";
import { addHref, diaryHref, scanHref, textHref } from "./links";
import { PageHeader } from "./PageHeader";

const SEARCH_LIMIT = 40;

export function AddScreen({
  day,
  today,
  meal,
  foods,
  recentIds,
  initialFoodId
}: {
  day: string;
  today: string;
  meal: Meal;
  foods: LibraryFood[];
  recentIds: string[];
  /** A food to open straight away (just created from this screen). */
  initialFoodId: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [foodTarget, setFoodTarget] = useState<FoodSheetTarget | null>(() => {
    const food = foods.find(({ id }) => id === initialFoodId);
    return food ? { kind: "new", food, meal } : null;
  });
  const [quickTarget, setQuickTarget] = useState<SheetTarget | null>(null);
  // Remounts the sheets on every open so they never show stale values.
  const [openCount, setOpenCount] = useState(0);

  const backHref = diaryHref(day, today);
  const goBack = () => router.push(backHref);

  // Favourites first, then by recent use; foods arrive sorted by name.
  const ordered = useMemo(() => {
    const recentRank = new Map(recentIds.map((id, index) => [id, index]));
    return [...foods].sort(
      (a, b) =>
        Number(b.favorite) - Number(a.favorite) ||
        (recentRank.get(a.id) ?? Infinity) - (recentRank.get(b.id) ?? Infinity)
    );
  }, [foods, recentIds]);

  const byId = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const favorites = foods.filter(({ favorite }) => favorite);
  const recents = recentIds.flatMap((id) => {
    const food = byId.get(id);
    return food && !food.favorite ? [food] : [];
  });
  const results = query.trim() ? searchFoods(ordered, query).slice(0, SEARCH_LIMIT) : null;

  function pick(food: LibraryFood) {
    setFoodTarget({ kind: "new", food, meal });
    setOpenCount((count) => count + 1);
  }

  const newFoodHref = (name?: string) =>
    `/foods/new?next=${encodeURIComponent(addHref(day, meal))}${
      name ? `&name=${encodeURIComponent(name.trim())}` : ""
    }`;

  return (
    <>
      <PageHeader
        backHref={backHref}
        backLabel="Volver al diario"
        subtitle={`${formatRelativeDay(day, today)} · ${mealLabel(meal)}`}
        title="Añadir"
      />

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
          placeholder="Buscar en tus alimentos"
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

      {results ? (
        results.length > 0 ? (
          <FoodList foods={results} label="Resultados" onPick={pick} />
        ) : (
          <section className="grid gap-3 rounded-lg border border-dashed border-line bg-white px-4 py-6 text-center">
            <p className="text-sm text-muted">No tienes ningún alimento con «{query.trim()}».</p>
            <Link className="secondary-button" href={newFoodHref(query)}>
              Crear «{query.trim()}»
            </Link>
          </section>
        )
      ) : (
        <>
          <Link className="secondary-button w-full gap-2" href={scanHref(day, meal)}>
            <span className="text-accent">
              <BarcodeIcon />
            </span>
            Escanear código de barras
          </Link>
          <Link className="secondary-button w-full gap-2" href={textHref(day, meal)}>
            <span className="text-accent">
              <TextIcon />
            </span>
            Describir lo que has comido
          </Link>
          <div className="grid grid-cols-3 gap-2">
            <ShortcutButton
              icon={<BoltIcon />}
              label="Entrada rápida"
              onClick={() => {
                setQuickTarget({ kind: "new", meal });
                setOpenCount((count) => count + 1);
              }}
            />
            <ShortcutButton
              href={`/add/repeat?day=${day}&meal=${meal}`}
              icon={<RepeatIcon />}
              label="Repetir"
            />
            <ShortcutButton href={newFoodHref()} icon={<PlusIcon />} label="Nuevo alimento" />
          </div>

          {favorites.length > 0 ? (
            <FoodList foods={favorites} label="Favoritos" onPick={pick} />
          ) : null}
          {recents.length > 0 ? (
            <FoodList foods={recents} label="Recientes" onPick={pick} />
          ) : null}
          {foods.length === 0 ? (
            <section className="rounded-lg border border-dashed border-line bg-white px-4 py-8 text-center text-sm leading-6 text-muted">
              Aún no tienes alimentos guardados. Crea los que comes a menudo, o
              guarda una entrada rápida como alimento desde el diario.
            </section>
          ) : favorites.length === 0 && recents.length === 0 ? (
            <section className="rounded-lg border border-dashed border-line bg-white px-4 py-8 text-center text-sm leading-6 text-muted">
              Busca entre tus {foods.length} alimentos. Los que uses aparecerán
              aquí como recientes.
            </section>
          ) : null}
        </>
      )}

      <Link
        className="justify-self-center px-4 py-3 text-sm font-semibold text-accent"
        href="/foods"
      >
        Gestionar mis alimentos
      </Link>

      <FoodEntrySheet
        day={day}
        key={`food-${openCount}`}
        onClose={() => setFoodTarget(null)}
        onSaved={goBack}
        target={foodTarget}
      />
      <EntrySheet
        day={day}
        key={`quick-${openCount}`}
        onClose={() => setQuickTarget(null)}
        onSaved={goBack}
        target={quickTarget}
      />
    </>
  );
}

function ShortcutButton({
  icon,
  label,
  href,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border border-line bg-white px-2 py-2 text-center text-sm font-medium leading-tight text-ink active:bg-line/40";
  const content = (
    <>
      <span className="text-accent">{icon}</span>
      {label}
    </>
  );

  return href ? (
    <Link className={className} href={href}>
      {content}
    </Link>
  ) : (
    <button className={className} onClick={onClick} type="button">
      {content}
    </button>
  );
}

function FoodList({
  label,
  foods,
  onPick
}: {
  label: string;
  foods: LibraryFood[];
  onPick: (food: LibraryFood) => void;
}) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-lg border border-line bg-white">
      <h2 className="px-4 pb-2 pt-3 text-sm font-semibold text-muted">{label}</h2>
      <ul className="border-t border-line">
        {foods.map((food) => {
          const quantity = defaultQuantity(food, food.lastUsed);
          const kcal = kcalForQuantity(food, quantity) ?? 0;

          return (
            <li className="border-b border-line last:border-b-0" key={food.id}>
              <button
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-line/40"
                onClick={() => onPick(food)}
                type="button"
              >
                <span className="grid min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-ink">
                    <span className="truncate">{food.name}</span>
                    {food.favorite ? (
                      <StarIcon className="h-4 w-4 shrink-0 text-amber-500" filled />
                    ) : null}
                  </span>
                  <span className="truncate text-sm text-muted">
                    {[food.brand, formatQuantity(quantity)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block tabular-nums text-ink">{formatKcal(kcal)}</span>
                  <span className="block text-xs text-muted">
                    {formatAmount(food.kcalPer100)}/100 {food.baseUnit}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
