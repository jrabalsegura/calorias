import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkInMessage,
  checkInWindow,
  estimateExpenditure,
  MAX_WEEKLY_CHANGE_KCAL,
  previousEstimate,
  proposeTarget
} from "./adaptive";
import { addDays } from "./day";
import { indexDays, type DayRecord } from "./summary";
import { calculateTarget, type TargetInput } from "./target";
import type { WeighIn } from "./weight";

// Monday: the check-in uses 14 Sep - 11 Oct.
const TODAY = "2026-10-12";
const WINDOW = checkInWindow(TODAY);

// Man, 35, 180 cm, ~90 kg, moderate activity: formula expenditure 2.875.
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

/** One record per day for `count` days ending on `end`, from a kcal function. */
function logDays(end: string, count: number, kcal: (index: number) => number | null) {
  const records: DayRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = kcal(index);
    if (value === null) continue;
    records.push({ day: addDays(end, index - count + 1), kcal: value, entries: 3, mark: null });
  }
  return records;
}

/** Weigh-ins every `every` days for `count` days ending on `end`, losing `kgPerWeek`. */
function weighDays(
  end: string,
  count: number,
  { startKg, kgPerWeek, every = 1, noise = 0 }: {
    startKg: number;
    kgPerWeek: number;
    every?: number;
    noise?: number;
  }
): WeighIn[] {
  const weighIns: WeighIn[] = [];
  for (let index = 0; index < count; index += every) {
    const kg = startKg - (kgPerWeek * index) / 7 + (index % 2 === 0 ? noise : -noise);
    weighIns.push({ day: addDays(end, index - count + 1), kg: Math.round(kg * 10) / 10 });
  }
  return weighIns;
}

function estimate(
  records: DayRecord[],
  weighIns: WeighIn[],
  previousTdee: number
) {
  return estimateExpenditure({
    days: indexDays(records),
    weighIns,
    windowStart: WINDOW.windowStart,
    end: WINDOW.end,
    previousTdee
  });
}

test("the check-in window is the four weeks up to the Sunday before", () => {
  assert.deepEqual(checkInWindow("2026-10-12"), {
    weekStart: "2026-10-12",
    windowStart: "2026-09-14",
    end: "2026-10-11"
  });
  // Any day of the week gives the same window.
  assert.deepEqual(checkInWindow("2026-10-18"), checkInWindow("2026-10-12"));
});

test("losing faster than planned raises the estimate, by half the gap", () => {
  // Eats 1.750 and loses 0,75 kg/week: real expenditure ≈ 1.750 + 825 = 2.575.
  const result = estimate(
    logDays(WINDOW.end, 60, () => 1750),
    weighDays(WINDOW.end, 60, { startKg: 92, kgPerWeek: 0.75, noise: 0.3 }),
    2300
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.intakeKcal, 1750);
  assert.equal(result.countedDays, 28);
  assert.ok(Math.abs(result.rawTdee - 2575) < 40, `raw ${result.rawTdee}`);
  // 2.300 + (≈2.575 − 2.300) / 2, under the weekly limit.
  assert.ok(Math.abs(result.tdee - 2440) <= 20, `tdee ${result.tdee}`);
  assert.equal(result.limited, false);

  // The target goes up: 2.440 − 550 for 0,5 kg/week.
  const proposal = proposeTarget(MAN, result.tdee);
  assert.equal(proposal.target, result.tdee - 550);
  assert.equal(proposal.tdeeIsAdaptive, true);
});

test("a stall lowers the estimate in limited steps down to the safety floor", () => {
  // Eats 1.750 and the weight does not move: expenditure ≈ 1.750.
  const records = logDays(WINDOW.end, 60, () => 1750);
  const weighIns = weighDays(WINDOW.end, 60, { startKg: 90, kgPerWeek: 0, noise: 0.4 });

  const first = estimate(records, weighIns, 2300);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.ok(Math.abs(first.rawTdee - 1750) < 30, `raw ${first.rawTdee}`);
  assert.equal(first.tdee, 2300 - MAX_WEEKLY_CHANGE_KCAL);
  assert.equal(first.limited, true);
  assert.equal(proposeTarget(MAN, first.tdee).target, 1600);

  // A week later it keeps going down by the same step…
  const second = estimate(records, weighIns, first.tdee);
  assert.equal(second.ok && second.tdee, 2000);
  // …but the target stays at the 1.500 kcal minimum for men, with the reason.
  const proposal = proposeTarget(MAN, 2000);
  assert.equal(proposal.target, 1500);
  assert.equal(proposal.floorApplied, true);
  assert.match(proposal.notes[0], /mínimo de 1\.500 kcal/);
});

