import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addMonths,
  dayStatus,
  dayTone,
  formatDayRange,
  formatMonth,
  indexDays,
  isValidMonth,
  monthGrid,
  recentWeeks,
  summarizePeriod,
  type DayRecord
} from "./summary";
import { weightTrend } from "./weight";

const record = (day: string, kcal: number, extra: Partial<DayRecord> = {}): DayRecord => ({
  day,
  kcal,
  entries: 3,
  mark: null,
  ...extra
});

test("a day counts unless it is empty, has very few kcal or is marked incomplete", () => {
  assert.equal(dayStatus(undefined), "empty");
  assert.equal(dayStatus(record("2026-10-01", 0, { entries: 0 })), "empty");
  assert.equal(dayStatus(record("2026-10-01", 1800)), "counted");
  assert.equal(dayStatus(record("2026-10-01", 799)), "low");
  assert.equal(dayStatus(record("2026-10-01", 800)), "counted");
  assert.equal(dayStatus(record("2026-10-01", 600, { mark: "complete" })), "counted");
  assert.equal(dayStatus(record("2026-10-01", 2400, { mark: "incomplete" })), "marked");
  // A mark on a day without entries changes nothing.
  assert.equal(dayStatus(record("2026-10-01", 0, { entries: 0, mark: "complete" })), "empty");
});

test("calendar colours: within, a bit over (≤ 10 %), over and incomplete", () => {
  assert.equal(dayTone(record("d", 1800), 1800), "within");
  assert.equal(dayTone(record("d", 1980), 1800), "over");
  assert.equal(dayTone(record("d", 1981), 1800), "wayOver");
  assert.equal(dayTone(record("d", 500), 1800), "incomplete");
  assert.equal(dayTone(record("d", 1800, { mark: "incomplete" }), 1800), "incomplete");
  assert.equal(dayTone(undefined, 1800), "empty");
  assert.equal(dayTone(record("d", 2500), null), "counted");
});

test("period averages only use counted days", () => {
  const days = indexDays([
    record("2026-10-01", 1500),
    record("2026-10-02", 2100),
    record("2026-10-03", 300),
    record("2026-10-04", 3000, { mark: "incomplete" }),
    record("2026-10-06", 1800),
    record("2026-09-30", 9000)
  ]);
  assert.deepEqual(summarizePeriod(days, "2026-10-01", "2026-10-07", 1800), {
    countedDays: 3,
    incompleteDays: 2,
    averageKcal: 1800,
    withinTarget: 2
  });
  assert.deepEqual(summarizePeriod(days, "2026-10-08", "2026-10-14", 1800), {
    countedDays: 0,
    incompleteDays: 0,
    averageKcal: null,
    withinTarget: 0
  });
  assert.equal(summarizePeriod(days, "2026-10-01", "2026-10-07", null).withinTarget, null);
});

test("recent weeks go Monday to Sunday, newest first, without today", () => {
  // Thursday 8 Oct 2026.
  const today = "2026-10-08";
  const days = indexDays([
    record("2026-09-28", 2000),
    record("2026-10-04", 1600),
    record("2026-10-05", 1700),
    record("2026-10-07", 1900),
    record("2026-10-08", 3000)
  ]);
  const trend = weightTrend([
    { day: "2026-09-21", kg: 90 },
    { day: "2026-09-28", kg: 89 },
    { day: "2026-10-06", kg: 88 }
  ]);
  const weeks = recentWeeks(days, trend, today, 3, 1800);

  assert.deepEqual(
    weeks.map(({ weekStart, weekEnd }) => [weekStart, weekEnd]),
    [
      ["2026-10-05", "2026-10-11"],
      ["2026-09-28", "2026-10-04"],
      ["2026-09-21", "2026-09-27"]
    ]
  );
  // This week: Monday and Wednesday (today's 3.000 not yet).
  assert.equal(weeks[0].countedDays, 2);
  assert.equal(weeks[0].averageKcal, 1800);
  assert.equal(weeks[0].withinTarget, 1);
  assert.equal(weeks[1].averageKcal, 1800);
  assert.equal(weeks[1].withinTarget, 1);
  assert.equal(weeks[2].averageKcal, null);

  // Trend at the end of each week and its change.
  assert.equal(weeks[2].trendKg, 90);
  assert.equal(weeks[2].changeKg, null);
  assert.equal(weeks[1].trendKg, 89.5);
  assert.equal(weeks[1].changeKg, -0.5);
  // 89,48 + (1 − 0,9⁸)·(88 − 89,48) = 88,64; the change uses the unrounded trends.
  assert.equal(weeks[0].trendKg, 88.6);
  assert.equal(weeks[0].changeKg, -0.8);
});

test("month grid starts on Monday and pads both ends", () => {
  // October 2026 starts on a Thursday and has 31 days.
  const grid = monthGrid("2026-10");
  assert.equal(grid.length, 5);
  assert.deepEqual(grid[0], [null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  assert.deepEqual(grid[4], ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", null]);
  // February 2021 starts on Monday and fills four rows exactly.
  assert.equal(monthGrid("2021-02").length, 4);
  assert.equal(monthGrid("2021-02")[0][0], "2021-02-01");
});

test("months: validation, arithmetic and label", () => {
  assert.equal(isValidMonth("2026-10"), true);
  assert.equal(isValidMonth("2026-13"), false);
  assert.equal(isValidMonth("2026-1"), false);
  assert.equal(isValidMonth(undefined), false);
  assert.equal(addMonths("2026-10", 1), "2026-11");
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-10", -22), "2024-12");
  assert.equal(formatMonth("2026-10"), "Octubre de 2026");
});

test("day ranges are short", () => {
  assert.equal(formatDayRange("2026-09-28", "2026-10-04"), "28 sept – 4 oct");
});
