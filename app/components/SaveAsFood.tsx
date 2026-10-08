"use client";

import { useState, useTransition } from "react";
import { BASE_UNITS, ENTRY_PORTION_NAME, type BaseUnit } from "@/domain/food";
import { formatKcal } from "@/domain/diary";
import { saveEntryAsFood } from "../(app)/foods/actions";

/**
 * Turns a manual entry into a food of the library. It lives inside the entry
 * sheet's form, so it uses plain buttons instead of a form of its own.
 */
export function SaveAsFood({
  entry,
  onSaved
}: {
  entry: { id: string; name: string; kcal: number };
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [baseUnit, setBaseUnit] = useState<BaseUnit>("g");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  if (!open) {
    return (
      <button
        className="h-12 w-full text-sm font-semibold text-accent active:bg-line/40"
        onClick={() => setOpen(true)}
        type="button"
      >
        Guardar como alimento
      </button>
    );
  }

  function save() {
    startSaving(async () => {
      const result = await saveEntryAsFood({ entryId: entry.id, amount, baseUnit });
      if (result) setError(result.error);
      else onSaved();
    });
  }

  return (
    <section
      aria-label="Guardar como alimento"
      className="grid gap-3 rounded-lg border border-line bg-surface p-3"
    >
      <p className="text-sm leading-6 text-ink">
        «{entry.name}» quedará en tus alimentos como 1 {ENTRY_PORTION_NAME} de{" "}
        {formatKcal(entry.kcal)} kcal. Si sabes cuánto era, las kcal por 100 se
        calculan solas.
      </p>
      <div className="flex gap-2">
        <label className="field-label flex-1">
          <span>
            Cantidad <span className="font-normal text-muted">(opcional)</span>
          </span>
          <input
            autoComplete="off"
            className="field-input text-right tabular-nums"
            enterKeyHint="done"
            inputMode="decimal"
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              // Enter would submit the entry sheet's form instead.
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
            }}
            placeholder="Ej.: 250"
            type="text"
            value={amount}
          />
        </label>
        <fieldset className="grid content-end">
          <legend className="sr-only">Unidad</legend>
          <div className="flex h-12 overflow-hidden rounded-lg border border-line">
            {BASE_UNITS.map(({ id }) => (
              <button
                aria-pressed={baseUnit === id}
                className={`w-12 text-base font-medium ${
                  baseUnit === id ? "bg-accent text-white" : "bg-white text-ink"
                }`}
                key={id}
                onClick={() => setBaseUnit(id)}
                type="button"
              >
                {id}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button className="secondary-button w-full" disabled={isSaving} onClick={save} type="button">
        {isSaving ? "Guardando..." : "Guardar alimento"}
      </button>
    </section>
  );
}
