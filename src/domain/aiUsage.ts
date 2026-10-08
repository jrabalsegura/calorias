/** US dollars per million tokens (Claude API, September 2026). */
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 }
};

export type TokenUsage = { inputTokens: number; outputTokens: number };

/** Estimated cost of a call in dollars, or null for a model without a known price. */
export function estimateCostUsd(model: string, { inputTokens, outputTokens }: TokenUsage): number | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

export type AiCallSummary = TokenUsage & {
  calls: number;
  failed: number;
  costUsd: number;
  /** Some calls used a model without a known price, so the cost falls short. */
  costIncomplete: boolean;
};

export function summarizeAiCalls(
  calls: readonly (TokenUsage & { ok: boolean; costUsd: number | null })[]
): AiCallSummary {
  const summary: AiCallSummary = {
    calls: calls.length,
    failed: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    costIncomplete: false
  };
  for (const call of calls) {
    if (!call.ok) summary.failed += 1;
    summary.inputTokens += call.inputTokens;
    summary.outputTokens += call.outputTokens;
    if (call.costUsd === null) summary.costIncomplete = true;
    else summary.costUsd += call.costUsd;
  }
  return summary;
}

/** First day of the month of `day` (YYYY-MM-DD). */
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

const usdFormat = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "0,14 $", and "< 0,01 $" for anything above zero that rounds to nothing. */
export function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.005) return "< 0,01 $";
  return `${usdFormat.format(amount)} $`;
}
