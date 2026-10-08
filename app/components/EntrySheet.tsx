"use client";

import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition
} from "react";
import { MAX_ENTRY_NAME_LENGTH } from "@/domain/diary";
import type { Meal } from "@/domain/meals";
import { deleteEntry, saveEntry, type EntryFormState } from "../(app)/actions";
import { CloseIcon } from "./icons";
import { MealPicker } from "./MealPicker";
import { SaveAsFood } from "./SaveAsFood";

export type SheetTarget =
  | { kind: "new"; meal: Meal }
  | {
      kind: "edit";
      entry: { id: string; meal: Meal; name: string | null; kcal: number };
    };

const INITIAL_STATE: EntryFormState = { status: "idle", message: "", savedAt: 0 };

export function EntrySheet({
  day,
  target,
  onClose,
  onSaved
}: {
  day: string;
  target: SheetTarget | null;
  onClose: () => void;
  /** Called after a successful save, once the sheet has closed. */
  onSaved?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const kcalRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isSaving] = useActionState(saveEntry, INITIAL_STATE);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  // Layout effect: it runs within the tap that opened the sheet, which iOS
  // requires before it shows the keyboard for a programmatic focus.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!target || !dialog || dialog.open) return;

    dialog.showModal();
    // A new entry goes straight to the number pad.
    if (target.kind === "new") kcalRef.current?.focus();
  }, [target]);

  useEffect(() => {
    if (state.status === "saved") {
      dialogRef.current?.close();
      onSaved?.();
    }
    // Only a new save runs this, not a new onSaved identity.
  }, [state]);

  const entry = target?.kind === "edit" ? target.entry : null;
  // After a rejected save the form shows what was sent, not the original.
  const sent = state.status === "error" ? state.values : undefined;
  const meal = sent?.meal ?? (target?.kind === "edit" ? target.entry.meal : target?.meal);

  return (
    <dialog
      aria-labelledby="entry-sheet-title"
      className="entry-sheet"
      onClick={(event) => {
        // A tap on the backdrop (the dialog box itself, outside the panel) closes it.
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      {target ? (
        <form action={formAction} className="grid gap-4 p-4">
          <input name="day" type="hidden" value={day} />
          <input name="id" type="hidden" value={entry?.id ?? ""} />

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink" id="entry-sheet-title">
              {entry ? "Editar entrada" : "Añadir entrada"}
            </h2>
            <button
              aria-label="Cerrar"
              className="-mr-2 grid h-12 w-12 place-items-center rounded-lg text-muted active:bg-line/50"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <label className="field-label">
            Calorías
            <span className="relative">
              <input
                autoComplete="off"
                className="field-input pr-14 text-right text-xl font-semibold tabular-nums"
                defaultValue={sent?.kcal ?? entry?.kcal ?? ""}
                enterKeyHint="done"
                inputMode="decimal"
                name="kcal"
                placeholder="0"
                ref={kcalRef}
                required
                type="text"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-base text-muted">
                kcal
              </span>
            </span>
          </label>

          <label className="field-label">
            <span>
              Nombre <span className="font-normal text-muted">(opcional)</span>
            </span>
            <input
              autoComplete="off"
              className="field-input"
              defaultValue={sent?.name ?? entry?.name ?? ""}
              enterKeyHint="done"
              maxLength={MAX_ENTRY_NAME_LENGTH}
              name="name"
              placeholder="Ej.: café con leche"
              type="text"
            />
          </label>

          <MealPicker defaultMeal={meal} />

          {state.status === "error" ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
              role="alert"
            >
              {state.message}
            </p>
          ) : null}

          <button className="primary-button w-full" disabled={isSaving} type="submit">
            {isSaving ? "Guardando..." : entry ? "Guardar cambios" : "Añadir"}
          </button>

          {entry ? (
            <button
              className={`inline-flex h-12 w-full items-center justify-center rounded-lg text-base font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
                confirmingDelete
                  ? "bg-red-600 text-white"
                  : "border border-red-200 bg-white text-red-700"
              }`}
              disabled={isDeleting}
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                startDelete(async () => {
                  await deleteEntry(entry.id);
                  dialogRef.current?.close();
                });
              }}
              type="button"
            >
              {isDeleting
                ? "Borrando..."
                : confirmingDelete
                  ? "Toca otra vez para borrar"
                  : "Borrar"}
            </button>
          ) : null}

          {entry?.name ? (
            <SaveAsFood
              entry={{ id: entry.id, name: entry.name, kcal: entry.kcal }}
              onSaved={() => dialogRef.current?.close()}
            />
          ) : null}
        </form>
      ) : null}
    </dialog>
  );
}
