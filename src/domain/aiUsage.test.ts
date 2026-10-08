import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateCostUsd, formatUsd, monthStart, summarizeAiCalls } from "./aiUsage";

test("cost comes from the model's price per million tokens", () => {
  // 2000 × 2 $ + 500 × 10 $ per million = 0,009 $
  assert.equal(estimateCostUsd("claude-sonnet-5-5", { inputTokens: 2000, outputTokens: 500 }), 0.009);
  assert.equal(estimateCostUsd("claude-opus-5-5", { inputTokens: 1_000_000, outputTokens: 0 }), 4);
  assert.equal(estimateCostUsd("some-new-model", { inputTokens: 1, outputTokens: 1 }), null);
});

test("the month's calls add up, flagging unknown prices", () => {
  assert.deepEqual(
    summarizeAiCalls([
      { ok: true, inputTokens: 2000, outputTokens: 500, costUsd: 0.009 },
      { ok: false, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      { ok: true, inputTokens: 100, outputTokens: 10, costUsd: null }
    ]),
    {
      calls: 3,
      failed: 1,
      inputTokens: 2100,
      outputTokens: 510,
      costUsd: 0.009,
      costIncomplete: true
    }
  );
  assert.equal(summarizeAiCalls([]).costIncomplete, false);
});

test("months start on day one", () => {
  assert.equal(monthStart("2026-10-08"), "2026-10-01");
});

test("dollars are shown with two decimals", () => {
  assert.equal(formatUsd(0), "0,00 $");
  assert.equal(formatUsd(0.001), "< 0,01 $");
  assert.equal(formatUsd(1.234), "1,23 $");
});
