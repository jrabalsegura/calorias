import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ageOn,
  basalMetabolicRate,
  calculateTarget,
  dailyDeficit,
  dayProgress,
  parseProfileInput,
  type TargetInput
} from "./target";

const TODAY = "2026-10-08";

// Man, 35, 180 cm, 90 kg, moderate activity, 0,5 kg/week, goal 80 kg.
const MAN: TargetInput = {
  sex: "male",
  birthDate: "1991-05-20",
  heightCm: 180,
  weightKg: 90,
  activity: "moderate",
  pace: "moderate",
  targetWeightKg: 80,
  manualTargetKcal: null,
  today: TODAY
};

test("age counts full years and changes on the birthday", () => {
  assert.equal(ageOn("1996-10-08", TODAY), 30);
  assert.equal(ageOn("1996-10-09", TODAY), 29);
  assert.equal(ageOn("1996-11-01", TODAY), 29);
  assert.equal(ageOn("1996-02-29", "2027-02-28"), 30);
  assert.equal(ageOn("1996-02-29", "2027-03-01"), 31);
});

test("Mifflin-St Jeor differs by 166 kcal between men and women", () => {
  // 10·90 + 6,25·180 − 5·35 = 1.850
  assert.equal(
    basalMetabolicRate({ sex: "male", weightKg: 90, heightCm: 180, age: 35 }),
    1855
  );
  assert.equal(
    basalMetabolicRate({ sex: "female", weightKg: 90, heightCm: 180, age: 35 }),
    1689
  );
});

test("each pace has its daily deficit", () => {
  assert.equal(dailyDeficit(0), 0);
  assert.equal(dailyDeficit(0.25), 275);
  assert.equal(dailyDeficit(0.5), 550);
  assert.equal(dailyDeficit(0.75), 825);
});

test("a typical man: basal × activity − deficit, with an estimated date", () => {
  const result = calculateTarget(MAN);

  assert.equal(result.age, 35);
  assert.equal(result.bmr, 1855);
  assert.equal(result.tdee, 2875); // 1.855 × 1,55 = 2.875,25
  assert.equal(result.requestedDeficit, 550);
  assert.equal(result.recommended, 2325);
  assert.equal(result.target, 2325);
  assert.equal(result.kgPerWeek, 0.5);
  assert.equal(result.floorApplied, false);
  assert.equal(result.paceTooFast, false);
  // 10 kg × 7.700 / 550 = 140 days
  assert.equal(result.estimatedDate, "2027-02-25");
  assert.deepEqual(result.notes, []);
});

test("activity levels use their factor", () => {
  const tdee = (activity: TargetInput["activity"]) =>
    calculateTarget({ ...MAN, activity }).tdee;

  assert.equal(tdee("sedentary"), 2226); // 1.855 × 1,2
  assert.equal(tdee("light"), 2551); // × 1,375 = 2.550,6
  assert.equal(tdee("active"), 3200); // × 1,725 = 3.199,9
  assert.equal(tdee("veryActive"), 3525); // × 1,9 = 3.524,5
});

test("a woman below 1.200 kcal is raised to the floor and told why", () => {
  // 30 years, 160 cm, 60 kg, sedentary, fast.
  // Basal 600 + 1.000 − 150 − 161 = 1.289; × 1,2 = 1.546,8 → 1.547; − 825 = 722.
  const result = calculateTarget({
    sex: "female",
    birthDate: "1996-01-15",
    heightCm: 160,
    weightKg: 60,
    activity: "sedentary",
    pace: "fast",
    targetWeightKg: 55,
    manualTargetKcal: null,
    today: TODAY
  });

  assert.equal(result.tdee, 1547);
  assert.equal(result.floorApplied, true);
  assert.equal(result.target, 1200);
  // Real deficit 347 kcal → 347 × 7 / 7.700 = 0,315 kg/week.
  assert.equal(result.kgPerWeek, 0.32);
  // 5 kg × 7.700 / 347 = 110,95 → 111 days.
  assert.equal(result.estimatedDate, "2027-01-27");
  assert.deepEqual(result.notes, [
    "Con el ritmo rápido te tocarían 722 kcal, por debajo del mínimo de 1.200 kcal para mujeres. " +
      "El objetivo se queda en 1.200 kcal, así que bajarás unos 0,32 kg por semana en lugar de 0,75."
  ]);
});

