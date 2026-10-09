import {
  formatAmount,
  isBaseUnit,
  MAX_BRAND_LENGTH,
  MAX_FOOD_NAME_LENGTH,
  MAX_KCAL_PER_100,
  MAX_PORTION_AMOUNT,
  type BaseUnit,
  type FoodFormValues
} from "./food";
import { KJ_PER_KCAL, SERVING_PORTION_NAME } from "./off";

/** Longest side of the photo once reduced on the phone, in pixels. */
export const LABEL_IMAGE_MAX_SIDE = 1500;
/** Base64 text accepted by the server (about 3,7 MB of image). */
export const MAX_LABEL_IMAGE_BASE64 = 5_000_000;
export const LABEL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type LabelImageType = (typeof LABEL_IMAGE_TYPES)[number];

export type LabelImageResult =
  | { ok: true; value: { data: string; mediaType: LabelImageType } }
  | { ok: false; error: string };

/** Checks the photo the phone sends: an image in base64, not too big. */
export function parseLabelImage(raw: { data: unknown; mediaType: unknown }): LabelImageResult {
  const mediaType = LABEL_IMAGE_TYPES.find((type) => type === raw.mediaType);
  if (!mediaType) return { ok: false, error: "La foto tiene que ser JPEG, PNG o WebP." };
  const data = typeof raw.data === "string" ? raw.data : "";
  if (data.length < 100 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return { ok: false, error: "No se ha podido leer la foto. Prueba con otra." };
  }
  if (data.length > MAX_LABEL_IMAGE_BASE64) {
    return { ok: false, error: "La foto es demasiado grande. Prueba con otra." };
  }
  return { ok: true, value: { data, mediaType } };
}

/** JSON schema of the AI's reading (structured outputs: no numeric limits). */
export const LABEL_SCHEMA = {
  type: "object",
  properties: {
    readable: { type: "boolean" },
    problem: { type: "string" },
    name: { type: "string" },
    brand: { type: "string" },
    baseUnit: { type: "string", enum: ["g", "ml"] },
    basis: { type: "string", enum: ["per100", "perServing"] },
    energyKcal: { anyOf: [{ type: "number" }, { type: "null" }] },
    energyKj: { anyOf: [{ type: "number" }, { type: "null" }] },
    protein: { anyOf: [{ type: "number" }, { type: "null" }] },
    carbs: { anyOf: [{ type: "number" }, { type: "null" }] },
    fat: { anyOf: [{ type: "number" }, { type: "null" }] },
    servingAmount: { anyOf: [{ type: "number" }, { type: "null" }] }
  },
  required: [
    "readable",
    "problem",
    "name",
    "brand",
    "baseUnit",
    "basis",
    "energyKcal",
    "energyKj",
    "protein",
    "carbs",
    "fat",
    "servingAmount"
  ],
  additionalProperties: false
} as const;

export const LABEL_SYSTEM_PROMPT = `Lees la foto de un envase de comida o bebida, normalmente de un supermercado español, y copias los valores de su tabla de información nutricional para guardarlo en una app de calorías. Quien la usa revisará lo que leas antes de guardarlo.

Devuelve:
- readable: true si se ve una tabla nutricional y puedes leer al menos la energía; false si no hay tabla, está cortada justo en la energía o no se distingue.
- problem: si algún número que devuelves no se lee con seguridad (foto borrosa, reflejos, poca luz, tabla cortada), dilo en pocas palabras en español («foto oscura, la grasa no se lee bien»). Que no se vean el nombre o la marca, que falten los kJ o que la etiqueta esté en otro idioma no son problemas. Cadena vacía si los números se leen bien.
- name: nombre del producto en español tal como aparece en el envase, corto y con mayúscula inicial, sin la cantidad («Yogur natural», «Galletas de avena»). Cadena vacía si no se ve.
- brand: la marca si se ve; si no, cadena vacía.
- baseUnit: ml si la tabla es por 100 ml (bebidas, leche, aceites que lo indiquen); si no, g.
- basis: per100 si usas la columna por 100 g o 100 ml (úsala siempre que exista); perServing solo si la tabla únicamente trae valores por ración.
- energyKcal y energyKj: los números de energía tal como están escritos en esa columna, cada uno en su campo según su unidad (kcal o kJ). null el que no aparezca. No conviertas ni calcules nada.
- protein, carbs y fat: proteínas, hidratos de carbono y grasas (totales, no «de los cuales azúcares» ni «saturadas») en gramos, de esa misma columna. null si no aparecen o no se leen.
- servingAmount: el tamaño de la ración en g o ml si la etiqueta lo indica («por ración de 30 g», «1 vaso = 250 ml»); si no, null.

Copia los números exactamente como aparecen, con la coma decimal convertida a punto. Si dudas de una cifra, ponla igualmente y menciónalo en problem; si no la ves, pon null. No inventes valores ni los completes con los de productos parecidos.`;

