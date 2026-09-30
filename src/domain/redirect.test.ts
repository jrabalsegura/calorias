import assert from "node:assert/strict";
import { test } from "node:test";
import { getSafeRedirectPath } from "./redirect";

test("keeps same-origin paths with their query", () => {
  assert.equal(getSafeRedirectPath("/weight"), "/weight");
  assert.equal(getSafeRedirectPath("/?day=2026-09-30"), "/?day=2026-09-30");
});

test("falls back to / for anything that could leave the app", () => {
  for (const value of [
    undefined,
    null,
    42,
    "",
    "weight",
    "https://example.com",
    "//example.com",
    "/\\example.com"
  ]) {
    assert.equal(getSafeRedirectPath(value), "/", String(value));
  }
});

test("never redirects back to the login page", () => {
  assert.equal(getSafeRedirectPath("/login"), "/");
  assert.equal(getSafeRedirectPath("/login?next=/"), "/");
});
