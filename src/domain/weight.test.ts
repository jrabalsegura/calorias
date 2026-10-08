import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays } from "./day";
import {
  currentTrendKg,
  parseWeightInput,
  pointsInRange,
  weightProgress,
  weightTrend,
  type WeighIn
} from "./weight";

const START = "2026-01-05";

/** One weigh-in every `step` days from START, with kg given by `kgAt(day number)`. */
function series(
  count: number,
  step: number,
  kgAt: (dayNumber: number) => number
): WeighIn[] {
  return Array.from({ length: count }, (_, index) => ({
    day: addDays(START, index * step),
    kg: kgAt(index * step)
  }));
}

const close = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`
  );

test("the trend starts at the first weigh-in and moves 10 % per day", () => {
  const points = weightTrend([
    { day: "2026-01-05", kg: 80 },
    { day: "2026-01-06", kg: 81 },
    { day: "2026-01-07", kg: 79.1 }
  ]);

  assert.deepEqual(
    points.map(({ day, kg }) => ({ day, kg })),
    [
      { day: "2026-01-05", kg: 80 },
      { day: "2026-01-06", kg: 81 },
      { day: "2026-01-07", kg: 79.1 }
    ]
  );
  close(points[0].trend, 80);
  close(points[1].trend, 80.1); // 80 + 0,1 · (81 − 80)
  close(points[2].trend, 80); // 80,1 + 0,1 · (79,1 − 80,1)
  assert.deepEqual(weightTrend([]), []);
});

test("a stable weight keeps a flat trend, daily or weekly", () => {
  for (const step of [1, 7]) {
    for (const point of weightTrend(series(20, step, () => 75.4)))
      close(point.trend, 75.4);
  }
});

test("a weekly weigh-in moves the trend as much as seven daily ones", () => {
  // 1 − 0,9⁷ = 0,5217031
  const [, weekly] = weightTrend([
    { day: START, kg: 80 },
    { day: addDays(START, 7), kg: 79 }
  ]);
  close(weekly.trend, 80 - 0.5217031, 1e-7);

  const daily = weightTrend(series(8, 1, (day) => (day === 0 ? 80 : 79))).at(-1)!;
  close(weekly.trend, daily.trend);
});

test("gaps: a long one lets the trend catch up with the new weight", () => {
  const points = weightTrend([
    { day: "2026-01-05", kg: 90 },
    { day: "2026-01-06", kg: 89.8 },
    { day: "2026-08-01", kg: 82 }
  ]);
  close(points[2].trend, 82, 1e-6);
});

test("the current trend for the target is rounded to 0,1 kg", () => {
  assert.equal(currentTrendKg([]), null);
  assert.equal(
    currentTrendKg([
      { day: START, kg: 80 },
      { day: addDays(START, 7), kg: 79 }
    ]),
    79.5 // 79,478
  );
});

test("real pace from daily weigh-ins losing 0,7 kg/week, with noise", () => {
  // −0,1 kg/day with a ±0,4 kg water swing every other day.
  const weighIns = series(70, 1, (day) => 90 - 0.1 * day + (day % 2 === 0 ? 0.4 : -0.4));
  const progress = weightProgress(weighIns, 80)!;

  close(progress.realKgPerWeek!, 0.7, 0.02);
  assert.equal(progress.startDay, START);
  assert.equal(progress.startKg, 90.4);
  // The trend lags about 0,9 kg behind a line falling 0,1 kg/day.
  close(progress.currentKg, 90 - 6.9 + 0.9, 0.15);
  close(progress.lostKg, 90.4 - progress.currentKg, 0.06);
  close(progress.remainingKg!, progress.currentKg - 80, 0.06);
});

test("real pace from weekly weigh-ins losing 0,5 kg/week", () => {
  const progress = weightProgress(
    series(16, 7, (day) => 88 - (0.5 * day) / 7),
    80
  )!;
  close(progress.realKgPerWeek!, 0.5, 0.01);
});

test("real pace with gaps uses the earliest weigh-in of the last five weeks", () => {
  // Weigh-ins on days 0, 3, 11, 12, 30 and 40, losing 0,05 kg/day.
  const weighIns = [0, 3, 11, 12, 30, 40].map((day) => ({
    day: addDays(START, day),
    kg: 85 - 0.05 * day
  }));
  const points = weightTrend(weighIns);
  const progress = weightProgress(weighIns, null)!;

  // Reference: day 11, the first weigh-in from day 40 − 35 on.
  close(
    progress.realKgPerWeek!,
    Math.round(((points[2].trend - points[5].trend) * 7 * 100) / 29) / 100
  );
  assert.ok(progress.realKgPerWeek! > 0.2 && progress.realKgPerWeek! < 0.4);
  assert.equal(progress.remainingKg, null);
  assert.equal(progress.estimatedDate, null);
});

test("after a long gap there is no real pace until there are recent weigh-ins", () => {
  // Five months of daily weigh-ins, seven months without any, then today.
  const old = series(150, 1, (day) => 88 - 0.03 * day);
  const today = { day: addDays(START, 360), kg: 83.4 };
  const progress = weightProgress([...old, today], 78)!;

  assert.equal(progress.realKgPerWeek, null);
  assert.equal(progress.estimatedDate, null);
  close(progress.currentKg, 83.4);

  const twoWeeksLater = { day: addDays(START, 374), kg: 83 };
  assert.notEqual(
    weightProgress([...old, today, twoWeeksLater], 78)!.realKgPerWeek,
    null
  );
});

test("real pace needs two weeks of data", () => {
  assert.equal(
    weightProgress(
      series(10, 1, (day) => 80 - 0.1 * day),
      70
    )!.realKgPerWeek,
    null
  );
  assert.notEqual(
    weightProgress(
      series(15, 1, (day) => 80 - 0.1 * day),
      70
    )!.realKgPerWeek,
    null
  );
  assert.equal(weightProgress([], 70), null);
});

test("estimated date with the real pace, and none when not losing", () => {
  // Flat 80 kg for 4 weeks: no loss, no date.
  const flat = weightProgress(
    series(5, 7, () => 80),
    75
  )!;
  assert.equal(flat.realKgPerWeek, 0);
  assert.equal(flat.remainingKg, 5);
  assert.equal(flat.estimatedDate, null);

  // Gaining: negative pace, no date.
  const gaining = weightProgress(
    series(6, 7, (day) => 80 + (0.3 * day) / 7),
    75
  )!;
  assert.ok(gaining.realKgPerWeek! < 0);
  assert.ok(gaining.lostKg < 0);
  assert.equal(gaining.estimatedDate, null);

  // Losing 0,5 kg/week with 5 kg still to go: about 70 days after the last weigh-in.
  const losing = weightProgress(
    series(16, 7, (day) => 88 - (0.5 * day) / 7),
    80
  )!;
  const last = addDays(START, 15 * 7);
  assert.equal(
    losing.estimatedDate,
    addDays(last, Math.ceil((losing.remainingKg! / losing.realKgPerWeek!) * 7))
  );

  // Target already reached.
  const reached = weightProgress(
    series(5, 7, () => 74),
    75
  )!;
  assert.equal(reached.remainingKg, 0);
  assert.equal(reached.estimatedDate, null);
});

test("chart ranges count back from today", () => {
  const points = series(200, 1, () => 80);
  const today = addDays(START, 199);
  assert.equal(pointsInRange(points, "1m", today).length, 31);
  assert.equal(pointsInRange(points, "3m", today).length, 92);
  assert.equal(pointsInRange(points, "all", today).length, 200);
  assert.equal(pointsInRange(points, "1m", addDays(today, 365)).length, 0);
});

test("weigh-in form validation", () => {
  const today = "2026-10-08";
  assert.deepEqual(parseWeightInput({ day: today, kg: "82,46" }, today), {
    ok: true,
    value: { day: today, kg: 82.5 }
  });
  assert.deepEqual(parseWeightInput({ day: "2026-10-01", kg: " 79.9 " }, today), {
    ok: true,
    value: { day: "2026-10-01", kg: 79.9 }
  });
  assert.equal(parseWeightInput({ day: "2026-10-09", kg: "80" }, today).ok, false);
  assert.equal(parseWeightInput({ day: "2026-02-30", kg: "80" }, today).ok, false);
  assert.equal(parseWeightInput({ day: today, kg: "" }, today).ok, false);
  assert.equal(parseWeightInput({ day: today, kg: "29,9" }, today).ok, false);
  assert.equal(parseWeightInput({ day: today, kg: "301" }, today).ok, false);
  assert.equal(parseWeightInput({ day: today, kg: "-80" }, today).ok, false);
});