test("eating as estimated keeps the estimate where it is", () => {
  const result = estimate(
    logDays(WINDOW.end, 60, () => 2325),
    weighDays(WINDOW.end, 60, { startKg: 92, kgPerWeek: 0.5 }),
    2875
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(Math.abs(result.rawTdee - 2875) < 30, `raw ${result.rawTdee}`);
  assert.ok(Math.abs(result.tdee - 2875) <= 20, `tdee ${result.tdee}`);
});

test("without enough logged days or weigh-ins there is no estimate", () => {
  const weighIns = weighDays(WINDOW.end, 60, { startKg: 90, kgPerWeek: 0.5 });

  // Only the last 10 days logged.
  const fewDays = estimate(logDays(WINDOW.end, 10, () => 1800), weighIns, 2500);
  assert.equal(fewDays.ok, false);
  assert.equal(fewDays.countedDays, 10);
  assert.deepEqual(fewDays.ok ? [] : fewDays.missing, [
    "Días completos registrados: 10 de los 14 necesarios en las últimas 4 semanas."
  ]);

  // Two weigh-ins in the window (the earlier ones do not count).
  const sparse = estimate(
    logDays(WINDOW.end, 28, () => 1800),
    [
      { day: "2026-08-01", kg: 92 },
      { day: "2026-09-20", kg: 91 },
      { day: "2026-10-10", kg: 90 }
    ],
    2500
  );
  assert.equal(sparse.ok, false);
  assert.equal(sparse.ok ? 0 : sparse.missing.length, 1);
  assert.match(sparse.ok ? "" : sparse.missing[0], /^Pesajes: 2 /);

  // Three weigh-ins, but within a week.
  const short = estimate(
    logDays(WINDOW.end, 28, () => 1800),
    [
      { day: "2026-10-05", kg: 91 },
      { day: "2026-10-08", kg: 90.8 },
      { day: "2026-10-11", kg: 90.6 }
    ],
    2500
  );
  assert.equal(short.ok, false);

  // Nothing at all.
  const nothing = estimate([], [], 2500);
  assert.equal(nothing.ok ? 0 : nothing.missing.length, 2);
});

test("unlogged and incomplete days are left out of the intake", () => {
  // Every other day logged at 2.000, plus a 400 kcal day (forgot to log)
  // and a 3.500 day the user marked incomplete: neither counts.
  const records = logDays(WINDOW.end, 28, (index) => (index % 2 === 0 ? 2000 : null));
  records.push({ day: "2026-09-15", kcal: 400, entries: 1, mark: null });
  records.push({ day: "2026-09-17", kcal: 3500, entries: 4, mark: "incomplete" });
  // A low day marked complete does count.
  records.push({ day: "2026-09-19", kcal: 700, entries: 2, mark: "complete" });

  const result = estimate(
    records,
    weighDays(WINDOW.end, 60, { startKg: 90, kgPerWeek: 0 }),
    2000
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.countedDays, 15);
  assert.equal(result.intakeKcal, Math.round((14 * 2000 + 700) / 15));
});

test("weekly weigh-ins are enough", () => {
  const result = estimate(
    logDays(WINDOW.end, 60, () => 2000),
    weighDays(WINDOW.end, 63, { startKg: 92, kgPerWeek: 0.5, every: 7 }),
    2550
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.weightSpanDays >= 14);
  // 2.000 + 550.
  assert.ok(Math.abs(result.rawTdee - 2550) < 60, `raw ${result.rawTdee}`);
});

test("an implausible jump is limited both ways", () => {
  const records = logDays(WINDOW.end, 28, () => 2000);
  // +3 kg in four weeks (water after a holiday): raw ≈ 2.000 − 825.
  const gain = estimate(
    records,
    weighDays(WINDOW.end, 28, { startKg: 87, kgPerWeek: -0.75 }),
    2400
  );
  assert.equal(gain.ok && gain.tdee, 2400 - MAX_WEEKLY_CHANGE_KCAL);
  // −4 kg in four weeks (stomach bug): raw way up.
  const loss = estimate(
    records,
    weighDays(WINDOW.end, 28, { startKg: 94, kgPerWeek: 1 }),
    2400
  );
  assert.equal(loss.ok && loss.tdee, 2400 + MAX_WEEKLY_CHANGE_KCAL);
});

test("the smoothing starts from the last check-in only if it is recent", () => {
  const last = { weekStart: "2026-10-05", estimatedTdee: 2450 };
  assert.equal(previousEstimate(last, "2026-10-12", 2875), 2450);
  assert.equal(previousEstimate(last, "2026-11-09", 2875), 2450);
  assert.equal(previousEstimate(last, "2026-11-16", 2875), 2875);
  assert.equal(previousEstimate(null, "2026-10-12", 2875), 2875);
});

test("the proposal ignores a manual target and keeps the pace", () => {
  const manual = { ...MAN, manualTargetKcal: 1400 };
  assert.equal(calculateTarget(manual).target, 1400);
  const proposal = proposeTarget(manual, 2600);
  assert.equal(proposal.isManual, false);
  assert.equal(proposal.target, 2050);
  assert.equal(proposeTarget({ ...MAN, pace: "maintain" }, 2600).target, 2600);
});

test("the check-in message says the estimate and the new target", () => {
  const proposal = proposeTarget(MAN, 2440);
  assert.equal(
    checkInMessage(2440, proposal, "moderate", 1750),
    "Tu gasto estimado es de 2.440 kcal al día; para seguir a 0,5 kg/semana, tu objetivo pasaría de 1.750 a 1.890 kcal."
  );
  assert.equal(
    checkInMessage(2440, proposal, "moderate", 1890),
    "Tu gasto estimado es de 2.440 kcal al día; para seguir a 0,5 kg/semana, tu objetivo se queda en 1.890 kcal."
  );
  assert.match(
    checkInMessage(2440, proposeTarget({ ...MAN, pace: "maintain" }, 2440), "maintain", 2300),
    /; para mantener tu peso, tu objetivo pasaría de 2\.300 a 2\.440 kcal\.$/
  );
});
