import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amountInBaseUnit,
  copyEntries,
  defaultQuantity,
  foodEntryName,
  foodFromEntry,
  formatQuantity,
  kcalForQuantity,
  normalizeText,
  parseFoodInput,
  parseQuantityInput,
  rankRecentFoods,
  searchFoods,
  type FoodForQuantity,
  type FoodFormValues
} from "./food";

const bread: FoodForQuantity = {
  baseUnit: "g",
  kcalPer100: 265,
  portions: [
    { name: "rebanada", amount: 30 },
    { name: "bocadillo", amount: 80 }
  ]
};

const milk: FoodForQuantity = {
  baseUnit: "ml",
  kcalPer100: 47,
  portions: [{ name: "vaso", amount: 250 }]
};

test("grams convert to kcal from the kcal per 100 g", () => {
  // 265 × 150 / 100 = 397,5 → 398
  assert.equal(kcalForQuantity(bread, { quantity: 150, unit: "g" }), 398);
  assert.equal(kcalForQuantity(bread, { quantity: 100, unit: "g" }), 265);
  assert.equal(kcalForQuantity(bread, { quantity: 0.5, unit: "g" }), 1);
  assert.equal(kcalForQuantity(bread, { quantity: 1, unit: "g" }), 3);
});

test("millilitres convert the same way", () => {
  // 47 × 200 / 100 = 94
  assert.equal(kcalForQuantity(milk, { quantity: 200, unit: "ml" }), 94);
  // A food in ml does not accept grams.
  assert.equal(kcalForQuantity(milk, { quantity: 200, unit: "g" }), null);
});

test("portions multiply their amount in the base unit", () => {
  // 2 rebanadas = 60 g → 265 × 0,6 = 159
  assert.equal(amountInBaseUnit(bread, { quantity: 2, unit: "rebanada" }), 60);
  assert.equal(kcalForQuantity(bread, { quantity: 2, unit: "rebanada" }), 159);
  // Half a bocadillo = 40 g → 106
  assert.equal(kcalForQuantity(bread, { quantity: 0.5, unit: "bocadillo" }), 106);
  // 1 vaso = 250 ml → 117,5 → 118
  assert.equal(kcalForQuantity(milk, { quantity: 1, unit: "vaso" }), 118);
  assert.equal(kcalForQuantity(bread, { quantity: 1, unit: "taza" }), null);
});

test("a food with 0 kcal gives 0 kcal", () => {
  const water: FoodForQuantity = { baseUnit: "ml", kcalPer100: 0, portions: [] };
  assert.equal(kcalForQuantity(water, { quantity: 500, unit: "ml" }), 0);
});

test("quantities are formatted for the diary", () => {
  assert.equal(formatQuantity({ quantity: 150, unit: "g" }), "150 g");
  assert.equal(formatQuantity({ quantity: 1250, unit: "ml" }), "1.250 ml");
  assert.equal(formatQuantity({ quantity: 1.5, unit: "rebanada" }), "1,5 × rebanada");
});

test("the default quantity is the last one used, else a portion, else 100", () => {
  assert.deepEqual(defaultQuantity(bread, { quantity: 3, unit: "rebanada" }), {
    quantity: 3,
    unit: "rebanada"
  });
  assert.deepEqual(defaultQuantity(bread, null), { quantity: 1, unit: "rebanada" });
  // The last portion used was renamed or removed since.
  assert.deepEqual(defaultQuantity(bread, { quantity: 2, unit: "tostada" }), {
    quantity: 1,
    unit: "rebanada"
  });
  assert.deepEqual(defaultQuantity({ ...milk, portions: [] }, null), {
    quantity: 100,
    unit: "ml"
  });
});

test("the quantity picker accepts decimals with comma or dot", () => {
  assert.deepEqual(parseQuantityInput(bread, { quantity: "1,5", unit: "rebanada" }), {
    ok: true,
    value: { quantity: 1.5, unit: "rebanada", kcal: 119 }
  });
  assert.deepEqual(parseQuantityInput(bread, { quantity: " 80.25 ", unit: "g" }), {
    ok: true,
    value: { quantity: 80.25, unit: "g", kcal: 213 }
  });
});