test("a man is never below 1.500 kcal", () => {
  // 60 years, 160 cm, 50 kg: basal 1.205; × 1,2 = 1.446; − 825 = 621.
  const result = calculateTarget({
    ...MAN,
    birthDate: "1966-01-01",
    heightCm: 160,
    weightKg: 50,
    targetWeightKg: 48,
    activity: "sedentary",
    pace: "fast"
  });

  assert.equal(result.target, 1500);
  assert.equal(result.minimum, 1500);
  assert.equal(result.floorApplied, true);
  assert.match(result.notes[0], /mínimo de 1\.500 kcal para hombres/);
});

test("when even the energy spent is below the floor there is no deficit", () => {
  // 70 years, 150 cm, 45 kg: basal 876,5; × 1,2 = 1.051,8 → 1.052.
  const result = calculateTarget({
    sex: "female",
    birthDate: "1956-01-01",
    heightCm: 150,
    weightKg: 45,
    activity: "sedentary",
    pace: "gentle",
    targetWeightKg: 42,
    manualTargetKcal: null,
    today: TODAY
  });

  assert.equal(result.tdee, 1052);
  assert.equal(result.target, 1200);
  assert.equal(result.estimatedDate, null);
  assert.equal(result.notes.length, 1);
  assert.match(result.notes[0], /no habrá déficit/);
});

test("a pace above 1 % of body weight per week warns but is kept", () => {
  // Woman, 25, 165 cm, 55 kg, very active: basal 1.295,25; × 1,9 → 2.461.
  const result = calculateTarget({
    sex: "female",
    birthDate: "2001-01-01",
    heightCm: 165,
    weightKg: 55,
    activity: "veryActive",
    pace: "fast",
    targetWeightKg: 52,
    manualTargetKcal: null,
    today: TODAY
  });

  assert.equal(result.target, 1636);
  assert.equal(result.kgPerWeek, 0.75); // > 0,55 kg (1 % of 55)
  assert.equal(result.paceTooFast, true);
  assert.match(result.notes[0], /más del 1 % de tu peso/);
});

test("0,75 kg/week at 90 kg is within 1 %", () => {
  assert.equal(calculateTarget({ ...MAN, pace: "fast" }).paceTooFast, false);
});

test("maintaining eats what you spend and has no date", () => {
  const result = calculateTarget({ ...MAN, pace: "maintain" });

  assert.equal(result.target, 2875);
  assert.equal(result.estimatedDate, null);
  assert.deepEqual(result.notes, [
    "Con el ritmo «Mantener» no hay fecha estimada para tu peso objetivo."
  ]);
});

test("a goal weight already reached suggests maintaining", () => {
  const result = calculateTarget({ ...MAN, targetWeightKg: 92 });

  assert.equal(result.estimatedDate, null);
  assert.match(result.notes[0], /«Mantener»/);
});

test("a manual target replaces the formula and drives the date", () => {
  const result = calculateTarget({ ...MAN, manualTargetKcal: 2000 });

  assert.equal(result.isManual, true);
  assert.equal(result.recommended, 2325);
  assert.equal(result.target, 2000);
  // 875 kcal/day → 0,795 kg/week; 77.000 / 875 = 88 days.
  assert.equal(result.kgPerWeek, 0.8);
  assert.equal(result.estimatedDate, addDaysForTest(88));
  assert.deepEqual(result.notes, []);
});

test("a manual target below the floor is kept with a warning", () => {
  const result = calculateTarget({ ...MAN, manualTargetKcal: 1400 });

  assert.equal(result.target, 1400);
  assert.match(result.notes[0], /por debajo del mínimo recomendado de 1\.500 kcal/);
});

