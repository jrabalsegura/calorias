"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatRelativeDay } from "@/domain/day";
import { formatKcal } from "@/domain/diary";
import { formatAmount } from "@/domain/food";
import { mealLabel, type Meal } from "@/domain/meals";
import { parseDecimal } from "@/domain/target";
import {
  CONFIDENCE_LEVELS,
  kcalFor,
  MAX_DESCRIPTION_LENGTH,
  sizedAmount,
  sizeOf,
  SIZES,
  type Confidence,
  type EstimateItem
} from "@/domain/textEstimate";
import { estimateText, saveTextEntries, saveTextLineAsFood } from "../(app)/add/text/actions";
import { EntrySheet, type SheetTarget } from "./EntrySheet";
import { TrashIcon } from "./icons";
import { diaryHref } from "./links";
import { MealPicker } from "./MealPicker";
import { PageHeader } from "./PageHeader";
import { decimalText } from "./QuantityPicker";

/** A line under review: the AI's estimate plus what the user changed. */
type Line = Omit<EstimateItem, "amount" | "kcal"> & {
  key: number;
  /** The AI's amount, which the sizes scale. */
  baseAmount: number;
  amountText: string;
  savedAsFood: boolean;
};

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: "bg-emerald-50 text-emerald-800",
  medium: "bg-sky-50 text-sky-800",
  low: "bg-amber-50 text-amber-900"
};

const EXAMPLES = "Ej.: 50 g de avena con 200 ml de leche semidesnatada y un plátano";

