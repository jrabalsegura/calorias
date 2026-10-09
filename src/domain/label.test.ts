import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseFoodInput } from "./food";
import {
  checkLabelEnergy,
  labelFormValues,
  parseLabelImage,
  parseLabelReading,
  scaledSize,
  type LabelReading
} from "./label";

const NO_MACROS = { protein: null, carbs: null, fat: null };

/** An answer of the AI as the schema asks for it; tests change what they need. */
function answer(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    readable: true,
    problem: "",
    name: "Galletas de avena",
    brand: "Gullón",
    baseUnit: "g",
    basis: "per100",
    energyKcal: 452,
    energyKj: 1898,
    protein: 7.1,
    carbs: 66,
    fat: 16,
    servingAmount: 30,
    ...patch
  };
}

function read(patch: Record<string, unknown> = {}): LabelReading {
  const result = parseLabelReading(answer(patch));
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result.reading;
}

test("a clear label: values per 100, macros kept and the serving as a portion", () => {
  assert.deepEqual(read(), {
    name: "Galletas de avena",
    brand: "Gullón",
    baseUnit: "g",
    kcalPer100: 452,
    proteinPer100: 7.1,
    carbsPer100: 66,
    fatPer100: 16,
    servingAmount: 30,
    warnings: []
  });
});

test("the form gets the reading and passes the food validation", () => {
  const values = labelFormValues(read({ energyKcal: 452.5, energyKj: 1900 }));
  assert.deepEqual(values, {
    name: "Galletas de avena",
    brand: "Gullón",
    baseUnit: "g",
    kcalPer100: "452,5",
    portions: [{ name: "ración", amount: "30" }]
  });
  assert.ok(parseFoodInput(values).ok);
});

test("only kJ: kcal worked out from them, with a warning", () => {
  const reading = read({ energyKcal: null, energyKj: 1898 });
  assert.equal(reading.kcalPer100, 453.6);
  assert.match(reading.warnings[0], /solo trae kJ/);
});

test("the kJ figure read as kcal too is corrected", () => {
  const reading = read({ energyKcal: 1898, energyKj: 1898 });
  assert.equal(reading.kcalPer100, 453.6);
  assert.match(reading.warnings[0], /eran los kJ/);
});

test("kJ and kcal in each other's field are swapped back", () => {
  const reading = read({ energyKcal: 1898, energyKj: 452 });
  assert.equal(reading.kcalPer100, 452);
  assert.match(reading.warnings[0], /estaban cambiados/);
});

test("kcal and kJ that disagree keep the kcal and ask to check", () => {
  const reading = read({ energyKcal: 352, energyKj: 1898 });
  assert.equal(reading.kcalPer100, 352);
  assert.ok(reading.warnings.some((warning) => /no cuadran: comprueba/.test(warning)));
});

test("a single energy figure over 900 is taken as kJ", () => {
  const reading = read({ energyKcal: 1898, energyKj: null });
  assert.equal(reading.kcalPer100, 453.6);
  assert.match(reading.warnings[0], /parece estar en kJ/);
});

test("a single energy figure that only the macros reveal as kJ is converted", () => {
  // Natural yogurt: 61 kcal = 255 kJ; 4·3.5 + 4·4.7 + 9·3.3 ≈ 62.
  const reading = read({ energyKcal: 255, energyKj: null, protein: 3.5, carbs: 4.7, fat: 3.3 });
  assert.equal(reading.kcalPer100, 60.9);
  assert.match(reading.warnings[0], /parece estar en kJ/);
});

test("kcal that do not match the macros give a warning", () => {
  const reading = read({ energyKcal: 250, energyKj: 1046 });
  assert.equal(reading.kcalPer100, 250);
  assert.deepEqual(reading.warnings, [
    "Las kcal no cuadran con proteína, hidratos y grasa (darían unas 436): compruébalas con la etiqueta."
  ]);
});

test("no energy at all leaves the kcal to the user", () => {
  const reading = read({ energyKcal: null, energyKj: null });
  assert.equal(reading.kcalPer100, null);
  assert.deepEqual(reading.warnings, ["No se leen las calorías: escríbelas tú."]);
  assert.equal(labelFormValues(reading).kcalPer100, "");
});

test("impossible energy is dropped", () => {
  const result = checkLabelEnergy(5000, null, NO_MACROS, "g");
  assert.equal(result.kcalPer100, null);
  assert.match(result.warnings.at(-1)!, /no es posible/);
});

