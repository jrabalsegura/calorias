"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatRelativeDay } from "@/domain/day";
import type { FoodFormValues } from "@/domain/food";
import { labelFormValues, scaledSize, type LabelReading } from "@/domain/label";
import { mealLabel, type Meal } from "@/domain/meals";
import type { LibraryFood } from "@/lib/foods";
import { readLabel } from "../(app)/add/label/actions";
import type { ScannedProductData } from "../(app)/foods/actions";
import { FoodEntrySheet } from "./FoodEntrySheet";
import { FoodForm } from "./FoodForm";
import { CameraIcon } from "./icons";
import { addHref, diaryHref, labelHref } from "./links";
import { PageHeader } from "./PageHeader";

type View =
  | { kind: "photo"; error: string | null }
  | { kind: "reading" }
  /** `reading` is null when the user writes the label by hand. */
  | { kind: "review"; reading: LabelReading | null };

/**
 * Reduces the photo on the phone (about 1.500 px, JPEG) so it travels
 * light; browsers already apply the EXIF orientation when drawing it.
 */
async function shrinkPhoto(file: File): Promise<{ data: string; mediaType: "image/jpeg" }> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const { width, height } = scaledSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D canvas");
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Takes (or picks) a photo of the nutrition label, has the AI read it and
 * opens the food form with the values to review. Saved, the food opens with
 * the quantity picker; it keeps the barcode it was opened from.
 */
export function LabelScreen({
  day,
  today,
  meal,
  barcode,
  initialFood
}: {
  day: string;
  today: string;
  meal: Meal;
  /** The barcode of a product that was not found, to save the food with. */
  barcode: string | null;
  /** The food just created from here, to log it. */
  initialFood: LibraryFood | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "photo", error: null });
  const [preview, setPreview] = useState<string | null>(null);
  const [readCount, setReadCount] = useState(0);
  // Closing the sheet after adding must not navigate twice.
  const savedRef = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const subtitle = `${formatRelativeDay(day, today)} · ${mealLabel(meal)}`;
  const backHref = addHref(day, meal);

  function onPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setView({ kind: "reading" });
    startTransition(async () => {
      let image;
      try {
        image = await shrinkPhoto(file);
      } catch {
        setView({ kind: "photo", error: "No se ha podido abrir la foto. Prueba con otra." });
        return;
      }
      const result = await readLabel(image).catch(() => ({
        ok: false as const,
        error: "No se pudo enviar la foto. Comprueba la conexión."
      }));
      setReadCount((count) => count + 1);
      setView(result.ok ? { kind: "review", reading: result.reading } : { kind: "photo", error: result.error });
    });
  }

  if (initialFood) {
    return (
      <>
        <PageHeader backHref={backHref} backLabel="Volver a Añadir" subtitle={subtitle} title="Etiqueta" />
        <p className="rounded-lg border border-line bg-white px-4 py-6 text-center text-sm text-muted">
          «{initialFood.name}» está guardado en tus alimentos
          {initialFood.barcode ? " con su código de barras" : ""}.
        </p>
        <FoodEntrySheet
          day={day}
          onClose={() => {
            if (!savedRef.current) router.push(backHref);
          }}
          onSaved={() => {
            savedRef.current = true;
            router.push(diaryHref(day, today));
          }}
          source="label"
          target={{ kind: "new", food: initialFood, meal }}
        />
      </>
    );
  }

  if (view.kind === "review") {
    const { reading } = view;
    const scanned: ScannedProductData | undefined = reading
      ? {
          barcode,
          fromLabel: true,
          proteinPer100: reading.proteinPer100,
          carbsPer100: reading.carbsPer100,
          fatPer100: reading.fatPer100
        }
      : barcode
        ? { barcode }
        : undefined;
    const values: FoodFormValues | undefined = reading ? labelFormValues(reading) : undefined;

    return (
      <>
        <PageHeader backHref={backHref} backLabel="Volver a Añadir" subtitle={subtitle} title="Revisar etiqueta" />
        <section className="flex items-start gap-3 rounded-lg border border-line bg-white p-4">
          {preview && reading ? (
            <img
              alt="Foto de la etiqueta"
              className="h-20 w-20 shrink-0 rounded-lg border border-line object-cover"
              src={preview}
            />
          ) : null}
          <div className="grid gap-1 text-sm leading-6">
            <p className="font-semibold text-ink">
              {reading
                ? "Comprueba los valores con la etiqueta antes de guardarlo."
                : "Escribe los datos de la etiqueta."}
            </p>
            {reading?.warnings.map((warning) => (
              <p className="text-amber-900" key={warning}>
                {warning}
              </p>
            ))}
          </div>
        </section>
        <FoodForm
          food={null}
          initialName=""
          initialValues={values}
          key={readCount}
          next={labelHref(day, meal)}
          scanned={scanned}
        />
        <button
          className="secondary-button w-full"
          onClick={() => setView({ kind: "photo", error: null })}
          type="button"
        >
          Hacer otra foto
        </button>
      </>
    );
  }

  const reading = view.kind === "reading";

  return (
    <>
      <PageHeader backHref={backHref} backLabel="Volver a Añadir" subtitle={subtitle} title="Foto de la etiqueta" />

      {reading ? (
        <div
          className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border border-line bg-white"
          role="status"
        >
          {preview ? (
            <img alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" src={preview} />
          ) : null}
          <p className="relative px-4 text-center text-sm font-semibold text-ink">Leyendo la etiqueta...</p>
        </div>
      ) : (
        <section className="grid gap-3 rounded-lg border border-line bg-white p-4 text-sm leading-6 text-muted">
          <p>
            Haz una foto de la <span className="font-semibold text-ink">tabla nutricional</span>, de
            frente y con buena luz. Si se ve el nombre del producto, mejor. La foto no se guarda.
          </p>
          {barcode ? (
            <p>
              Se guardará con el código <span className="tabular-nums text-ink">{barcode}</span>.
            </p>
          ) : null}
        </section>
      )}

      {view.kind === "photo" && view.error ? (
        <div
          className="grid gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          role="alert"
        >
          <p>{view.error}</p>
          <button
            className="min-h-10 text-left underline"
            onClick={() => setView({ kind: "review", reading: null })}
            type="button"
          >
            Escribirlo a mano
          </button>
        </div>
      ) : null}

      <label className={`primary-button w-full gap-2 ${reading ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
        <CameraIcon />
        Hacer la foto
        <input
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={reading}
          onChange={onPhoto}
          type="file"
        />
      </label>
      <label className={`secondary-button w-full ${reading ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
        Elegir de la galería
        <input accept="image/*" className="sr-only" disabled={reading} onChange={onPhoto} type="file" />
      </label>
    </>
  );
}
