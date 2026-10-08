import { MAX_ENTRY_KCAL, MAX_ENTRY_NAME_LENGTH } from "./diary";
import {
  formatAmount,
  isBaseUnit,
  MAX_BASE_AMOUNT,
  MAX_KCAL_PER_100,
  type BaseUnit,
  type FoodPortionData
} from "./food";
import { parseDecimal } from "./target";

/** Longest description sent to the AI. */
export const MAX_DESCRIPTION_LENGTH = 500;
/** More lines than this is not a meal but an error. */
export const MAX_ESTIMATE_ITEMS = 20;

export const CONFIDENCE_LEVELS = [
  { id: "high", label: "Fiable" },
  { id: "medium", label: "Aproximado" },
  { id: "low", label: "Dudoso" }
] as const;

export type Confidence = (typeof CONFIDENCE_LEVELS)[number]["id"];

/** Small, normal and large change the AI's amount by these factors. */
export const SIZES = [
  { id: "small", label: "Pequeño", factor: 0.75 },
  { id: "normal", label: "Normal", factor: 1 },
  { id: "large", label: "Grande", factor: 1.25 }
] as const;

export type Size = (typeof SIZES)[number]["id"];

/** A food of the library as the AI sees it: `ref` is its number in the list. */
export type LibraryReference = {
  ref: number;
  id: string;
  name: string;
  brand: string | null;
  baseUnit: BaseUnit;
  kcalPer100: number;
  portions: readonly FoodPortionData[];
};

/** One line of the breakdown, checked and with the kcal worked out here. */
export type EstimateItem = {
  name: string;
  amount: number;
  unit: BaseUnit;
  kcalPer100: number;
  kcal: number;
  /** The library food it is, whose data replace the AI's. */
  foodId: string | null;
  assumption: string | null;
  confidence: Confidence;
  cookingOil: boolean;
};

/** JSON schema of the AI's answer (structured outputs: no numeric limits). */
export const ESTIMATE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          unit: { type: "string", enum: ["g", "ml"] },
          kcalPer100: { type: "number" },
          libraryRef: { anyOf: [{ type: "integer" }, { type: "null" }] },
          assumption: { type: "string" },
          confidence: { type: "string", enum: CONFIDENCE_LEVELS.map(({ id }) => id) },
          cookingOil: { type: "boolean" }
        },
        required: [
          "name",
          "amount",
          "unit",
          "kcalPer100",
          "libraryRef",
          "assumption",
          "confidence",
          "cookingOil"
        ],
        additionalProperties: false
      }
    }
  },
  required: ["items"],
  additionalProperties: false
} as const;

export const ESTIMATE_SYSTEM_PROMPT = `Eres un dietista que estima las calorías de lo que una persona que vive en España dice haber comido. Desglosa su descripción en líneas que pueda revisar y ajustar antes de guardarlas en su diario.

Cada línea lleva:
- name: nombre corto en español, con mayúscula inicial y sin la cantidad («Lentejas con chorizo», «Leche semidesnatada»).
- amount y unit: cantidad en gramos (g) o, para bebidas y líquidos, en mililitros (ml).
- kcalPer100: kcal por 100 g o 100 ml del alimento tal como se come (cocinado si está cocinado), con valores de referencia habituales en España (BEDCA, etiquetas típicas).
- libraryRef: el número del alimento de «Mis alimentos» si la línea es uno de ellos; si no, null.
- assumption: el supuesto que has hecho, en pocas palabras («plátano mediano ≈ 120 g sin piel», «plato de lentejas ≈ 350 g»). Cadena vacía si no has tenido que suponer nada.
- confidence: high si la cantidad y el alimento están claros, medium si has estimado la ración o la receta, low si la descripción es vaga o el plato varía mucho.
- cookingOil: true solo en la línea del aceite de cocinado.

Reglas:
1. Respeta siempre las cantidades que se indican, convirtiéndolas a g o ml («2 huevos» son unos 120 g, «un vaso» de leche 200 ml). No las cambies aunque te parezcan raras.
2. Si no hay cantidad, usa la ración típica en España para un adulto y explica el supuesto.
3. Un plato preparado (lentejas, paella, tortilla de patatas) va en una sola línea con sus kcal por 100 g, sin el aceite añadido al cocinar. El aceite de cocinado va siempre en una línea aparte llamada «Aceite de oliva (cocinado)» o similar, en gramos, con lo que realmente queda en la ración (no todo lo que se usa en la sartén), para que se vea y se pueda quitar. Fritos, guisos, salteados y plancha suelen llevarlo; lo cocido, al horno sin grasa o crudo no.
4. Usa un alimento de «Mis alimentos» solo cuando la descripción se refiere a él: con «mi», con su marca o con su nombre concreto («pan de molde integral»). Una palabra genérica («pan», «yogur») no basta. Entonces usa su libraryRef, su unidad y sus kcal por 100, y sus porciones para pasar unidades a g o ml.
5. Si algo no es comida ni bebida, ignóralo. Si no hay nada que estimar, devuelve una lista vacía.`;

