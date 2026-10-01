import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  dayInMadrid,
  formatRelativeDay,
  isValidDay,
  minutesInMadrid
} from "./day";

test("the day changes at midnight in Madrid, not in UTC (summer, UTC+2)", () => {
  assert.equal(dayInMadrid(new Date("2026-09-30T21:59:59Z")), "2026-09-30");
  assert.equal(dayInMadrid(new Date("2026-09-30T22:00:00Z")), "2026-10-01");
  assert.equal(dayInMadrid(new Date("2026-09-30T23:30:00Z")), "2026-10-01");
});

test("the day changes at midnight in Madrid, not in UTC (winter, UTC+1)", () => {
  assert.equal(dayInMadrid(new Date("2026-12-31T22:59:59Z")), "2026-12-31");
  assert.equal(dayInMadrid(new Date("2026-12-31T23:00:00Z")), "2027-01-01");
});

test("the night the clocks go back is still one day", () => {
  // 25-10-2026: 03:00 CEST becomes 02:00 CET.
  assert.equal(dayInMadrid(new Date("2026-10-24T22:00:00Z")), "2026-10-25");
  assert.equal(dayInMadrid(new Date("2026-10-25T22:59:00Z")), "2026-10-25");
  assert.equal(dayInMadrid(new Date("2026-10-25T23:00:00Z")), "2026-10-26");
});

test("wall-clock minutes follow Madrid time", () => {
  assert.equal(minutesInMadrid(new Date("2026-09-30T22:05:00Z")), 5);
  assert.equal(minutesInMadrid(new Date("2026-12-31T22:59:00Z")), 23 * 60 + 59);
  assert.equal(minutesInMadrid(new Date("2026-07-01T12:30:00Z")), 14 * 60 + 30);
});

test("only real calendar dates are valid days", () => {
  for (const day of ["2026-10-01", "2028-02-29", "2026-12-31"]) {
    assert.equal(isValidDay(day), true, day);
  }
  for (const day of [
    "2026-02-29",
    "2026-13-01",
    "2026-10-32",
    "2026-1-01",
    "01-10-2026",
    "2026-10-01T00:00",
    "",
    undefined,
    20261001
  ]) {
    assert.equal(isValidDay(day), false, String(day));
  }
});

test("adding days crosses months, years, leap days and DST changes", () => {
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
  assert.equal(addDays("2026-10-01", -1), "2026-09-30");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2026-03-29", 1), "2026-03-30");
  assert.equal(addDays("2026-10-25", -1), "2026-10-24");
  assert.equal(addDays("2026-10-01", 0), "2026-10-01");
});

test("days are labelled relative to today", () => {
  const today = "2026-10-01";
  assert.equal(formatRelativeDay("2026-10-01", today), "Hoy");
  assert.equal(formatRelativeDay("2026-09-30", today), "Ayer");
  assert.equal(formatRelativeDay("2026-10-02", today), "Mañana");
  assert.equal(formatRelativeDay("2026-09-28", today), "Lunes, 28 de septiembre");
  assert.equal(
    formatRelativeDay("2025-12-25", today),
    "Jueves, 25 de diciembre de 2025"
  );
});
