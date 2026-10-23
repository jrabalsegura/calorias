import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  buildMealPhotoPrompt,
  MAX_HINT_LENGTH,
  MEAL_PHOTO_SYSTEM_PROMPT,
  NO_FOOD_IN_PHOTO,
  parseHint
} from "./mealPhoto";
import { numberLibrary, parseEstimate } from "./textEstimate";

const library = numberLibrary([
  {
    id: "bread",
    name: "Pan de molde",
    brand: "Bimbo",
    baseUnit: "g",
    kcalPer100: 250,
    portions: [{ name: "rebanada", amount: 30 }]
  }
]);

test("the note is optional, tidied up and not too long", () => {
  assert.deepEqual(parseHint(undefined), { ok: true, value: "" });
  assert.deepEqual(parseHint("  media   ración "), { ok: true, value: "media ración" });
  assert.equal(parseHint("a".repeat(MAX_HINT_LENGTH + 1)).ok, false);
});

test("the prompt has the library and the note, or says there is none", () => {
  const prompt = buildMealPhotoPrompt("con mi pan de molde", library);
  assert.match(prompt, /#1 Pan de molde \(Bimbo\): 250 kcal\/100 g; porciones: rebanada = 30 g/);
  assert.match(prompt, /<nota>\ncon mi pan de molde\n<\/nota>/);
  assert.match(buildMealPhotoPrompt("", []), /\(no tiene alimentos guardados\)[\s\S]*\(sin nota\)/);
});

test("the system prompt asks for scale, the note first and oil apart only when not fried", () => {
  assert.match(MEAL_PHOTO_SYSTEM_PROMPT, /tamaño del plato/);
  assert.match(MEAL_PHOTO_SYSTEM_PROMPT, /nota que acompaña a la foto manda/);
  assert.match(MEAL_PHOTO_SYSTEM_PROMPT, /ya frito, que incluyen el aceite/);
  assert.match(MEAL_PHOTO_SYSTEM_PROMPT, /línea aparte llamada «Aceite de oliva \(cocinado\)»/);
});

test("a photo without food is an error with its own message", () => {
  assert.deepEqual(parseEstimate({ items: [] }, library, NO_FOOD_IN_PHOTO), {
    ok: false,
    error: NO_FOOD_IN_PHOTO
  });
});

test("an answer about a photo is checked like a description", () => {
  const result = parseEstimate(
    {
      items: [
        {
          name: "Macarrones con tomate",
          amount: 320.4,
          unit: "g",
          kcalPer100: 150,
          libraryRef: null,
          assumption: "plato hondo lleno ≈ 320 g",
          confidence: "medium",
          cookingOil: false
        },
        {
          name: "Pan de molde",
          amount: 60,
          unit: "g",
          kcalPer100: 999,
          libraryRef: 1,
          assumption: "2 rebanadas",
          confidence: "high",
          cookingOil: false
        }
      ]
    },
    library,
    NO_FOOD_IN_PHOTO
  );
  assert.ok(result.ok);
  assert.deepEqual(
    result.items.map(({ name, amount, kcal, foodId }) => ({ name, amount, kcal, foodId })),
    [
      { name: "Macarrones con tomate", amount: 320, kcal: 480, foodId: null },
      { name: "Pan de molde", amount: 60, kcal: 150, foodId: "bread" }
    ]
  );
});

// Real answers of the AI to photos of meals (scripts/eval-photo.ts --save),
// reviewed by hand, with the total they add up to (or none, without food).
// None of them uses the library.
const FIXTURES = join(process.cwd(), "tests/fixtures/photo");
for (const file of existsSync(FIXTURES) ? readdirSync(FIXTURES).filter((f) => f.endsWith(".json")) : []) {
  test(`saved answer: ${file}`, () => {
    const { answer: raw, expected } = JSON.parse(readFileSync(join(FIXTURES, file), "utf8"));
    const result = parseEstimate(raw, library, NO_FOOD_IN_PHOTO);
    if (expected.error) {
      assert.deepEqual(result, { ok: false, error: NO_FOOD_IN_PHOTO });
      return;
    }
    assert.ok(result.ok);
    assert.ok(result.items.every(({ foodId }) => foodId === null));
    assert.equal(
      result.items.reduce((sum, { kcal }) => sum + kcal, 0),
      expected.kcal
    );
  });
}
