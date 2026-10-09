import {
  formatAmount,
  MAX_BRAND_LENGTH,
  MAX_FOOD_NAME_LENGTH,
  MAX_KCAL_PER_100,
  type BaseUnit,
  type FoodFormValues,
  type FoodPortionData
} from "./food";

/** Fields asked to Open Food Facts; the rest of the product is not needed. */
export const OFF_FIELDS = [
  "product_name",
  "product_name_es",
  "generic_name",
  "generic_name_es",
  "brands",
  "quantity",
  "product_quantity",
  "product_quantity_unit",
  "serving_quantity",
  "serving_quantity_unit",
  "nutriments",
  "image_front_small_url",
  "image_front_url",
  "image_url"
] as const;

export const KJ_PER_KCAL = 4.184;

/** Portion names given to the serving and the package of a product. */
export const SERVING_PORTION_NAME = "ración";
export const PACKAGE_PORTION_NAME = "envase";
/**
 * Packages up to this size are single servings (a yogurt, a can, a bar) and
 * become an "envase" portion; a 400 g jar as the default would be absurd.
 */
export const MAX_PACKAGE_PORTION = 350;

/** A product of Open Food Facts mapped to the library's terms. */
export type OffProduct = {
  barcode: string;
  name: string | null;
  brand: string | null;
  baseUnit: BaseUnit;
  /** Null when the product has no usable energy value. */
  kcalPer100: number | null;
  proteinPer100: number | null;
  carbsPer100: number | null;
  fatPer100: number | null;
  portions: FoodPortionData[];
  imageUrl: string | null;
  /** Things to check before trusting the values, in Spanish. */
  warnings: string[];
};

export type OffLookup = { kind: "found"; product: OffProduct } | { kind: "notFound" };

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** OFF sends numbers as numbers or strings ("330"); anything else is null. */
function toNumber(value: unknown): number | null {
  const number =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean ? clean.slice(0, maxLength).trim() : null;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Only images of OFF's own servers are shown. */
export function isOffImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "openfoodfacts.org" || url.hostname.endsWith(".openfoodfacts.org"))
    );
  } catch {
    return false;
  }
}

/** Liquids are measured in ml; OFF says so in the package or serving unit. */
function baseUnitOf(product: Json): BaseUnit {
  for (const unit of [product.product_quantity_unit, product.serving_quantity_unit]) {
    if (unit === "g" || unit === "ml") return unit;
  }
  return typeof product.quantity === "string" && /\d\s*(ml|cl|l)\b/i.test(product.quantity)
    ? "ml"
    : "g";
}

/** A grams-per-100 macro, ignored when it cannot be one. */
function macro(nutriments: Json, key: string): number | null {
  const value = toNumber(nutriments[`${key}_100g`]);
  return value !== null && value >= 0 && value <= 100 ? round1(value) : null;
}

function portionAmount(value: unknown, unit: unknown, baseUnit: BaseUnit): number | null {
  const amount = toNumber(value);
  if (amount === null || amount <= 0 || amount > 5000) return null;
  if (unit !== undefined && unit !== null && unit !== baseUnit) return null;
  return round1(amount);
}

