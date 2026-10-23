"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatRelativeDay } from "@/domain/day";
import { MAX_HINT_LENGTH } from "@/domain/mealPhoto";
import { mealLabel, type Meal } from "@/domain/meals";
import type { EstimateItem } from "@/domain/textEstimate";
import { estimatePhoto } from "../(app)/add/photo/actions";
import { EntrySheet, type SheetTarget } from "./EntrySheet";
import { AiErrorBox, EstimateReview, ManualButton } from "./EstimateReview";
import { addHref, diaryHref, textHref } from "./links";
import { PageHeader } from "./PageHeader";
import { PhotoButtons, shrinkPhoto } from "./PhotoButtons";

type View =
  | { kind: "photo"; error: string | null }
  | { kind: "estimating" }
  | { kind: "review"; items: EstimateItem[]; count: number };

/**
 * Takes (or picks) a photo of the meal, with an optional note, has the AI
 * recognise and estimate it and opens the same review as a description.
 */
export function PhotoScreen({ day, today, meal }: { day: string; today: string; meal: Meal }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "photo", error: null });
  const [hint, setHint] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [estimateCount, setEstimateCount] = useState(0);
  const [, startTransition] = useTransition();
  const [quickTarget, setQuickTarget] = useState<SheetTarget | null>(null);
  const [quickCount, setQuickCount] = useState(0);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const subtitle = `${formatRelativeDay(day, today)} · ${mealLabel(meal)}`;
  const backHref = addHref(day, meal);

  function openManual() {
    setQuickTarget({ kind: "new", meal });
    setQuickCount((count) => count + 1);
  }

  function onPhoto(file: File) {
    setPreview(URL.createObjectURL(file));
    setView({ kind: "estimating" });
    startTransition(async () => {
      let image;
      try {
        image = await shrinkPhoto(file);
      } catch {
        setView({ kind: "photo", error: "No se ha podido abrir la foto. Prueba con otra." });
        return;
      }
      const result = await estimatePhoto(image, hint).catch(() => ({
        ok: false as const,
        error: "No se pudo enviar la foto. Comprueba la conexión."
      }));
      if (!result.ok) {
        setView({ kind: "photo", error: result.error });
        return;
      }
      setView({ kind: "review", items: result.items, count: estimateCount + 1 });
      setEstimateCount((count) => count + 1);
    });
  }

  const header = (
    <PageHeader
      backHref={backHref}
      backLabel="Volver a Añadir"
      subtitle={subtitle}
      title={view.kind === "review" ? "Revisar plato" : "Foto del plato"}
    />
  );
  const manualSheet = (
    <EntrySheet
      day={day}
      key={`quick-${quickCount}`}
      onClose={() => setQuickTarget(null)}
      onSaved={() => router.push(diaryHref(day, today))}
      target={quickTarget}
    />
  );

  if (view.kind === "review") {
    return (
      <>
        {header}
        <EstimateReview
          day={day}
          items={view.items}
          key={view.count}
          meal={meal}
          onManual={openManual}
          onSaved={() => router.push(diaryHref(day, today))}
          source="photo"
          summary={
            <section className="flex items-start gap-3 rounded-lg border border-line bg-white p-3">
              {preview ? (
                <img
                  alt="Foto del plato"
                  className="h-20 w-20 shrink-0 rounded-lg border border-line object-cover"
                  src={preview}
                />
              ) : null}
              <div className="grid min-w-0 flex-1 gap-1 text-sm leading-6">
                <p className="font-semibold text-ink">
                  Es una estimación aproximada: revisa las cantidades.
                </p>
                {hint.trim() ? <p className="text-muted">«{hint.trim()}»</p> : null}
                <button
                  className="-ml-1 min-h-10 justify-self-start px-1 font-semibold text-accent"
                  onClick={() => setView({ kind: "photo", error: null })}
                  type="button"
                >
                  Hacer otra foto
                </button>
              </div>
            </section>
          }
        />
        {manualSheet}
      </>
    );
  }

  const estimating = view.kind === "estimating";

  return (
    <>
      {header}

      {estimating ? (
        <div
          className="relative grid aspect-4/3 place-items-center overflow-hidden rounded-lg border border-line bg-white"
          role="status"
        >
          {preview ? (
            <img alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" src={preview} />
          ) : null}
          <p className="relative px-4 text-center text-sm font-semibold text-ink">Mirando el plato...</p>
        </div>
      ) : (
        <section className="grid gap-3 rounded-lg border border-line bg-white p-4 text-sm leading-6 text-muted">
          <p>
            Haz una foto de <span className="font-semibold text-ink">lo que vas a comer</span>,
            desde arriba y con todo el plato a la vista. La IA reconoce los alimentos y estima
            las cantidades; luego las revisas. La foto no se guarda.
          </p>
        </section>
      )}

      <label className="field-label">
        Nota (opcional)
        <input
          autoComplete="off"
          className="field-input"
          disabled={estimating}
          enterKeyHint="done"
          maxLength={MAX_HINT_LENGTH}
          onChange={(event) => setHint(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          placeholder="Ej.: media ración, sin la salsa"
          type="text"
          value={hint}
        />
      </label>

      {view.kind === "photo" && view.error ? (
        <AiErrorBox error={view.error}>
          <Link className="grid min-h-10 content-center justify-self-start font-semibold underline" href={textHref(day, meal)}>
            Describirlo con texto
          </Link>
          <ManualButton onClick={openManual}>Apuntarlo a mano</ManualButton>
        </AiErrorBox>
      ) : null}

      <PhotoButtons disabled={estimating} onPhoto={onPhoto} />
      {manualSheet}
    </>
  );
}