function libraryLine(food: LibraryReference): string {
  const name = food.brand ? `${food.name} (${food.brand})` : food.name;
  const portions = food.portions
    .map(({ name: portion, amount }) => `${portion} = ${formatAmount(amount)} ${food.baseUnit}`)
    .join("; ");
  return `#${food.ref} ${name}: ${formatAmount(food.kcalPer100)} kcal/100 ${food.baseUnit}${
    portions ? `; porciones: ${portions}` : ""
  }`;
}

/** The user message: the library (so "mi pan de molde" uses its data) and the description. */
export function buildEstimatePrompt(
  description: string,
  library: readonly LibraryReference[]
): string {
  const foods = library.length
    ? library.map(libraryLine).join("\n")
    : "(no tiene alimentos guardados)";
  return `Mis alimentos:\n${foods}\n\nLo que he comido:\n<descripcion>\n${description}\n</descripcion>`;
}

/** Library foods numbered for the prompt, so the AI answers with a short ref. */
export function numberLibrary(
  foods: readonly Omit<LibraryReference, "ref">[]
): LibraryReference[] {
  return foods.map((food, index) => ({ ...food, ref: index + 1 }));
}

export type DescriptionResult = { ok: true; value: string } | { ok: false; error: string };

export function parseDescription(raw: unknown): DescriptionResult {
  const text = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (text.length < 2) return { ok: false, error: "Escribe lo que has comido." };
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: `Como mucho ${MAX_DESCRIPTION_LENGTH} caracteres: divide la comida en dos.`
    };
  }
  return { ok: true, value: text };
}

/** Whole grams or millilitres, at least 1. */
export function roundAmount(amount: number): number {
  return Math.max(1, Math.round(amount));
}

