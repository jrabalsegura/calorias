"use client";

import { useRef, useState, useTransition } from "react";
import { formatKcal } from "@/domain/diary";
import { formatAmount } from "@/domain/food";
import type { Meal } from "@/domain/meals";
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
import { TrashIcon } from "./icons";
import { MealPicker } from "./MealPicker";
import { decimalText } from "./QuantityPicker";

/** A line under review: the AI's estimate plus what the user changed. */
type Line = Omit<EstimateItem, "amount" | "kcal"> & {
  key: number;
  /** The AI's amount, which the sizes scale. */
  baseAmount: number;
  amountText: string;
  savedAsFood: boolean;
};

type Source = "text" | "photo";

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  high: "bg-emerald-50 text-emerald-800",
  medium: "bg-sky-50 text-sky-800",
  low: "bg-amber-50 text-amber-900"
};

/** An AI failure, with the way out of writing it by hand. */
export function AiErrorBox({ error, children }: { error: string; children: React.ReactNode }) {
  return (
    <div
      className="grid gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      role="alert"
    >
      <p className="font-semibold">{error}</p>
      {children}
    </div>
  );
}

export function ManualButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="min-h-10 justify-self-start font-semibold underline" onClick={onClick} type="button">
      {children}
    </button>
  );
}

/**
 * The review of an AI breakdown (of a description or a photo): amounts and
 * sizes, removing lines, «¿Algo más?», the meal and adding it to the diary.
 */
export function EstimateReview({
  day,
  meal,
  source,
  items,
  summary,
  onManual,
  onSaved
}: {
  day: string;
  meal: Meal;
  source: Source;
  items: EstimateItem[];
  /** What was estimated, with the way back to change it. */
  summary: React.ReactNode;
  onManual: () => void;
  onSaved: () => void;
}) {
  const nextKey = useRef(0);
  const [lines, setLines] = useState<Line[]>(() => toLines(items));
  const [more, setMore] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isEstimating, startEstimate] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function toLines(estimated: EstimateItem[]): Line[] {
    return estimated.map(({ amount, kcal: _kcal, ...item }) => ({
      ...item,
      key: nextKey.current++,
      baseAmount: amount,
      amountText: decimalText(amount),
      savedAsFood: false
    }));
  }

  function addMore() {
    setError(null);
    startEstimate(async () => {
      const result = await estimateText(more);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const added = toLines(result.items);
      setLines((current) => [...current, ...added]);
      setMore("");
    });
  }

  function updateLine(key: number, change: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)));
    setError(null);
  }

  const kcalOf = (line: Line) => {
    const amount = parseDecimal(line.amountText);
    return amount === null ? null : kcalFor(line.kcalPer100, amount);
  };
  const total = lines.reduce((sum, line) => sum + (kcalOf(line) ?? 0), 0);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = new FormData(event.currentTarget).get("meal");
    startSaving(async () => {
      const result = await saveTextEntries({
        day,
        meal: typeof selected === "string" ? selected : "",
        source,
        lines: lines.map(({ name, amountText, unit, kcalPer100, foodId }) => ({
          name,
          amount: amountText,
          unit,
          kcalPer100,
          foodId
        }))
      });
      if (result) setError(result.error);
      else onSaved();
    });
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={onSubmit}>
      {summary}

      {lines.length > 0 ? (
        <ul className="grid gap-3">
          {lines.map((line) => (
            <ReviewLine
              key={line.key}
              kcal={kcalOf(line)}
              line={line}
              onChange={(change) => updateLine(line.key, change)}
              onRemove={() => setLines((current) => current.filter(({ key }) => key !== line.key))}
              source={source}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-muted">
          Has quitado todas las líneas.
        </p>
      )}

      <div className="grid gap-2">
        <label className="field-label" htmlFor="estimate-more">
          ¿Algo más?
        </label>
        <div className="flex gap-2">
          <input
            autoComplete="off"
            className="field-input flex-1"
            enterKeyHint="send"
            id="estimate-more"
            maxLength={MAX_DESCRIPTION_LENGTH}
            onChange={(event) => setMore(event.target.value)}
            onKeyDown={(event) => {
              // Enter would submit the whole form instead.
              if (event.key === "Enter") {
                event.preventDefault();
                if (more.trim().length >= 2) addMore();
              }
            }}
            placeholder="Ej.: un café con leche"
            type="text"
            value={more}
          />
          <button
            className="secondary-button shrink-0"
            disabled={isEstimating || more.trim().length < 2}
            onClick={addMore}
            type="button"
          >
            {isEstimating ? "..." : "Añadir"}
          </button>
        </div>
      </div>

      <MealPicker defaultMeal={meal} />

      {error ? (
        <AiErrorBox error={error}>
          <ManualButton onClick={onManual}>Apuntarlo a mano</ManualButton>
        </AiErrorBox>
      ) : null}

      <button
        className="primary-button w-full"
        disabled={isSaving || isEstimating || lines.length === 0}
        type="submit"
      >
        {isSaving ? "Guardando..." : `Añadir al diario · ${formatKcal(total)} kcal`}
      </button>
    </form>
  );
}

function ReviewLine({
  line,
  kcal,
  onChange,
  onRemove,
  source
}: {
  line: Line;
  kcal: number | null;
  onChange: (change: Partial<Line>) => void;
  onRemove: () => void;
  source: Source;
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
        amount: amount ?? line.baseAmount,
        source
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
              <span className="rounded-sm bg-accent/10 px-1.5 py-0.5 text-accent">De tus alimentos</span>
            ) : (
              <span className={`rounded-sm px-1.5 py-0.5 ${CONFIDENCE_STYLES[line.confidence]}`}>
                {confidence.label}
              </span>
            )}
            {line.cookingOil ? (
              <span className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-amber-900">
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
