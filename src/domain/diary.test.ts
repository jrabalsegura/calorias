import assert from "node:assert/strict";
import { test } from "node:test";
import { formatKcal, parseEntryInput, sumDiary } from "./diary";

test("an empty day adds up to zero in every meal", () => {
  assert.deepEqual(sumDiary([]), {
    total: 0,
    byMeal: {
      breakfast: 0,
      midMorning: 0,
      lunch: 0,
      afternoonSnack: 0,
      dinner: 0,
      snack: 0
    }
  });
});

test("entries add up per meal and per day", () => {
  const totals = sumDiary([
    { meal: "breakfast", kcal: 320 },
    { meal: "breakfast", kcal: 95 },
    { meal: "lunch", kcal: 740 },
    { meal: "afternoonSnack", kcal: 0 },
    { meal: "dinner", kcal: 510 },
    { meal: "snack", kcal: 160 },
    { meal: "snack", kcal: 45 }
  ]);

  assert.deepEqual(totals.byMeal, {
    breakfast: 415,
    midMorning: 0,
    lunch: 740,
    afternoonSnack: 0,
    dinner: 510,
    snack: 205
  });
  assert.equal(totals.total, 1870);
  assert.equal(
    totals.total,
    Object.values(totals.byMeal).reduce((sum, kcal) => sum + kcal, 0)
  );
});

test("moving an entry to another meal keeps the day total", () => {
  const before = sumDiary([
    { meal: "lunch", kcal: 300 },
    { meal: "lunch", kcal: 200 }
  ]);
  const after = sumDiary([
    { meal: "lunch", kcal: 300 },
    { meal: "dinner", kcal: 200 }
  ]);

  assert.equal(before.total, after.total);
  assert.equal(after.byMeal.lunch, 300);
  assert.equal(after.byMeal.dinner, 200);
});

test("a valid quick entry is normalised", () => {
  assert.deepEqual(
    parseEntryInput({ meal: "lunch", name: "  Lentejas   con chorizo ", kcal: " 450 " }),
    { ok: true, value: { meal: "lunch", name: "Lentejas con chorizo", kcal: 450 } }
  );
  assert.deepEqual(parseEntryInput({ meal: "snack", name: "", kcal: "0" }), {
    ok: true,
    value: { meal: "snack", name: null, kcal: 0 }
  });
  assert.deepEqual(parseEntryInput({ meal: "snack", name: null, kcal: "89,6" }), {
    ok: true,
    value: { meal: "snack", name: null, kcal: 90 }
  });
  assert.deepEqual(parseEntryInput({ meal: "snack", name: undefined, kcal: "89.4" }), {
    ok: true,
    value: { meal: "snack", name: null, kcal: 89 }
  });
});

test("long names are cut to the maximum length", () => {
  const result = parseEntryInput({ meal: "dinner", name: "a".repeat(200), kcal: "1" });
  assert.equal(result.ok && result.value.name?.length, 80);
});

test("invalid quick entries explain what is wrong", () => {
  for (const kcal of ["", "  ", "abc", "-5", "1e3", "12,", undefined, 42]) {
    const result = parseEntryInput({ meal: "lunch", name: "", kcal });
    assert.equal(result.ok, false, String(kcal));
  }

  assert.deepEqual(parseEntryInput({ meal: "lunch", name: "", kcal: "10001" }), {
    ok: false,
    error: "Como mucho 10.000 kcal por entrada."
  });
  assert.deepEqual(parseEntryInput({ meal: "brunch", name: "", kcal: "100" }), {
    ok: false,
    error: "Elige una comida."
  });
});

test("kcal are formatted the Spanish way", () => {
  assert.equal(formatKcal(0), "0");
  assert.equal(formatKcal(1870), "1.870");
  assert.equal(formatKcal(12500), "12.500");
});