test("a manual target above the energy spent never reaches the goal", () => {
  const result = calculateTarget({ ...MAN, manualTargetKcal: 3000 });

  assert.equal(result.estimatedDate, null);
  assert.deepEqual(result.notes, [
    "Con este objetivo no hay déficit: no llegarás a tu peso objetivo."
  ]);
});

test("day progress: remaining kcal and going over", () => {
  assert.deepEqual(dayProgress(0, 2000), {
    consumed: 0,
    target: 2000,
    remaining: 2000,
    over: false,
    fill: 0
  });
  assert.deepEqual(dayProgress(1500, 2000), {
    consumed: 1500,
    target: 2000,
    remaining: 500,
    over: false,
    fill: 0.75
  });
  assert.equal(dayProgress(2000, 2000).over, false);
  assert.deepEqual(dayProgress(2300, 2000), {
    consumed: 2300,
    target: 2000,
    remaining: -300,
    over: true,
    fill: 1
  });
});

const VALID_FORM = {
  sex: "male",
  birthDate: "1991-05-20",
  heightCm: "180",
  weightKg: "90,45",
  targetWeightKg: "80.0",
  activity: "moderate",
  pace: "moderate",
  manualTargetKcal: ""
};

test("a valid profile form is normalised", () => {
  assert.deepEqual(parseProfileInput(VALID_FORM, TODAY), {
    ok: true,
    value: {
      sex: "male",
      birthDate: "1991-05-20",
      heightCm: 180,
      weightKg: 90.5,
      targetWeightKg: 80,
      activity: "moderate",
      pace: "moderate",
      manualTargetKcal: null
    }
  });

  const manual = parseProfileInput(
    { ...VALID_FORM, manualTargetKcal: " 1950,4 " },
    TODAY
  );
  assert.equal(manual.ok && manual.value.manualTargetKcal, 1950);
});

test("invalid profile forms explain what is wrong", () => {
  const error = (changes: Record<string, unknown>) => {
    const result = parseProfileInput({ ...VALID_FORM, ...changes }, TODAY);
    return result.ok ? null : result.error;
  };

  const failed = parseProfileInput({ ...VALID_FORM, heightCm: "" }, TODAY);
  assert.equal(!failed.ok && failed.field, "heightCm");

  assert.equal(error({ sex: "other" }), "Elige tu sexo.");
  assert.equal(error({ birthDate: "1991-02-30" }), "Escribe tu fecha de nacimiento.");
  assert.equal(
    error({ birthDate: "2008-10-09" }),
    "La fórmula es para adultos de 18 a 100 años."
  );
  assert.equal(error({ birthDate: "2008-10-08" }), null);
  assert.equal(
    error({ heightCm: "1,80" }),
    "Escribe tu altura en centímetros (120-230)."
  );
  assert.equal(error({ weightKg: "" }), "Escribe tu peso actual en kg (30-300).");
  assert.equal(
    error({ targetWeightKg: "-70" }),
    "Escribe tu peso objetivo en kg (30-300)."
  );
  assert.equal(error({ activity: "couch" }), "Elige tu nivel de actividad.");
  assert.equal(error({ pace: "turbo" }), "Elige un ritmo.");
  assert.equal(
    error({ manualTargetKcal: "500" }),
    "El objetivo manual tiene que estar entre 800 y 6.000 kcal."
  );
});

function addDaysForTest(days: number) {
  const date = new Date(Date.UTC(2026, 9, 8 + days));
  return date.toISOString().slice(0, 10);
}

test("an adaptive expenditure replaces the formula and keeps the safety floor", () => {
  const formula = calculateTarget(MAN);
  const adaptive = calculateTarget({ ...MAN, adaptiveTdee: 2400 });
  assert.equal(adaptive.formulaTdee, formula.tdee);
  assert.equal(adaptive.tdee, 2400);
  assert.equal(adaptive.tdeeIsAdaptive, true);
  assert.equal(formula.tdeeIsAdaptive, false);
  assert.equal(adaptive.target, 1850);
  assert.equal(adaptive.kgPerWeek, 0.5);

  const low = calculateTarget({ ...MAN, adaptiveTdee: 1800 });
  assert.equal(low.target, 1500);
  assert.equal(low.floorApplied, true);
});
