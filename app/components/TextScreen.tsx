"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatRelativeDay } from "@/domain/day";
import { mealLabel, type Meal } from "@/domain/meals";
import { MAX_DESCRIPTION_LENGTH, type EstimateItem } from "@/domain/textEstimate";
import { estimateText } from "../(app)/add/text/actions";
import { EntrySheet, type SheetTarget } from "./EntrySheet";
import { AiErrorBox, EstimateReview, ManualButton } from "./EstimateReview";
import { diaryHref } from "./links";
import { PageHeader } from "./PageHeader";

const EXAMPLES = "Ej.: 50 g de avena con 200 ml de leche semidesnatada y un plátano";

export function TextScreen({ day, today, meal }: { day: string; today: string; meal: Meal }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [estimate, setEstimate] = useState<{ items: EstimateItem[]; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEstimating, startEstimate] = useTransition();
  const [quickTarget, setQuickTarget] = useState<SheetTarget | null>(null);
  const [quickCount, setQuickCount] = useState(0);

  const backHref = diaryHref(day, today);

  function openManual() {
    setQuickTarget({ kind: "new", meal });
    setQuickCount((count) => count + 1);
  }

  function onEstimate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startEstimate(async () => {
      const result = await estimateText(description);
      if (!result.ok) setError(result.error);
      else setEstimate((current) => ({ items: result.items, count: (current?.count ?? 0) + 1 }));
    });
  }

  return (
    <>
      <PageHeader
        backHref={backHref}
        backLabel="Volver al diario"
        subtitle={`${formatRelativeDay(day, today)} · ${mealLabel(meal)}`}
        title="Describir comida"
      />

      {estimate === null ? (
        <form className="grid gap-3" onSubmit={onEstimate}>
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
          {error ? (
            <AiErrorBox error={error}>
              <ManualButton onClick={openManual}>Apuntarlo a mano</ManualButton>
            </AiErrorBox>
          ) : null}
          <button
            className="primary-button w-full"
            disabled={isEstimating || description.trim().length < 2}
            type="submit"
          >
            {isEstimating ? "Calculando..." : "Calcular calorías"}
          </button>
        </form>
      ) : (
        <EstimateReview
          day={day}
          items={estimate.items}
          key={estimate.count}
          meal={meal}
          onManual={openManual}
          onSaved={() => router.push(backHref)}
          source="text"
          summary={
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm leading-6 text-muted">«{description.trim()}»</p>
              <button
                className="-mr-2 h-10 shrink-0 px-2 text-sm font-semibold text-accent"
                onClick={() => {
                  setEstimate(null);
                  setError(null);
                }}
                type="button"
              >
                Cambiar
              </button>
            </div>
          }
        />
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