test("the quantity picker rejects bad quantities and units", () => {
  for (const quantity of ["", "0", "-5", "dos", "1,2,3"]) {
    const result = parseQuantityInput(bread, { quantity, unit: "g" });
    assert.equal(result.ok, false, quantity);
  }
  assert.deepEqual(parseQuantityInput(bread, { quantity: "2", unit: "taza" }), {
    ok: false,
    error: "Elige una unidad."
  });
  assert.equal(parseQuantityInput(bread, { quantity: "5001", unit: "g" }).ok, false);
  assert.equal(parseQuantityInput(bread, { quantity: "63", unit: "bocadillo" }).ok, false);
  // 900 kcal/100 g × 5 kg = 45.000 kcal: over the entry limit.
  const oil: FoodForQuantity = { baseUnit: "g", kcalPer100: 900, portions: [] };
  assert.equal(parseQuantityInput(oil, { quantity: "2000", unit: "g" }).ok, false);
});

const emptyFood: FoodFormValues = {
  name: "",
  brand: "",
  baseUnit: "g",
  kcalPer100: "",
  portions: []
};

test("a valid food is normalised and empty portion rows are ignored", () => {
  assert.deepEqual(
    parseFoodInput({
      name: "  Pan   de molde ",
      brand: " Bimbo ",
      baseUnit: "g",
      kcalPer100: "265,25",
      portions: [
        { name: " rebanada ", amount: "30" },
        { name: "", amount: "" },
        { name: "bocadillo", amount: "80,5" }
      ]
    }),
    {
      ok: true,
      value: {
        name: "Pan de molde",
        brand: "Bimbo",
        baseUnit: "g",
        kcalPer100: 265.3,
        portions: [
          { name: "rebanada", amount: 30 },
          { name: "bocadillo", amount: 80.5 }
        ]
      }
    }
  );
  const noBrand = parseFoodInput({ ...emptyFood, name: "Agua", kcalPer100: "0" });
  assert.equal(noBrand.ok && noBrand.value.brand, null);
});

test("the food form rejects missing or out-of-range values", () => {
  const cases: [Partial<FoodFormValues>, string][] = [
    [{ kcalPer100: "100" }, "Escribe el nombre del alimento."],
    [{ name: "Pan", baseUnit: "kg", kcalPer100: "100" }, "Elige gramos o mililitros."],
    [{ name: "Pan", kcalPer100: "" }, "Escribe las kcal por 100 g (0-900)."],
    [{ name: "Pan", kcalPer100: "901" }, "Escribe las kcal por 100 g (0-900)."],
    [
      { name: "Pan", kcalPer100: "265", portions: [{ name: "", amount: "30" }] },
      "Cada porción necesita un nombre."
    ],
    [
      { name: "Pan", kcalPer100: "265", portions: [{ name: "rebanada", amount: "0" }] },
      "Escribe cuántos g son «rebanada» (hasta 5.000)."
    ],
    [
      {
        name: "Pan",
        kcalPer100: "265",
        portions: [
          { name: "Rebanada", amount: "30" },
          { name: "rebanada", amount: "35" }
        ]
      },
      "La porción «rebanada» está repetida."
    ],
    [
      { name: "Pan", kcalPer100: "265", portions: [{ name: "G", amount: "1" }] },
      "«G» ya es la unidad base."
    ]
  ];

  for (const [values, error] of cases) {
    assert.deepEqual(parseFoodInput({ ...emptyFood, ...values }), { ok: false, error });
  }
});

test("the entry name copies the brand", () => {
  assert.equal(foodEntryName({ name: "Pan de molde", brand: "Bimbo" }), "Pan de molde (Bimbo)");
  assert.equal(foodEntryName({ name: "Plátano", brand: null }), "Plátano");
  // Products often bring the brand in the name too.
  assert.equal(foodEntryName({ name: "Nutella", brand: "Nutella" }), "Nutella");
  assert.equal(foodEntryName({ name: "Coca-Cola Zero", brand: "coca-cola" }), "Coca-Cola Zero");
});

