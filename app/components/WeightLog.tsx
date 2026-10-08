"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { formatShortDay, formatRelativeDay } from "@/domain/day";
import { formatKg } from "@/domain/target";
import type { WeighIn } from "@/domain/weight";
import { deleteWeight, saveWeight } from "../(app)/weight/actions";

const HISTORY_PREVIEW = 30;

const decimal = (kg: number) => String(kg).replace(".", ",");

/**
 * Quick weigh-in form for today (or another day) and the history, newest
 * first. `children` (progress and chart) go between the two.
 */
export function WeightLog({
  weighIns,
  today,
  children
}: {
  weighIns: WeighIn[];
  today: string;
  children?: React.ReactNode;
}) {
  const byDay = new Map(weighIns.map(({ day, kg }) => [day, kg]));
  const [day, setDay] = useState(today);
  const [kg, setKg] = useState(() => {
    const saved = byDay.get(today);
    return saved === undefined ? "" : decimal(saved);
  });
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<WeighIn | null>(null);

  const existing = byDay.get(day);
  const history = [...weighIns].reverse();
  const visible = showAll ? history : history.slice(0, HISTORY_PREVIEW);

  function changeDay(next: string) {
    setDay(next);
    const saved = byDay.get(next);
    setKg(saved === undefined ? "" : decimal(saved));
    setMessage(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSaving(async () => {
      const result = await saveWeight({ day, kg });
      setMessage(
        result
          ? { text: result.error, error: true }
          : {
              text: `Guardado: ${kg.trim()} kg (${formatRelativeDay(day, today).toLowerCase()}).`,
              error: false
            }
      );
    });
  }

  return (
    <>
      <form
        aria-label="Apuntar peso"
        className="grid gap-3 rounded-lg border border-line bg-white p-4"
        noValidate
        onSubmit={onSubmit}
      >
        <div className="flex items-end gap-2">
          <label className="field-label flex-1">
            {day === today ? "Peso de hoy" : `Peso del ${formatShortDay(day, today)}`}
            <span className="relative">
              <input
                autoComplete="off"
                className="field-input pr-12 text-right text-xl font-semibold tabular-nums"
                enterKeyHint="done"
                inputMode="decimal"
                name="kg"
                onChange={(event) => {
                  setKg(event.target.value);
                  setMessage(null);
                }}
                placeholder="0,0"
                type="text"
                value={kg}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-base text-muted">
                kg
              </span>
            </span>
          </label>
          <button className="primary-button min-w-28" disabled={isSaving} type="submit">
            {isSaving
              ? "Guardando..."
              : existing === undefined
                ? "Guardar"
                : "Actualizar"}
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          Día
          <input
            className="field-input h-10 flex-1"
            max={today}
            name="day"
            onChange={(event) => changeDay(event.target.value || today)}
            type="date"
            value={day}
          />
        </label>

        {message ? (
          <p
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              message.error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-accent/30 bg-accent/10 text-accent"
            }`}
            role={message.error ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : existing !== undefined && day !== today ? (
          <p className="text-sm text-muted">
            Ese día ya tiene {formatKg(existing)} kg: al guardar se sustituye.
          </p>
        ) : null}
      </form>

      {children}

      {history.length > 0 ? (
        <section
          aria-label="Historial"
          className="overflow-hidden rounded-lg border border-line bg-white"
        >
          <h2 className="px-4 py-3 font-semibold text-ink">Historial</h2>
          <ul className="border-t border-line">
            {visible.map((weighIn) => (
              <li className="border-b border-line last:border-b-0" key={weighIn.day}>
                <button
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-line/40"
                  onClick={() => setEditing(weighIn)}
                  type="button"
                >
                  <span className="flex-1 text-ink">
                    {formatShortDay(weighIn.day, today)}
                  </span>
                  <span className="tabular-nums text-ink">{formatKg(weighIn.kg)} kg</span>
                </button>
              </li>
            ))}
          </ul>
          {history.length > HISTORY_PREVIEW ? (
            <button
              className="h-12 w-full border-t border-line text-sm font-semibold text-accent active:bg-line/40"
              onClick={() => setShowAll(!showAll)}
              type="button"
            >
              {showAll ? "Ver menos" : `Ver todos (${history.length})`}
            </button>
          ) : null}
        </section>
      ) : null}

      <WeightSheet
        key={editing?.day ?? "closed"}
        onClose={() => setEditing(null)}
        today={today}
        weighIn={editing}
      />
    </>
  );
}

/** Bottom sheet to correct or delete one weigh-in. */
function WeightSheet({
  weighIn,
  today,
  onClose
}: {
  weighIn: WeighIn | null;
  today: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kg, setKg] = useState(weighIn ? decimal(weighIn.kg) : "");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (weighIn && dialog && !dialog.open) dialog.showModal();
  }, [weighIn]);

  return (
    <dialog
      aria-labelledby="weight-sheet-title"
      className="entry-sheet"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      {weighIn ? (
        <form
          className="grid gap-4 p-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await saveWeight({ day: weighIn.day, kg });
              if (result) setError(result.error);
              else dialogRef.current?.close();
            });
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink" id="weight-sheet-title">
              {formatRelativeDay(weighIn.day, today)}
            </h2>
            <button
              aria-label="Cerrar"
              className="-mr-2 grid h-12 w-12 place-items-center rounded-lg text-muted active:bg-line/50"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <label className="field-label">
            Peso
            <span className="relative">
              <input
                autoComplete="off"
                className="field-input pr-12 text-right text-xl font-semibold tabular-nums"
                enterKeyHint="done"
                inputMode="decimal"
                name="kg"
                onChange={(event) => {
                  setKg(event.target.value);
                  setError(null);
                }}
                type="text"
                value={kg}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-base text-muted">
                kg
              </span>
            </span>
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
            Guardar cambios
          </button>
          <button
            className={`inline-flex h-12 w-full items-center justify-center rounded-lg text-base font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
              confirmingDelete
                ? "bg-red-600 text-white"
                : "border border-red-200 bg-white text-red-700"
            }`}
            disabled={isPending}
            onClick={() => {
              if (!confirmingDelete) {
                setConfirmingDelete(true);
                return;
              }
              startTransition(async () => {
                const result = await deleteWeight(weighIn.day);
                if (result) {
                  setError(result.error);
                  setConfirmingDelete(false);
                } else {
                  dialogRef.current?.close();
                }
              });
            }}
            type="button"
          >
            {confirmingDelete ? "Toca otra vez para borrar" : "Borrar"}
          </button>
        </form>
      ) : null}
    </dialog>
  );
}