export function kcalFor(kcalPer100: number, amount: number): number {
  return Math.round((kcalPer100 * amount) / 100);
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function isConfidence(value: unknown): value is Confidence {
  return CONFIDENCE_LEVELS.some(({ id }) => id === value);
}

export type EstimateResult =
  | { ok: true; items: EstimateItem[] }
  | { ok: false; error: string };

/**
 * Checks the AI's answer. Lines that make no sense are dropped, kcal are
 * worked out here (never trusted), and a line that is a library food takes
 * its unit and kcal per 100 from the library.
 */
export function parseEstimate(
  raw: unknown,
  library: readonly LibraryReference[]
): EstimateResult {
  if (!isObject(raw) || !Array.isArray(raw.items)) {
    return { ok: false, error: "La IA no ha devuelto un desglose válido." };
  }

  const byRef = new Map(library.map((food) => [food.ref, food]));
  const items: EstimateItem[] = [];

  for (const item of raw.items.slice(0, MAX_ESTIMATE_ITEMS)) {
    if (!isObject(item)) continue;

    const name = cleanText(item.name, MAX_ENTRY_NAME_LENGTH);
    const amount = typeof item.amount === "number" ? item.amount : NaN;
    if (!name || !(amount > 0) || amount > MAX_BASE_AMOUNT) continue;

    const food = typeof item.libraryRef === "number" ? byRef.get(item.libraryRef) : undefined;
    const unit = food?.baseUnit ?? (isBaseUnit(item.unit) ? item.unit : "g");
    const kcalPer100 = food?.kcalPer100 ?? (typeof item.kcalPer100 === "number" ? item.kcalPer100 : NaN);
    if (!(kcalPer100 >= 0) || kcalPer100 > MAX_KCAL_PER_100) continue;

    const rounded = roundAmount(amount);
    items.push({
      name,
      amount: rounded,
      unit,
      kcalPer100: Math.round(kcalPer100 * 10) / 10,
      kcal: kcalFor(kcalPer100, rounded),
      foodId: food?.id ?? null,
      assumption: cleanText(item.assumption, 120) || null,
      confidence: isConfidence(item.confidence) ? item.confidence : "medium",
      cookingOil: item.cookingOil === true
    });
  }

  if (items.length === 0) {
    return {
      ok: false,
      error: "No he encontrado ninguna comida en la descripción. Prueba a escribirla de otra forma."
    };
  }
  return { ok: true, items };
}

/** The amount for a size, from the AI's amount. */
export function sizedAmount(baseAmount: number, size: Size): number {
  const { factor } = SIZES.find(({ id }) => id === size)!;
  return roundAmount(baseAmount * factor);
}

/** The size whose amount is the current one, if any. */
export function sizeOf(baseAmount: number, amount: number): Size | null {
  return SIZES.find(({ id }) => sizedAmount(baseAmount, id) === amount)?.id ?? null;
}

/** A reviewed line as the client sends it to be saved. */
export type TextLineInput = {
  name: string;
  amount: string;
  unit: string;
  kcalPer100: number;
  foodId: string | null;
};

export type TextEntryData = {
  name: string;
  quantity: number;
  unit: BaseUnit;
  kcal: number;
  foodId: string | null;
};

export type TextLinesResult =
  | { ok: true; value: TextEntryData[] }
  | { ok: false; error: string };

/**
 * Validates the reviewed lines. `foods` has the current data of the library
 * foods the lines point to: a linked line is recalculated with them.
 */
export function parseTextLines(
  lines: readonly TextLineInput[],
  foods: ReadonlyMap<string, { baseUnit: BaseUnit; kcalPer100: number }>
): TextLinesResult {
  if (lines.length === 0) return { ok: false, error: "No queda nada que añadir." };
  if (lines.length > MAX_ESTIMATE_ITEMS) {
    return { ok: false, error: `Como mucho ${MAX_ESTIMATE_ITEMS} líneas.` };
  }

  const entries: TextEntryData[] = [];
  for (const line of lines) {
    const name = cleanText(line.name, MAX_ENTRY_NAME_LENGTH);
    if (!name) return { ok: false, error: "Cada línea necesita un nombre." };

    const amount = parseDecimal(line.amount);
    if (amount === null || amount <= 0 || amount > MAX_BASE_AMOUNT) {
      return {
        ok: false,
        error: `Escribe la cantidad de «${name}» (hasta ${formatAmount(MAX_BASE_AMOUNT)}).`
      };
    }

    const food = line.foodId ? foods.get(line.foodId) : undefined;
    const unit = food?.baseUnit ?? (isBaseUnit(line.unit) ? line.unit : null);
    const kcalPer100 = food?.kcalPer100 ?? line.kcalPer100;
    if (!unit || !(kcalPer100 >= 0) || kcalPer100 > MAX_KCAL_PER_100) {
      return { ok: false, error: `Los datos de «${name}» no son válidos.` };
    }

    const quantity = Math.round(amount * 10) / 10;
    const kcal = kcalFor(kcalPer100, quantity);
    if (kcal > MAX_ENTRY_KCAL) {
      return { ok: false, error: `Como mucho ${formatAmount(MAX_ENTRY_KCAL)} kcal por línea.` };
    }
    entries.push({ name, quantity, unit, kcal, foodId: food ? line.foodId : null });
  }

  return { ok: true, value: entries };
}
