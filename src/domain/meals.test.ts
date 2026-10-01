import assert from "node:assert/strict";
import { test } from "node:test";
import { isMeal, mealForMinutes, mealLabel, MEALS } from "./meals";

const at = (hours: number, minutes = 0) => hours * 60 + minutes;

test("there are six meals in day order", () => {
  assert.deepEqual(
    MEALS.map(({ id }) => mealLabel(id)),
    ["Desayuno", "Almuerzo", "Comida", "Merienda", "Cena", "Picoteo"]
  );
});

test("the meal is preselected from the time of day", () => {
  assert.equal(mealForMinutes(at(0, 30)), "snack");
  assert.equal(mealForMinutes(at(4, 59)), "snack");
  assert.equal(mealForMinutes(at(5)), "breakfast");
  assert.equal(mealForMinutes(at(8, 15)), "breakfast");
  assert.equal(mealForMinutes(at(10, 59)), "breakfast");
  assert.equal(mealForMinutes(at(11)), "midMorning");
  assert.equal(mealForMinutes(at(13, 29)), "midMorning");
  assert.equal(mealForMinutes(at(13, 30)), "lunch");
  assert.equal(mealForMinutes(at(16, 59)), "lunch");
  assert.equal(mealForMinutes(at(17)), "afternoonSnack");
  assert.equal(mealForMinutes(at(20)), "dinner");
  assert.equal(mealForMinutes(at(23, 59)), "dinner");
});

test("only known meal ids are meals", () => {
  assert.equal(isMeal("lunch"), true);
  assert.equal(isMeal("Comida"), false);
  assert.equal(isMeal(undefined), false);
});