/** Maps the `product` of an OFF answer; `barcode` is the normalized code. */
export function mapOffProduct(barcode: string, product: Json): OffProduct {
  const warnings: string[] = [];
  const nutriments = isObject(product.nutriments) ? product.nutriments : {};
  const baseUnit = baseUnitOf(product);

  const name =
    text(product.product_name_es, MAX_FOOD_NAME_LENGTH) ??
    text(product.product_name, MAX_FOOD_NAME_LENGTH) ??
    text(product.generic_name_es, MAX_FOOD_NAME_LENGTH) ??
    text(product.generic_name, MAX_FOOD_NAME_LENGTH);
  // "Nutella, Ferrero": the first brand is the one on the package.
  const brand =
    typeof product.brands === "string"
      ? text(product.brands.split(",")[0], MAX_BRAND_LENGTH)
      : null;

  const kcal = toNumber(nutriments["energy-kcal_100g"]);
  const kj = toNumber(nutriments["energy-kj_100g"]) ?? toNumber(nutriments.energy_100g);
  let kcalPer100: number | null = null;
  if (kcal !== null && kcal >= 0) {
    kcalPer100 = round1(kcal);
    if (kj !== null && kj > 0 && Math.abs(kj / KJ_PER_KCAL - kcal) > Math.max(10, kcal * 0.1)) {
      warnings.push("Las kcal y los kJ no cuadran: comprueba las kcal con la etiqueta.");
    }
  } else if (kj !== null && kj >= 0) {
    kcalPer100 = round1(kj / KJ_PER_KCAL);
    warnings.push("Solo traía la energía en kJ: las kcal están calculadas a partir de ella.");
  }
  if (kcalPer100 !== null && kcalPer100 > MAX_KCAL_PER_100) {
    warnings.push(
      `Trae ${formatAmount(kcalPer100)} kcal por 100 ${baseUnit}, que no es posible: escríbelas tú.`
    );
    kcalPer100 = null;
  } else if (kcalPer100 === null) {
    warnings.push("No trae las calorías: escríbelas tú.");
  }

  const proteinPer100 = macro(nutriments, "proteins");
  const carbsPer100 = macro(nutriments, "carbohydrates");
  const fatPer100 = macro(nutriments, "fat");
  if (kcalPer100 !== null && proteinPer100 !== null && carbsPer100 !== null && fatPer100 !== null) {
    const fromMacros = 4 * proteinPer100 + 4 * carbsPer100 + 9 * fatPer100;
    if (Math.abs(fromMacros - kcalPer100) > Math.max(30, kcalPer100 * 0.2)) {
      warnings.push(
        `Las kcal no cuadran con proteína, hidratos y grasa (darían unas ${Math.round(fromMacros)}): compruébalas con la etiqueta.`
      );
    }
  }

  if (!name) warnings.push("No trae el nombre.");

  const portions: FoodPortionData[] = [];
  const serving = portionAmount(product.serving_quantity, product.serving_quantity_unit, baseUnit);
  const packageAmount = portionAmount(
    product.product_quantity,
    product.product_quantity_unit,
    baseUnit
  );
  if (serving !== null && serving !== packageAmount) {
    portions.push({ name: SERVING_PORTION_NAME, amount: serving });
  }
  if (packageAmount !== null && packageAmount <= MAX_PACKAGE_PORTION) {
    portions.push({ name: PACKAGE_PORTION_NAME, amount: packageAmount });
  }

  const imageUrl =
    [product.image_front_small_url, product.image_front_url, product.image_url].find(
      isOffImageUrl
    ) ?? null;

  return {
    barcode,
    name,
    brand,
    baseUnit,
    kcalPer100,
    proteinPer100,
    carbsPer100,
    fatPer100,
    portions,
    imageUrl,
    warnings
  };
}

/** Reads an OFF v2 product answer (`/api/v2/product/{code}.json`). */
export function parseOffResponse(barcode: string, body: unknown): OffLookup {
  if (!isObject(body) || body.status !== 1 || !isObject(body.product)) {
    return { kind: "notFound" };
  }
  return { kind: "found", product: mapOffProduct(barcode, body.product) };
}

const formText = (value: number) => String(value).replace(".", ",");

/** The food form filled in with what the product brings. */
export function offFormValues(product: OffProduct): FoodFormValues {
  return {
    name: product.name ?? "",
    brand: product.brand ?? "",
    baseUnit: product.baseUnit,
    kcalPer100: product.kcalPer100 === null ? "" : formText(product.kcalPer100),
    portions: product.portions.map(({ name, amount }) => ({ name, amount: formText(amount) }))
  };
}
