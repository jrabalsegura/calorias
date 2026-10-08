import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildEstimatePrompt,
  MAX_ESTIMATE_ITEMS,
  numberLibrary,
  parseDescription,
  parseEstimate,
  parseTextLines,
  sizedAmount,
  sizeOf,
  type LibraryReference
} from "./textEstimate";

const library: LibraryReference[] = numberLibrary([
  {
    id: "bread",
    name: "Pan de molde",
    brand: "Bimbo",
    baseUnit: "g",
    kcalPer100: 250,
    portions: [{ name: "rebanada", amount: 30 }]
  },
  { id: "kefir", name: "Kéfir", brand: null, baseUnit: "ml", kcalPer100: 52.5, portions: [] }
]);

const item = (overrides: Record<string, unknown> = {}) => ({
  name: "Plátano",
  amount: 120,
  unit: "g",
  kcalPer100: 89,
  libraryRef: null,
  assumption: "plátano mediano ≈ 120 g sin piel",
  confidence: "medium",
  cookingOil: false,
  ...overrides
});

test("the prompt lists the library with refs, units and portions", () => {
  const prompt = buildEstimatePrompt("dos tostadas de mi pan de molde", library);
  assert.match(prompt, /#1 Pan de molde \(Bimbo\): 250 kcal\/100 g; porciones: rebanada = 30 g/);
  assert.match(prompt, /#2 Kéfir: 52,5 kcal\/100 ml\n/);
  assert.match(prompt, /<descripcion>\ndos tostadas de mi pan de molde\n<\/descripcion>/);
  assert.match(buildEstimatePrompt("x", []), /no tiene alimentos guardados/);
});

test("descriptions are trimmed and limited", () => {
  assert.deepEqual(parseDescription("  2 huevos\n fritos "), { ok: true, value: "2 huevos fritos" });
  assert.equal(parseDescription(" ").ok, false);
  assert.equal(parseDescription(null).ok, false);
  assert.equal(parseDescription("a".repeat(501)).ok, false);
});

test("kcal are worked out from the kcal per 100, never taken from the AI", () => {
  const result = parseEstimate({ items: [item({ kcal: 9999 })] }, library);
  assert.ok(result.ok);
  assert.deepEqual(result.items, [
    {
      name: "Plátano",
      amount: 120,
      unit: "g",
      kcalPer100: 89,
      kcal: 107,
      foodId: null,
      assumption: "plátano mediano ≈ 120 g sin piel",
      confidence: "medium",
      cookingOil: false
    }
  ]);
});

test("a library food keeps its own unit and kcal per 100", () => {
  const result = parseEstimate(
    {
      items: [
        item({ name: "Pan de molde", amount: 60, kcalPer100: 265, libraryRef: 1 }),
        item({ name: "Kéfir", amount: 200, unit: "g", kcalPer100: 60, libraryRef: 2 })
      ]
    },
    library
  );
  assert.ok(result.ok);
  assert.deepEqual(
    result.items.map(({ foodId, unit, kcalPer100, kcal }) => ({ foodId, unit, kcalPer100, kcal })),
    [
      { foodId: "bread", unit: "g", kcalPer100: 250, kcal: 150 },
      { foodId: "kefir", unit: "ml", kcalPer100: 52.5, kcal: 105 }
    ]
  );
});

test("an unknown library ref is treated as an estimate", () => {
  const result = parseEstimate({ items: [item({ libraryRef: 7 })] }, library);
  assert.ok(result.ok);
  assert.equal(result.items[0].foodId, null);
  assert.equal(result.items[0].kcalPer100, 89);
});

test("lines that make no sense are dropped, and amounts rounded", () => {
  const result = parseEstimate(
    {
      items: [
        item({ name: "  " }),
        item({ amount: 0 }),
        item({ amount: 6000 }),
        item({ kcalPer100: 950 }),
        item({ kcalPer100: -1 }),
        "not an item",
        item({ name: "Sal", amount: 0.4, kcalPer100: 0, assumption: "", confidence: "??" }),
        item({ name: "Aceite de oliva (cocinado)", amount: 9.6, kcalPer100: 899, cookingOil: true })
      ]
    },
    library
  );
  assert.ok(result.ok);
  assert.deepEqual(
    result.items.map(({ name, amount, kcal, assumption, confidence, cookingOil }) => ({
      name,
      amount,
      kcal,
      assumption,
      confidence,
      cookingOil
    })),
    [
      { name: "Sal", amount: 1, kcal: 0, assumption: null, confidence: "medium", cookingOil: false },
      {
        name: "Aceite de oliva (cocinado)",
        amount: 10,
        kcal: 90,
        assumption: "plátano mediano ≈ 120 g sin piel",
        confidence: "medium",
        cookingOil: true
      }
    ]
  );
});

test("an empty or broken answer is an error", () => {
  assert.equal(parseEstimate({ items: [] }, library).ok, false);
  assert.equal(parseEstimate({ items: [item({ amount: 0 })] }, library).ok, false);
  assert.equal(parseEstimate(null, library).ok, false);
  assert.equal(parseEstimate({ lines: [] }, library).ok, false);
});

test("too many lines are cut", () => {
  const result = parseEstimate({ items: Array.from({ length: 30 }, () => item()) }, library);
  assert.ok(result.ok);
  assert.equal(result.items.length, MAX_ESTIMATE_ITEMS);
});

test("sizes scale the AI's amount and are recognised back", () => {
  assert.equal(sizedAmount(120, "small"), 90);
  assert.equal(sizedAmount(120, "normal"), 120);
  assert.equal(sizedAmount(120, "large"), 150);
  assert.equal(sizedAmount(1, "small"), 1);
  assert.equal(sizeOf(120, 150), "large");
  assert.equal(sizeOf(120, 120), "normal");
  assert.equal(sizeOf(120, 130), null);
});

test("reviewed lines are validated, and linked ones use the current food", () => {
  const foods = new Map([["bread", { baseUnit: "g" as const, kcalPer100: 260 }]]);
  const result = parseTextLines(
    [
      { name: "Lentejas con chorizo", amount: "350", unit: "g", kcalPer100: 130, foodId: null },
      { name: "Pan de molde", amount: "60,5", unit: "ml", kcalPer100: 250, foodId: "bread" },
      { name: "Leche", amount: "200", unit: "ml", kcalPer100: 46, foodId: "gone" }
    ],
    foods
  );
  assert.deepEqual(result, {
    ok: true,
    value: [
      { name: "Lentejas con chorizo", quantity: 350, unit: "g", kcal: 455, foodId: null },
      { name: "Pan de molde", quantity: 60.5, unit: "g", kcal: 157, foodId: "bread" },
      { name: "Leche", quantity: 200, unit: "ml", kcal: 92, foodId: null }
    ]
  });
});

test("reviewed lines reject what cannot be saved", () => {
  const line = { name: "Arroz", amount: "100", unit: "g", kcalPer100: 130, foodId: null };
  const none = new Map();
  assert.equal(parseTextLines([], none).ok, false);
  assert.equal(parseTextLines([{ ...line, name: " " }], none).ok, false);
  assert.equal(parseTextLines([{ ...line, amount: "" }], none).ok, false);
  assert.equal(parseTextLines([{ ...line, amount: "0" }], none).ok, false);
  assert.equal(parseTextLines([{ ...line, unit: "taza" }], none).ok, false);
  assert.equal(parseTextLines([{ ...line, kcalPer100: 901 }], none).ok, false);
  assert.equal(parseTextLines([{ ...line, amount: "5000", kcalPer100: 900 }], none).ok, false);
  assert.equal(parseTextLines(Array(MAX_ESTIMATE_ITEMS + 1).fill(line), none).ok, false);
});
