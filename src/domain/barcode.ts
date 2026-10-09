import { parseFoodInput, type FoodFormValues, type FoodInput } from "./food";
import { isOffImageUrl, offFormValues, type OffLookup, type OffProduct } from "./off";

/** Check digit of a GTIN (EAN-8, UPC-A, EAN-13) given without it. */
function gtinCheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    // Weights alternate 3, 1, 3… starting from the rightmost digit.
    const weight = (body.length - i) % 2 === 1 ? 3 : 1;
    sum += Number(body[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

function hasValidCheckDigit(code: string): boolean {
  return gtinCheckDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/** UPC-A (12 digits) of a UPC-E (8 digits), or null if it is not one. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [ns, x1, x2, x3, x4, x5, x6, check] = code;
  const body =
    x6 <= "2"
      ? `${x1}${x2}${x6}0000${x3}${x4}${x5}`
      : x6 === "3"
        ? `${x1}${x2}${x3}00000${x4}${x5}`
        : x6 === "4"
          ? `${x1}${x2}${x3}${x4}00000${x5}`
          : `${x1}${x2}${x3}${x4}${x5}0000${x6}`;
  const upcA = `${ns}${body}${check}`;
  return hasValidCheckDigit(upcA) ? upcA : null;
}

/**
 * The code saved and looked up for a scanned or typed barcode: EAN-13 or
 * EAN-8 with a valid check digit. UPC-A becomes its EAN-13 (with a leading
 * 0) and UPC-E is expanded first, so a product read in either form matches.
 * `format` is what the scanner reported; typed codes go without it.
 */
export function normalizeBarcode(raw: string, format?: string): string | null {
  let code = raw.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(code)) return null;

  if (format === "upc_e" || (code.length === 8 && !hasValidCheckDigit(code))) {
    const upcA = expandUpcE(code);
    if (!upcA) return null;
    code = upcA;
  }
  if (code.length === 14 && code.startsWith("0")) code = code.slice(1);
  if (code.length === 12) code = `0${code}`;

  return (code.length === 8 || code.length === 13) && hasValidCheckDigit(code) ? code : null;
}

/** Formats the scanner is asked for. */
export const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

/** Everything saved for a product found in Open Food Facts. */
export type ScannedFoodInput = FoodInput & {
  barcode: string;
  imageUrl: string | null;
  proteinPer100: number | null;
  carbsPer100: number | null;
  fatPer100: number | null;
};

export type BarcodeLookup<F> =
  /** In the library already, or just saved from Open Food Facts. */
  | { kind: "food"; food: F; warnings: string[] }
  /** In Open Food Facts but without enough data: the user completes it. */
  | { kind: "incomplete"; product: OffProduct; values: FoodFormValues }
  | { kind: "notFound"; barcode: string };

export type BarcodeLookupDeps<F> = {
  findFood: (barcode: string) => Promise<F | null>;
  /** Throws when Open Food Facts cannot be reached. */
  fetchOff: (barcode: string) => Promise<OffLookup>;
  createFood: (input: ScannedFoodInput) => Promise<F>;
};

/**
 * The library first, so a product scanned before never queries Open Food
 * Facts again; then Open Food Facts, saving the product when its data are
 * usable as they come.
 */
export async function lookupBarcode<F>(
  barcode: string,
  deps: BarcodeLookupDeps<F>
): Promise<BarcodeLookup<F>> {
  const saved = await deps.findFood(barcode);
  if (saved) return { kind: "food", food: saved, warnings: [] };

  const off = await deps.fetchOff(barcode);
  if (off.kind === "notFound") return { kind: "notFound", barcode };

  const { product } = off;
  const values = offFormValues(product);
  const parsed = product.kcalPer100 === null ? null : parseFoodInput(values);
  if (!parsed?.ok) return { kind: "incomplete", product, values };

  const food = await deps.createFood({
    ...parsed.value,
    barcode,
    imageUrl: product.imageUrl,
    proteinPer100: product.proteinPer100,
    carbsPer100: product.carbsPer100,
    fatPer100: product.fatPer100
  });
  return { kind: "food", food, warnings: product.warnings };
}

export type ScanExtras = Omit<ScannedFoodInput, keyof FoodInput>;

const macroOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;

/** Macros sent along with a food form, kept only if they can be grams per 100. */
export function parseMacroExtras(raw: {
  proteinPer100?: unknown;
  carbsPer100?: unknown;
  fatPer100?: unknown;
}): Pick<ScanExtras, "proteinPer100" | "carbsPer100" | "fatPer100"> {
  return {
    proteinPer100: macroOrNull(raw.proteinPer100),
    carbsPer100: macroOrNull(raw.carbsPer100),
    fatPer100: macroOrNull(raw.fatPer100)
  };
}

/**
 * Validates what the scanner screen sends along with the food form when a
 * product has to be completed by hand. Null when the barcode is not valid.
 */
export function parseScanExtras(raw: {
  barcode: unknown;
  imageUrl?: unknown;
  proteinPer100?: unknown;
  carbsPer100?: unknown;
  fatPer100?: unknown;
}): ScanExtras | null {
  const barcode = typeof raw.barcode === "string" ? normalizeBarcode(raw.barcode) : null;
  if (!barcode) return null;
  return {
    barcode,
    imageUrl: isOffImageUrl(raw.imageUrl) ? raw.imageUrl : null,
    ...parseMacroExtras(raw)
  };
}
