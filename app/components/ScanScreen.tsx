"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatRelativeDay } from "@/domain/day";
import { normalizeBarcode } from "@/domain/barcode";
import type { FoodFormValues } from "@/domain/food";
import { mealLabel, type Meal } from "@/domain/meals";
import type { LibraryFood } from "@/lib/foods";
import { scanBarcode, type ScanResult } from "../(app)/add/scan/actions";
import type { ScannedProductData } from "../(app)/foods/actions";
import { BarcodeScanner } from "./BarcodeScanner";
import { FoodEntrySheet } from "./FoodEntrySheet";
import { FoodForm } from "./FoodForm";
import { CameraIcon } from "./icons";
import { addHref, diaryHref, labelHref, scanHref } from "./links";
import { PageHeader } from "./PageHeader";

/** A product to create by hand, with whatever is known of it. */
type ManualProduct = {
  reason: string;
  values?: FoodFormValues;
  scanned: ScannedProductData;
  imageUrl: string | null;
  warnings: string[];
};

type View =
  | { kind: "scan"; error: string | null }
  | { kind: "food"; food: LibraryFood; warnings: string[] }
  | { kind: "manual"; product: ManualProduct };

function viewFor(result: ScanResult): View {
  switch (result.kind) {
    case "food":
      return result;
    case "incomplete": {
      const { product, values } = result;
      return {
        kind: "manual",
        product: {
          reason: "Está en Open Food Facts, pero le faltan datos.",
          values,
          scanned: {
            barcode: product.barcode,
            imageUrl: product.imageUrl,
            proteinPer100: product.proteinPer100,
            carbsPer100: product.carbsPer100,
            fatPer100: product.fatPer100
          },
          imageUrl: product.imageUrl,
          warnings: product.warnings
        }
      };
    }
    case "notFound":
      return {
        kind: "manual",
        product: {
          reason: "No está en Open Food Facts. Haz una foto de la etiqueta o créalo a mano.",
          scanned: { barcode: result.barcode },
          imageUrl: null,
          warnings: []
        }
      };
    case "error":
      return { kind: "scan", error: result.error };
  }
}

/**
 * Scans a barcode (or takes it typed), finds the product in the library or
 * in Open Food Facts and opens it with the quantity picker. Products that
 * are missing or incomplete are created by hand with their code.
 */
