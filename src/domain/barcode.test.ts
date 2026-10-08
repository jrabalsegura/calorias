import assert from "node:assert/strict";
import { test } from "node:test";
import { expandUpcE, lookupBarcode, normalizeBarcode, parseScanExtras } from "./barcode";
import type { OffLookup, OffProduct } from "./off";

test("normalizeBarcode accepts EAN-13 and EAN-8 with a valid check digit", () => {
  assert.equal(normalizeBarcode("3017620422003"), "3017620422003");
  assert.equal(normalizeBarcode(" 5449 0000 00996 "), "5449000000996");
  assert.equal(normalizeBarcode("96385074"), "96385074");
});

test("normalizeBarcode rejects wrong check digits, letters and odd lengths", () => {
  assert.equal(normalizeBarcode("3017620422004"), null);
  assert.equal(normalizeBarcode("301762042200a"), null);
  assert.equal(normalizeBarcode("12345"), null);
  assert.equal(normalizeBarcode(""), null);
});

test("normalizeBarcode turns UPC-A and GTIN-14 into the same EAN-13", () => {
  assert.equal(normalizeBarcode("036000291452"), "0036000291452");
  assert.equal(normalizeBarcode("0036000291452"), "0036000291452");
  assert.equal(normalizeBarcode("00036000291452"), "0036000291452");
});

test("UPC-E codes are expanded so they match their UPC-A", () => {
  assert.equal(expandUpcE("04252614"), "042100005264");
  // Wrong check digit, and number systems other than 0 and 1.
  assert.equal(expandUpcE("04252615"), null);
  assert.equal(expandUpcE("24252614"), null);

  assert.equal(normalizeBarcode("04252614", "upc_e"), "0042100005264");
  // Typed without the format: not a valid EAN-8, but a valid UPC-E.
  assert.equal(normalizeBarcode("04252614"), "0042100005264");
});

const nutella: OffProduct = {
  barcode: "3017620422003",
  name: "Nutella",
  brand: "Nutella",
  baseUnit: "g",
  kcalPer100: 539,
  proteinPer100: 6.3,
  carbsPer100: 57.5,
  fatPer100: 30.9,
  portions: [],
  imageUrl: "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.200.jpg",
  warnings: []
};

function fakeStore(offAnswer: OffLookup) {
  const foods = new Map<string, { id: string; name: string; barcode: string }>();
  const calls = { off: 0 };
  return {
    calls,
    foods,
    deps: {
      findFood: async (barcode: string) => foods.get(barcode) ?? null,
      fetchOff: async () => {
        calls.off++;
        return offAnswer;
      },
      createFood: async (input: { name: string; barcode: string }) => {
        const food = { id: `food-${foods.size + 1}`, name: input.name, barcode: input.barcode };
        foods.set(input.barcode, food);
        return food;
      }
    }
  };
}

test("a product is saved from Open Food Facts and the second scan does not query it", async () => {
  const store = fakeStore({ kind: "found", product: nutella });

  const first = await lookupBarcode("3017620422003", store.deps);
  assert.equal(first.kind, "food");
  assert.equal(store.calls.off, 1);
  assert.equal(store.foods.size, 1);

  const second = await lookupBarcode("3017620422003", store.deps);
  assert.deepEqual(second, { kind: "food", food: store.foods.get("3017620422003"), warnings: [] });
  assert.equal(store.calls.off, 1);
});

test("the saved product keeps the barcode, image and macros", async () => {
  let saved: unknown = null;
  await lookupBarcode("3017620422003", {
    findFood: async () => null,
    fetchOff: async () => ({ kind: "found", product: nutella }),
    createFood: async (input) => {
      saved = input;
      return input;
    }
  });
  assert.deepEqual(saved, {
    name: "Nutella",
    brand: "Nutella",
    baseUnit: "g",
    kcalPer100: 539,
    portions: [],
    barcode: "3017620422003",
    imageUrl: nutella.imageUrl,
    proteinPer100: 6.3,
    carbsPer100: 57.5,
    fatPer100: 30.9
  });
});

test("products without kcal or name are not saved: the user completes them", async () => {
  for (const product of [
    { ...nutella, kcalPer100: null },
    { ...nutella, name: null }
  ]) {
    const store = fakeStore({ kind: "found", product });
    const result = await lookupBarcode(product.barcode, store.deps);
    assert.equal(result.kind, "incomplete");
    assert.equal(store.foods.size, 0);
  }
});

test("a product missing from Open Food Facts is reported as not found", async () => {
  const store = fakeStore({ kind: "notFound" });
  assert.deepEqual(await lookupBarcode("8480000101853", store.deps), {
    kind: "notFound",
    barcode: "8480000101853"
  });
  assert.equal(store.foods.size, 0);
});

test("parseScanExtras checks the barcode, the image host and the macros", () => {
  assert.deepEqual(
    parseScanExtras({
      barcode: "036000291452",
      imageUrl: "https://images.openfoodfacts.org/a.jpg",
      proteinPer100: 3,
      carbsPer100: 150,
      fatPer100: "2"
    }),
    {
      barcode: "0036000291452",
      imageUrl: "https://images.openfoodfacts.org/a.jpg",
      proteinPer100: 3,
      carbsPer100: null,
      fatPer100: null
    }
  );
  assert.equal(parseScanExtras({ barcode: "123" }), null);
  assert.equal(
    parseScanExtras({ barcode: "3017620422003", imageUrl: "https://evil.example/a.jpg" })?.imageUrl,
    null
  );
});
