"use client";

import { formatKcal } from "@/domain/diary";
import {
  amountInBaseUnit,
  formatAmount,
  kcalForQuantity,
  type FoodForQuantity
} from "@/domain/food";
import { parseDecimal } from "@/domain/target";

/** What the picker edits: the quantity as typed and the unit (base unit or portion). */
export type QuantityValue = { quantity: string; unit: string };

export const decimalText = (value: number) => String(value).replace(".", ",");

/**
 * Quantity in g/ml or in portions, with the kcal worked out as you type.
 * Shared by every way of logging a food (library, barcode, text, label).
 */
export function QuantityPicker({
  food,
  value,
  onChange
}: {
  food: FoodForQuantity;
  value: QuantityValue;
  onChange: (value: QuantityValue) => void;
}) {
  const quantity = parseDecimal(value.quantity);
  const kcal =
    quantity === null ? null : kcalForQuantity(food, { quantity, unit: value.unit });
  const amount =
    quantity === null ? null : amountInBaseUnit(food, { quantity, unit: value.unit });
  const isPortion = value.unit !== food.baseUnit;

  const units = [
    { id: food.baseUnit, label: food.baseUnit, detail: null },
    ...food.portions.map(({ name, amount: portionAmount }) => ({
      id: name,
      label: name,
      detail: `${formatAmount(portionAmount)} ${food.baseUnit}`
    }))
  ];

  function changeUnit(unit: string) {
    if (unit === value.unit) return;
    // Going to g/ml keeps the same amount; going to a portion starts at 1.
    if (unit === food.baseUnit && amount !== null) {
      onChange({ quantity: decimalText(Math.round(amount * 10) / 10), unit });
    } else {
      onChange({ quantity: "1", unit });
    }
  }

  return (
    <div className="grid gap-3">
      <label className="field-label">
        Cantidad
        <span className="relative">
          <input
            autoComplete="off"
            className="field-input pr-28 text-right text-xl font-semibold tabular-nums"
            enterKeyHint="done"
            inputMode="decimal"
            name="quantity"
            onChange={(event) => onChange({ ...value, quantity: event.target.value })}
            onFocus={(event) => event.target.select()}
            placeholder="0"
            type="text"
            value={value.quantity}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex w-24 items-center justify-end truncate text-base text-muted">
            {isPortion ? `× ${value.unit}` : value.unit}
          </span>
        </span>
      </label>

      {units.length > 1 ? (
        <div aria-label="Unidad" className="flex flex-wrap gap-2" role="radiogroup">
          {units.map(({ id, label, detail }) => {
            const selected = id === value.unit;
            return (
              <button
                aria-checked={selected}
                className={`flex h-12 min-w-16 flex-col items-center justify-center rounded-lg border px-3 text-sm font-medium leading-tight ${
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-white text-ink active:bg-line/40"
                }`}
                key={id}
                onClick={() => changeUnit(id)}
                role="radio"
                type="button"
              >
                {label}
                {detail ? (
                  <span className={`text-xs ${selected ? "text-white/80" : "text-muted"}`}>
                    {detail}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <p aria-live="polite" className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted">
          {isPortion && amount !== null
            ? `${formatAmount(Math.round(amount * 10) / 10)} ${food.baseUnit} · `
            : ""}
          {formatAmount(food.kcalPer100)} kcal/100 {food.baseUnit}
        </span>
        <span className="text-2xl font-semibold tabular-nums text-ink">
          {kcal === null ? "—" : formatKcal(kcal)}{" "}
          <span className="text-base font-medium text-muted">kcal</span>
        </span>
      </p>
    </div>
  );
}