export function TextScreen({ day, today, meal }: { day: string; today: string; meal: Meal }) {
  const router = useRouter();
  const nextKey = useRef(0);
  const [description, setDescription] = useState("");
  const [more, setMore] = useState("");
  const [lines, setLines] = useState<Line[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEstimating, startEstimate] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [quickTarget, setQuickTarget] = useState<SheetTarget | null>(null);
  const [quickCount, setQuickCount] = useState(0);

  const backHref = diaryHref(day, today);

  function toLines(items: EstimateItem[]): Line[] {
    return items.map(({ amount, kcal: _kcal, ...item }) => ({
      ...item,
      key: nextKey.current++,
      baseAmount: amount,
      amountText: decimalText(amount),
      savedAsFood: false
    }));
  }

  function estimate(text: string, append: boolean) {
    setError(null);
    startEstimate(async () => {
      const result = await estimateText(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const added = toLines(result.items);
      setLines((current) => (append && current ? [...current, ...added] : added));
      if (append) setMore("");
    });
  }

  function updateLine(key: number, change: Partial<Line>) {
    setLines((current) =>
      current ? current.map((line) => (line.key === key ? { ...line, ...change } : line)) : current
    );
    setError(null);
  }

  const kcalOf = (line: Line) => {
    const amount = parseDecimal(line.amountText);
    return amount === null ? null : kcalFor(line.kcalPer100, amount);
  };
  const total = (lines ?? []).reduce((sum, line) => sum + (kcalOf(line) ?? 0), 0);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines) return;
    const selected = new FormData(event.currentTarget).get("meal");
    startSaving(async () => {
      const result = await saveTextEntries({
        day,
        meal: typeof selected === "string" ? selected : "",
        lines: lines.map(({ name, amountText, unit, kcalPer100, foodId }) => ({
          name,
          amount: amountText,
          unit,
          kcalPer100,
          foodId
        }))
      });
      if (result) setError(result.error);
      else router.push(backHref);
    });
  }

  const errorBox = error ? (
    <div
      className="grid gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      role="alert"
    >
      <p className="font-semibold">{error}</p>
      <button
        className="min-h-10 justify-self-start font-semibold underline"
        onClick={() => {
          setQuickTarget({ kind: "new", meal });
          setQuickCount((count) => count + 1);
        }}
        type="button"
      >
        Apuntarlo a mano
      </button>
    </div>
  ) : null;

  return (
    <>
      <PageHeader
        backHref={backHref}
        backLabel="Volver al diario"
        subtitle={`${formatRelativeDay(day, today)} · ${mealLabel(meal)}`}
        title="Describir comida"
      />

      {lines === null ? (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            estimate(description, false);
          }}
        >
          <label className="field-label">
            ¿Qué has comido?
            <textarea
              autoFocus
              className="field-input h-auto min-h-32 py-3 leading-6"
              maxLength={MAX_DESCRIPTION_LENGTH}
              onChange={(event) => {
                setDescription(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={EXAMPLES}
              rows={4}
              value={description}
            />
          </label>
          <p className="text-sm leading-6 text-muted">
            Con cantidades si las sabes. Puedes dictarlo con el micrófono del teclado. Si
            nombras algo de tus alimentos («mi pan de molde»), se usan sus datos.
          </p>
          {errorBox}
          <button
            className="primary-button w-full"
            disabled={isEstimating || description.trim().length < 2}
            type="submit"
          >
            {isEstimating ? "Calculando..." : "Calcular calorías"}
          </button>
        </form>
      ) : (
        <form className="grid gap-4" noValidate onSubmit={onSubmit}>
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-sm leading-6 text-muted">«{description.trim()}»</p>
            <button
              className="-mr-2 h-10 shrink-0 px-2 text-sm font-semibold text-accent"
              onClick={() => {
                setLines(null);
                setError(null);
              }}
              type="button"
            >
              Cambiar
            </button>
          </div>

          {lines.length > 0 ? (
            <ul className="grid gap-3">
              {lines.map((line) => (
                <ReviewLine
                  key={line.key}
                  kcal={kcalOf(line)}
                  line={line}
                  onChange={(change) => updateLine(line.key, change)}
                  onRemove={() =>
                    setLines((current) => current?.filter(({ key }) => key !== line.key) ?? null)
                  }
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-muted">
              Has quitado todas las líneas.
            </p>
          )}

          <div className="grid gap-2">
            <label className="field-label" htmlFor="text-more">
              ¿Algo más?
            </label>
            <div className="flex gap-2">
              <input
                autoComplete="off"
                className="field-input flex-1"
                enterKeyHint="send"
                id="text-more"
                maxLength={MAX_DESCRIPTION_LENGTH}
                onChange={(event) => setMore(event.target.value)}
                onKeyDown={(event) => {
                  // Enter would submit the whole form instead.
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (more.trim().length >= 2) estimate(more, true);
                  }
                }}
                placeholder="Ej.: un café con leche"
                type="text"
                value={more}
              />
              <button
                className="secondary-button shrink-0"
                disabled={isEstimating || more.trim().length < 2}
                onClick={() => estimate(more, true)}
                type="button"
              >
                {isEstimating ? "..." : "Añadir"}
              </button>
            </div>
          </div>

          <MealPicker defaultMeal={meal} />

          {errorBox}

          <button
            className="primary-button w-full"
            disabled={isSaving || isEstimating || lines.length === 0}
            type="submit"
          >
            {isSaving ? "Guardando..." : `Añadir al diario · ${formatKcal(total)} kcal`}
          </button>
        </form>
      )}

      <EntrySheet
        day={day}
        key={`quick-${quickCount}`}
        onClose={() => setQuickTarget(null)}
        onSaved={() => router.push(backHref)}
        target={quickTarget}
      />
    </>
  );
}

function ReviewLine({
  line,
  kcal,
  onChange,
  onRemove
}: {
  line: Line;
  kcal: number | null;
  onChange: (change: Partial<Line>) => void;
  onRemove: () => void;
}) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const amount = parseDecimal(line.amountText);
  const size = amount === null ? null : sizeOf(line.baseAmount, amount);
  const confidence = CONFIDENCE_LEVELS.find(({ id }) => id === line.confidence)!;

  function saveAsFood() {
    setSaveError(null);
    startSaving(async () => {
      const result = await saveTextLineAsFood({
        name: line.name,
        unit: line.unit,
        kcalPer100: line.kcalPer100,
        amount: amount ?? line.baseAmount
      });
      if ("error" in result) setSaveError(result.error);
      else onChange({ foodId: result.id, savedAsFood: true });
    });
  }

  return (
    <li
      className={`grid gap-3 rounded-lg border bg-white p-3 ${
        line.cookingOil ? "border-amber-200" : "border-line"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="font-semibold leading-tight text-ink">{line.name}</p>
          {line.assumption ? (
            <p className="text-sm leading-5 text-muted">{line.assumption}</p>
          ) : null}
          <p className="flex flex-wrap gap-1 text-xs font-medium">
            {line.foodId && !line.savedAsFood ? (
              <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">De tus alimentos</span>
            ) : (
              <span className={`rounded px-1.5 py-0.5 ${CONFIDENCE_STYLES[line.confidence]}`}>
                {confidence.label}
              </span>
            )}
            {line.cookingOil ? (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">
                Aceite de cocinado
              </span>
            ) : null}
          </p>
        </div>
        <p className="pt-0.5 text-right text-lg font-semibold tabular-nums text-ink">
          {kcal === null ? "—" : formatKcal(kcal)}
          <span className="ml-1 text-sm font-medium text-muted">kcal</span>
        </p>
        <button
          aria-label={`Quitar ${line.name}`}
          className="-mr-2 -mt-2 grid h-12 w-12 shrink-0 place-items-center rounded-lg text-muted active:bg-line/50"
          onClick={onRemove}
          type="button"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="flex gap-2">
        <label className="relative w-24 shrink-0">
          <span className="sr-only">Cantidad de {line.name}</span>
          <input
            autoComplete="off"
            className="field-input pr-9 text-right font-semibold tabular-nums"
            enterKeyHint="done"
            inputMode="decimal"
            onChange={(event) => onChange({ amountText: event.target.value })}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            type="text"
            value={line.amountText}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base text-muted">
            {line.unit}
          </span>
        </label>
        <div
          aria-label={`Tamaño de ${line.name}`}
          className="flex h-12 flex-1 overflow-hidden rounded-lg border border-line"
          role="radiogroup"
        >
          {SIZES.map(({ id, label }) => (
            <button
              aria-checked={size === id}
              className={`flex-1 border-l border-line text-sm font-medium first:border-l-0 ${
                size === id ? "bg-accent text-white" : "bg-white text-ink active:bg-line/40"
              }`}
              key={id}
              onClick={() =>
                onChange({ amountText: decimalText(sizedAmount(line.baseAmount, id)) })
              }
              role="radio"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-10 items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          {formatAmount(line.kcalPer100)} kcal/100 {line.unit}
        </span>
        {line.savedAsFood ? (
          <span className="font-medium text-accent">Guardado en tus alimentos</span>
        ) : line.foodId ? null : (
          <button
            className="-mr-1 min-h-10 px-1 font-semibold text-accent disabled:opacity-60"
            disabled={isSaving}
            onClick={saveAsFood}
            type="button"
          >
            {isSaving ? "Guardando..." : "Guardar en mis alimentos"}
          </button>
        )}
      </div>
      {saveError ? (
        <p className="text-sm font-semibold text-red-700" role="alert">
          {saveError}
        </p>
      ) : null}
    </li>
  );
}