test("values per serving go to per 100 with the serving size", () => {
  const reading = read({
    basis: "perServing",
    energyKcal: 136,
    energyKj: 569,
    protein: 2.1,
    carbs: 19.8,
    fat: 4.8,
    servingAmount: 30
  });
  assert.equal(reading.kcalPer100, 453.3);
  assert.equal(reading.proteinPer100, 7);
  assert.equal(reading.fatPer100, 16);
  assert.match(reading.warnings[0], /solo da valores por ración \(30 g\)/);
});

test("values per serving without its size leave the kcal to the user", () => {
  const reading = read({ basis: "perServing", servingAmount: null });
  assert.equal(reading.kcalPer100, null);
  assert.equal(reading.proteinPer100, null);
  assert.match(reading.warnings[0], /no dice de cuánto es/);
});

test("drinks are per 100 ml; impossible macros and servings are ignored", () => {
  const reading = read({
    name: "Bebida de avena",
    baseUnit: "ml",
    energyKcal: 45,
    energyKj: 189,
    protein: 1,
    carbs: 7.2,
    fat: 150,
    servingAmount: 0
  });
  assert.equal(reading.baseUnit, "ml");
  assert.equal(reading.fatPer100, null);
  assert.equal(reading.servingAmount, null);
  assert.deepEqual(labelFormValues(reading).portions, []);
});

test("the AI's doubts and a missing name become warnings", () => {
  const reading = read({ problem: "Foto borrosa, la grasa no se lee bien.", name: "  " });
  assert.equal(reading.name, null);
  assert.deepEqual(reading.warnings, [
    "Al leerla: Foto borrosa, la grasa no se lee bien. Revisa los valores.",
    "La foto no muestra el nombre: escríbelo tú."
  ]);
});

test("an unreadable photo is an error that asks for another one", () => {
  const result = parseLabelReading(answer({ readable: false, problem: "No hay tabla nutricional." }));
  assert.deepEqual(result, {
    ok: false,
    error:
      "No se lee la tabla nutricional (No hay tabla nutricional). Haz otra foto de frente y con buena luz, o escribe los datos a mano."
  });
  assert.equal(parseLabelReading("nada").ok, false);
});

test("the photo must be a base64 image of an accepted type and size", () => {
  const data = "A".repeat(200);
  assert.ok(parseLabelImage({ data, mediaType: "image/jpeg" }).ok);
  assert.equal(parseLabelImage({ data, mediaType: "image/gif" }).ok, false);
  assert.equal(parseLabelImage({ data: "no es base64!", mediaType: "image/png" }).ok, false);
  assert.equal(parseLabelImage({ data: "A".repeat(5_000_004), mediaType: "image/png" }).ok, false);
});

test("photos are reduced to 1.500 px on the longest side, never enlarged", () => {
  assert.deepEqual(scaledSize(4032, 3024), { width: 1500, height: 1125 });
  assert.deepEqual(scaledSize(3024, 4032), { width: 1125, height: 1500 });
  assert.deepEqual(scaledSize(800, 600), { width: 800, height: 600 });
});

// Real answers of the AI to label photos (scripts/eval-label.ts --save),
// with what each one should end up as.
const FIXTURES = join(process.cwd(), "tests/fixtures/label");
for (const file of existsSync(FIXTURES) ? readdirSync(FIXTURES).filter((f) => f.endsWith(".json")) : []) {
  test(`saved answer: ${file}`, () => {
    const { answer: raw, expected } = JSON.parse(readFileSync(join(FIXTURES, file), "utf8"));
    const result = parseLabelReading(raw);
    if (expected.error) {
      assert.equal(result.ok, false);
      return;
    }
    assert.ok(result.ok);
    const { reading } = result;
    assert.equal(reading.baseUnit, expected.baseUnit);
    assert.ok(
      reading.kcalPer100 !== null && Math.abs(reading.kcalPer100 - expected.kcalPer100) <= 1,
      `${reading.kcalPer100} kcal, expected ${expected.kcalPer100}`
    );
    for (const pattern of expected.warnings ?? []) {
      assert.ok(
        reading.warnings.some((warning) => new RegExp(pattern).test(warning)),
        `no warning like /${pattern}/ in ${JSON.stringify(reading.warnings)}`
      );
    }
    if (!expected.warnings) assert.deepEqual(reading.warnings, []);
  });
}