test("search ignores accents and case and needs every word", () => {
  const foods = [
    { id: "1", name: "Plátano", brand: null },
    { id: "2", name: "Yogur natural", brand: "Danone" },
    { id: "3", name: "Pan de molde", brand: "Bimbo" },
    { id: "4", name: "Batido de plátano", brand: null },
    { id: "5", name: "Café con leche", brand: null }
  ];
  const ids = (query: string) => searchFoods(foods, query).map(({ id }) => id);

  assert.deepEqual(ids("PLATANO"), ["1", "4"]);
  assert.deepEqual(ids("plát"), ["1", "4"]);
  assert.deepEqual(ids("cafe"), ["5"]);
  assert.deepEqual(ids("danone yogur"), ["2"]);
  assert.deepEqual(ids("molde bimbo"), ["3"]);
  assert.deepEqual(ids("pan leche"), []);
  assert.deepEqual(ids("   "), []);
  // A name that starts with the query ranks before one where a later word does.
  assert.deepEqual(
    searchFoods([foods[3], foods[0]], "platano").map(({ id }) => id),
    ["1", "4"]
  );
  assert.equal(normalizeText("  Ñoquis   CON  Tomate "), "noquis con tomate");
});

test("recents rank by frequency and recency", () => {
  const today = "2026-10-08";
  const uses = [
    // Bread every day of the last week.
    ...[1, 2, 3, 4, 5, 6, 7].map((back) => ({ foodId: "bread", day: `2026-10-0${8 - back}` })),
    // Paella once, yesterday.
    { foodId: "paella", day: "2026-10-07" },
    // Turrón many times, but last Christmas.
    ...[20, 21, 22, 23, 24].map((date) => ({ foodId: "turron", day: `2025-12-${date}` })),
    // Yogurt twice, today and a month ago.
    { foodId: "yogurt", day: "2026-10-08" },
    { foodId: "yogurt", day: "2026-09-08" }
  ];

  assert.deepEqual(rankRecentFoods(uses, today, 10), ["bread", "yogurt", "paella"]);
  assert.deepEqual(rankRecentFoods(uses, today, 1), ["bread"]);
  // Uses in the future (another day being viewed) do not count.
  assert.deepEqual(
    rankRecentFoods(
      [
        { foodId: "a", day: "2026-10-01" },
        { foodId: "b", day: "2026-10-09" }
      ],
      today,
      10
    ),
    ["a"]
  );
  assert.deepEqual(rankRecentFoods([], today, 10), []);
});

test("copied entries keep the saved values even if the food changed", () => {
  const original = {
    day: "2026-10-07",
    meal: "breakfast",
    name: "Pan de molde (Bimbo)",
    quantity: 2,
    unit: "rebanada",
    kcal: 159,
    foodId: "bread",
    source: "library",
    note: null
  };
  // The food is now 300 kcal/100 g, but the copy keeps 159.
  const [copy] = copyEntries([original], "2026-10-08", "dinner");

  assert.deepEqual(copy, {
    day: "2026-10-08",
    meal: "dinner",
    name: "Pan de molde (Bimbo)",
    quantity: 2,
    unit: "rebanada",
    kcal: 159,
    foodId: "bread",
    source: "library",
    note: null
  });
  assert.deepEqual(copyEntries([], "2026-10-08", "lunch"), []);
});

test("a manual entry becomes a food that logs the same kcal again", () => {
  // 90 kcal in 250 ml → 36 kcal/100 ml, and 1 ración = 250 ml.
  const coffee = foodFromEntry({ name: "Café con leche", kcal: 90 }, 250, "ml");
  assert.deepEqual(coffee, {
    name: "Café con leche",
    brand: null,
    baseUnit: "ml",
    kcalPer100: 36,
    portions: [{ name: "ración", amount: 250 }]
  });
  assert.equal(kcalForQuantity(coffee, { quantity: 1, unit: "ración" }), 90);

  // Without the amount: one ración of 100 g with the entry's kcal.
  const stew = foodFromEntry({ name: "Lentejas de mamá", kcal: 430 }, null, "g");
  assert.equal(stew.kcalPer100, 430);
  assert.equal(kcalForQuantity(stew, { quantity: 1, unit: "ración" }), 430);

  // Rounding the kcal per 100 to one decimal still logs the same kcal.
  const biscuit = foodFromEntry({ name: "Galleta", kcal: 95 }, 30, "g");
  assert.equal(kcalForQuantity(biscuit, { quantity: 1, unit: "ración" }), 95);
});