export const LABEL_PROMPT = "Lee la tabla nutricional de esta foto.";

/** What the label says, per 100 of the base unit, with what to check. */
export type LabelReading = {
  name: string | null;
  brand: string | null;
  baseUnit: BaseUnit;
  /** Null when no usable energy value could be read. */
  kcalPer100: number | null;
  proteinPer100: number | null;
  carbsPer100: number | null;
  fatPer100: number | null;
  /** The serving the label states, in the base unit. */
  servingAmount: number | null;
  /** Things to check before saving, in Spanish. */
  warnings: string[];
};

export type LabelResult = { ok: true; reading: LabelReading } | { ok: false; error: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const round1 = (value: number) => Math.round(value * 10) / 10;

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean ? clean.slice(0, maxLength).trim() : null;
}

/** kcal and kJ that are the same energy, give or take rounding. */
const energiesMatch = (kcal: number, kj: number) =>
  Math.abs(kj / KJ_PER_KCAL - kcal) <= Math.max(10, kcal * 0.1);

/** kcal that agree with 4·protein + 4·carbs + 9·fat (fibre and polyols allow slack). */
const macrosMatch = (kcal: number, fromMacros: number) =>
  Math.abs(fromMacros - kcal) <= Math.max(30, kcal * 0.2);

type Macros = { protein: number | null; carbs: number | null; fat: number | null };

function kcalFromMacros({ protein, carbs, fat }: Macros): number | null {
  return protein !== null && carbs !== null && fat !== null
    ? 4 * protein + 4 * carbs + 9 * fat
    : null;
}

/**
 * Works out the kcal per 100 from what was read, catching the usual mix-ups
 * between kJ and kcal, and says what the user should check.
 */
export function checkLabelEnergy(
  kcal: number | null,
  kj: number | null,
  macros: Macros,
  baseUnit: BaseUnit
): { kcalPer100: number | null; warnings: string[] } {
  const warnings: string[] = [];
  const fromMacros = kcalFromMacros(macros);
  let result: number | null = null;

  if (kcal !== null && kj !== null && kj > 0) {
    if (energiesMatch(kcal, kj)) {
      result = kcal;
    } else if (Math.abs(kcal - kj) <= Math.max(1, kj * 0.02)) {
      // The kJ figure read twice.
      result = kj / KJ_PER_KCAL;
      warnings.push("Las kcal leídas eran los kJ: se han calculado a partir de ellos. Compruébalas.");
    } else if (energiesMatch(kj, kcal)) {
      // Each one in the other's field.
      result = kj;
      warnings.push("Los kJ y las kcal estaban cambiados: se han corregido. Compruébalas.");
    } else {
      result = kcal;
      warnings.push("Las kcal y los kJ no cuadran: comprueba las kcal con la etiqueta.");
    }
  } else if (kcal !== null) {
    const looksLikeKj =
      kcal > MAX_KCAL_PER_100 ||
      (fromMacros !== null &&
        !macrosMatch(kcal, fromMacros) &&
        macrosMatch(kcal / KJ_PER_KCAL, fromMacros));
    if (looksLikeKj && kcal / KJ_PER_KCAL <= MAX_KCAL_PER_100) {
      result = kcal / KJ_PER_KCAL;
      warnings.push("La energía leída parece estar en kJ: se ha pasado a kcal. Compruébala.");
    } else {
      result = kcal;
    }
  } else if (kj !== null) {
    result = kj / KJ_PER_KCAL;
    warnings.push("La etiqueta solo trae kJ: las kcal están calculadas a partir de ellos.");
  }

  if (result !== null && result > MAX_KCAL_PER_100) {
    warnings.push(
      `Salen ${formatAmount(round1(result))} kcal por 100 ${baseUnit}, que no es posible: escríbelas tú.`
    );
    result = null;
  } else if (result === null) {
    warnings.push("No se leen las calorías: escríbelas tú.");
  }

  if (result !== null && fromMacros !== null && !macrosMatch(result, fromMacros)) {
    warnings.push(
      `Las kcal no cuadran con proteína, hidratos y grasa (darían unas ${Math.round(fromMacros)}): compruébalas con la etiqueta.`
    );
  }

  return { kcalPer100: result === null ? null : round1(result), warnings };
}