export function ScanScreen({
  day,
  today,
  meal,
  initialFood
}: {
  day: string;
  today: string;
  meal: Meal;
  /** A food to open straight away (just created or corrected from here). */
  initialFood: LibraryFood | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(() =>
    initialFood ? { kind: "food", food: initialFood, warnings: [] } : { kind: "scan", error: null }
  );
  const [typed, setTyped] = useState("");
  const [lookingUp, setLookingUp] = useState<string | null>(null);
  // Failed code kept so the user can still create it by hand.
  const [failedCode, setFailedCode] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  // Closing the sheet after adding must not reopen the camera.
  const savedRef = useRef(false);
  const [, startTransition] = useTransition();

  const backHref = diaryHref(day, today);
  const here = scanHref(day, meal);

  function lookUp(code: string, format?: string) {
    const barcode = normalizeBarcode(code, format);
    if (!barcode) {
      setView({ kind: "scan", error: "Ese código no es válido: revisa el número." });
      return;
    }
    setLookingUp(barcode);
    startTransition(async () => {
      const result = await scanBarcode(code, format);
      setLookingUp(null);
      setFailedCode(result.kind === "error" ? result.barcode : null);
      setView(viewFor(result));
      if (result.kind === "error") setScanCount((count) => count + 1);
    });
  }

  function scanAgain() {
    if (savedRef.current) return;
    setView({ kind: "scan", error: null });
    setFailedCode(null);
    setTyped("");
    setScanCount((count) => count + 1);
  }

  const subtitle = `${formatRelativeDay(day, today)} · ${mealLabel(meal)}`;

  if (view.kind === "manual") {
    const { product } = view;
    return (
      <>
        <PageHeader
          backHref={addHref(day, meal)}
          backLabel="Volver a Añadir"
          subtitle={subtitle}
          title="Nuevo producto"
        />
        <section className="flex items-start gap-3 rounded-lg border border-line bg-white p-4">
          {product.imageUrl ? (
            <img
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg border border-line object-contain"
              src={product.imageUrl}
            />
          ) : null}
          <div className="grid gap-1 text-sm leading-6">
            <p className="font-semibold text-ink">{product.reason}</p>
            {product.warnings.map((warning) => (
              <p className="text-amber-900" key={warning}>
                {warning}
              </p>
            ))}
          </div>
        </section>
        <Link
          className="primary-button w-full gap-2"
          href={labelHref(day, meal, product.scanned.barcode)}
        >
          <CameraIcon />
          Leer la etiqueta con una foto
        </Link>
        <FoodForm
          food={null}
          initialName=""
          initialValues={product.values}
          next={here}
          scanned={product.scanned}
        />
        <button className="secondary-button w-full" onClick={scanAgain} type="button">
          Escanear otro
        </button>
      </>
    );
  }

  return (
    <>
      <PageHeader
        backHref={addHref(day, meal)}
        backLabel="Volver a Añadir"
        subtitle={subtitle}
        title="Escanear"
      />

      {lookingUp ? (
        <p
          className="grid aspect-[4/3] place-items-center rounded-lg border border-line bg-white px-4 text-center text-sm text-muted"
          role="status"
        >
          Buscando {lookingUp}...
        </p>
      ) : view.kind === "scan" ? (
        <BarcodeScanner key={scanCount} onDetected={lookUp} />
      ) : (
        <button className="primary-button w-full" onClick={scanAgain} type="button">
          Escanear otro
        </button>
      )}

      {view.kind === "scan" && view.error ? (
        <div
          className="grid gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          role="alert"
        >
          <p>{view.error}</p>
          {failedCode ? (
            <button
              className="min-h-10 text-left underline"
              onClick={() =>
                setView({
                  kind: "manual",
                  product: {
                    reason: "Créalo con los datos de la etiqueta.",
                    scanned: { barcode: failedCode },
                    imageUrl: null,
                    warnings: []
                  }
                })
              }
              type="button"
            >
              Crearlo a mano
            </button>
          ) : null}
        </div>
      ) : null}

      <form
        className="grid gap-2 rounded-lg border border-line bg-white p-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (typed.trim()) lookUp(typed);
        }}
      >
        <label className="field-label" htmlFor="typed-barcode">
          ¿No se lee? Escribe el número
        </label>
        <div className="flex gap-2">
          <input
            autoComplete="off"
            className="field-input flex-1 tabular-nums"
            enterKeyHint="search"
            id="typed-barcode"
            inputMode="numeric"
            maxLength={18}
            onChange={(event) => {
              setTyped(event.target.value);
              if (view.kind === "scan" && view.error) setView({ kind: "scan", error: null });
            }}
            placeholder="8410000000000"
            type="text"
            value={typed}
          />
          <button className="primary-button" disabled={Boolean(lookingUp)} type="submit">
            Buscar
          </button>
        </div>
      </form>

      <FoodEntrySheet
        day={day}
        editHref={
          view.kind === "food"
            ? `/foods/${view.food.id}?next=${encodeURIComponent(here)}`
            : undefined
        }
        key={view.kind === "food" ? `${view.food.id}-${scanCount}` : "none"}
        onClose={scanAgain}
        onSaved={() => {
          savedRef.current = true;
          router.push(backHref);
        }}
        source="barcode"
        target={view.kind === "food" ? { kind: "new", food: view.food, meal } : null}
        warnings={view.kind === "food" ? view.warnings : []}
      />
    </>
  );
}
