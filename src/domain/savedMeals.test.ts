import assert from "node:assert/strict";
import test from "node:test";
import { copyEntries } from "./food";
import {
  MAX_SAVED_MEAL_NAME_LENGTH,
  parseSavedMealName,
  savedMealItems,
  savedMealSummary
} from "./savedMeals";

test("saved meal names are trimmed and must not be empty or too long", () => {
  assert.deepEqual(parseSavedMealName("  Almuerzo   de  siempre "), {
    ok: true,
    value: "Almuerzo de siempre"
  });
  assert.equal(parseSavedMealName("   ").ok, false);
  assert.equal(parseSavedMealName(undefined).ok, false);
  assert.equal(parseSavedMealName("a".repeat(MAX_SAVED_MEAL_NAME_LENGTH)).ok, true);
  assert.equal(parseSavedMealName("a".repeat(MAX_SAVED_MEAL_NAME_LENGTH + 1)).ok, false);
});

test("a saved meal copies the entries in order and logs them again unchanged", () => {
  const entries = [
    {
      name: "Pan de molde (Bimbo)",
      quantity: 2,
      unit: "rebanada",
      kcal: 159,
      foodId: "bread",
      source: "library",
      note: null
    },
    {
      name: null,
      quantity: null,
      unit: null,
      kcal: 40,
      foodId: null,
      source: "manual",
      note: null
    }
  ];
  const items = savedMealItems(entries);

  assert.deepEqual(
    items.map(({ position, name, kcal }) => ({ position, name, kcal })),
    [
      { position: 0, name: "Pan de molde (Bimbo)", kcal: 159 },
      { position: 1, name: null, kcal: 40 }
    ]
  );
  // Logging it on another day gives the same entries as the originals.
  assert.deepEqual(
    copyEntries(items, "2026-10-23", "midMorning"),
    copyEntries(entries, "2026-10-23", "midMorning")
  );
});

test("the summary lists the first names and counts the rest", () => {
  assert.equal(savedMealSummary([]), "");
  assert.equal(savedMealSummary([{ name: "Café" }]), "Café");
  assert.equal(
    savedMealSummary([{ name: "Tostada" }, { name: null }]),
    "Tostada y Entrada rápida"
  );
  assert.equal(
    savedMealSummary([{ name: "A" }, { name: "B" }, { name: "C" }]),
    "A, B y C"
  );
  assert.equal(
    savedMealSummary([{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }, { name: "E" }]),
    "A, B, C y 2 más"
  );
});