/**
 * Checks the AI's reading of a label: values per serving go to per 100,
 * the energy is checked against kJ and macros, and nothing impossible is
 * kept. An unreadable label is an error to retake the photo.
 */
export function parseLabelReading(raw: unknown): LabelResult {
  if (!isObject(raw)) {
    return { ok: false, error: "La IA no ha devuelto una lectura válida. Prueba otra vez." };
  }
  const problem = text(raw.problem, 160);
  if (raw.readable !== true) {
    return {
      ok: false,
      error: `No se lee la tabla nutricional${problem ? ` (${problem.replace(/\.$/, "")})` : ""}. Haz otra foto de frente y con buena luz, o escribe los datos a mano.`
    };
  }

  const baseUnit: BaseUnit = isBaseUnit(raw.baseUnit) ? raw.baseUnit : "g";
  const warnings: string[] = [];
  if (problem) warnings.push(`Al leerla: ${problem.replace(/\.$/, "")}. Revisa los valores.`);

  const serving = number(raw.servingAmount);
  const servingAmount = serving !== null && serving > 0 && serving <= MAX_PORTION_AMOUNT ? round1(serving) : null;

  // Values per serving only make sense per 100 if the serving size is known.
  let factor: number | null = 1;
  if (raw.basis === "perServing") {
    factor = servingAmount ? 100 / servingAmount : null;
    if (factor) {
      warnings.push(
        `La etiqueta solo da valores por ración (${formatAmount(servingAmount!)} ${baseUnit}): se han pasado a 100 ${baseUnit}.`
      );
    }
  }
  const per100 = (value: unknown) => {
    const read = number(value);
    return read === null || factor === null ? null : read * factor;
  };
  const macro = (value: unknown) => {
    const amount = per100(value);
    return amount !== null && amount <= 100 ? round1(amount) : null;
  };

  const macros = { protein: macro(raw.protein), carbs: macro(raw.carbs), fat: macro(raw.fat) };
  let energy: { kcalPer100: number | null; warnings: string[] };
  if (factor === null) {
    energy = {
      kcalPer100: null,
      warnings: ["La etiqueta solo da valores por ración y no dice de cuánto es: escribe las kcal por 100."]
    };
  } else {
    energy = checkLabelEnergy(per100(raw.energyKcal), per100(raw.energyKj), macros, baseUnit);
  }
  warnings.push(...energy.warnings);

  const name = text(raw.name, MAX_FOOD_NAME_LENGTH);
  if (!name) warnings.push("La foto no muestra el nombre: escríbelo tú.");

  return {
    ok: true,
    reading: {
      name,
      brand: text(raw.brand, MAX_BRAND_LENGTH),
      baseUnit,
      kcalPer100: energy.kcalPer100,
      proteinPer100: macros.protein,
      carbsPer100: macros.carbs,
      fatPer100: macros.fat,
      servingAmount,
      warnings
    }
  };
}

const formText = (value: number) => String(value).replace(".", ",");

/** The food form filled in with the reading. */
export function labelFormValues(reading: LabelReading): FoodFormValues {
  return {
    name: reading.name ?? "",
    brand: reading.brand ?? "",
    baseUnit: reading.baseUnit,
    kcalPer100: reading.kcalPer100 === null ? "" : formText(reading.kcalPer100),
    portions: reading.servingAmount
      ? [{ name: SERVING_PORTION_NAME, amount: formText(reading.servingAmount) }]
      : []
  };
}

/** Size of a photo reduced so its longest side is at most `maxSide`. */
export function scaledSize(
  width: number,
  height: number,
  maxSide = LABEL_IMAGE_MAX_SIDE
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
