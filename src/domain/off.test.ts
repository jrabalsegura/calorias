import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseFoodInput } from "./food";
import { mapOffProduct, offFormValues, parseOffResponse, type OffProduct } from "./off";

// Real answers of the OFF API (tests/fixtures/off), trimmed to the fields
// asked for. Variants built from them are marked as such.
function fixture(name: string): { code: string; product?: Record<string, unknown> } {
  return JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/off", `${name}.json`), "utf8"));
}

function found(name: string): OffProduct {
  const body = fixture(name);
  const result = parseOffResponse(body.code, body);
  assert.equal(result.kind, "found");
  return result.product;
}

test("Nutella: kcal, macros, first brand, image and no portion for a 400 g jar", () => {
  assert.deepEqual(found("nutella"), {
    barcode: "3017620422003",
    name: "Nutella",
    brand: "Nutella",
    baseUnit: "g",
    kcalPer100: 539,
    proteinPer100: 6.3,
    carbsPer100: 57.5,
    fatPer100: 30.9,
    portions: [],
    imageUrl:
      "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.200.jpg",
    warnings: []
  });
});

test("Coca-Cola: measured in ml, the can is one envase", () => {
  const product = found("coca-cola");
  assert.equal(product.name, "Coca-Cola Original");
  assert.equal(product.brand, "COCA-COLA SERVICES SA/NV");
  assert.equal(product.baseUnit, "ml");
  assert.equal(product.kcalPer100, 42.4);
  // The serving is the whole can, so it is not repeated as "ración".
  assert.deepEqual(product.portions, [{ name: "envase", amount: 330 }]);
  assert.deepEqual(product.warnings, []);
});

test("a product without quantity or brand still maps", () => {
  const product = found("picos-sin-envase");
  assert.equal(product.name, "Mix de picos aove");
  assert.equal(product.brand, null);
  assert.equal(product.baseUnit, "g");
  assert.equal(product.kcalPer100, 424);
  assert.deepEqual(product.portions, []);
  assert.deepEqual(product.warnings, []);
});

test("a product without energy asks for the kcal", () => {
  const product = found("canela-sin-kcal");
  assert.equal(product.name, "Canela molida");
  assert.equal(product.brand, "MERCADONA");
  assert.equal(product.kcalPer100, null);
  assert.equal(product.proteinPer100, null);
  assert.deepEqual(product.portions, [{ name: "envase", amount: 52 }]);
  assert.deepEqual(product.warnings, ["No trae las calorías: escríbelas tú."]);
});

test("a code OFF does not know is not found", () => {
  const body = fixture("no-encontrado");
  assert.deepEqual(parseOffResponse(body.code, body), { kind: "notFound" });
  assert.deepEqual(parseOffResponse("3017620422003", "<html>"), { kind: "notFound" });
});

// Variants of the Nutella answer for data OFF sometimes brings.
function nutellaWith(nutriments: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const { product } = fixture("nutella");
  return mapOffProduct("3017620422003", { ...product, ...extra, nutriments });
}

test("kcal are worked out from kJ when that is all there is", () => {
  const product = nutellaWith({
    "energy-kj_100g": 2252,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9
  });
  assert.equal(product.kcalPer100, 538.2);
  assert.deepEqual(product.warnings, [
    "Solo traía la energía en kJ: las kcal están calculadas a partir de ella."
  ]);

  // Older answers only bring the generic energy, which is in kJ.
  assert.equal(nutellaWith({ energy_100g: "2252" }).kcalPer100, 538.2);
});

test("kJ typed as kcal are rejected and flagged", () => {
  const product = nutellaWith({ "energy-kcal_100g": 2252, "energy-kj_100g": 2252 });
  assert.equal(product.kcalPer100, null);
  assert.deepEqual(product.warnings, [
    "Las kcal y los kJ no cuadran: comprueba las kcal con la etiqueta.",
    "Trae 2.252 kcal por 100 g, que no es posible: escríbelas tú."
  ]);
});

test("kcal that do not match the macros or the kJ are flagged but kept", () => {
  const macros = nutellaWith({
    "energy-kcal_100g": 239,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9
  });
  assert.equal(macros.kcalPer100, 239);
  assert.deepEqual(macros.warnings, [
    "Las kcal no cuadran con proteína, hidratos y grasa (darían unas 533): compruébalas con la etiqueta."
  ]);

  const kj = nutellaWith({ "energy-kcal_100g": 539, "energy-kj_100g": 1000 });
  assert.deepEqual(kj.warnings, [
    "Las kcal y los kJ no cuadran: comprueba las kcal con la etiqueta."
  ]);
});

test("serving and small package become portions in the base unit", () => {
  const yogurt = nutellaWith(
    { "energy-kcal_100g": 95 },
    {
      product_quantity: "125",
      product_quantity_unit: "g",
      serving_quantity: "62.5",
      serving_quantity_unit: "g"
    }
  );
  assert.deepEqual(yogurt.portions, [
    { name: "ración", amount: 62.5 },
    { name: "envase", amount: 125 }
  ]);

  // A serving in another unit cannot be converted, so it is left out.
  const mixed = nutellaWith(
    { "energy-kcal_100g": 95 },
    { serving_quantity: 15, serving_quantity_unit: "ml" }
  );
  assert.deepEqual(mixed.portions, []);
});

test("the liquid unit is taken from the quantity text when OFF gives no unit", () => {
  const product = nutellaWith(
    { "energy-kcal_100g": 47 },
    {
      product_quantity: undefined,
      product_quantity_unit: undefined,
      serving_quantity_unit: undefined,
      quantity: "1 l"
    }
  );
  assert.equal(product.baseUnit, "ml");
});

test("names fall back to the generic name; images only from OFF", () => {
  const product = mapOffProduct("3017620422003", {
    generic_name: "  Crema   de cacao ",
    brands: "",
    image_front_small_url: "https://evil.example/x.jpg",
    image_url: "http://images.openfoodfacts.org/x.jpg",
    nutriments: { "energy-kcal_100g": 500 }
  });
  assert.equal(product.name, "Crema de cacao");
  assert.equal(product.brand, null);
  assert.equal(product.imageUrl, null);
});

test("the prefilled form is valid for complete products and uses commas", () => {
  const values = offFormValues(found("coca-cola"));
  assert.deepEqual(values, {
    name: "Coca-Cola Original",
    brand: "COCA-COLA SERVICES SA/NV",
    baseUnit: "ml",
    kcalPer100: "42,4",
    portions: [{ name: "envase", amount: "330" }]
  });
  assert.equal(parseFoodInput(values).ok, true);

  const canela = parseFoodInput(offFormValues(found("canela-sin-kcal")));
  assert.equal(canela.ok, false);
});
