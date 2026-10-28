// What AI usage costs, estimated from token counts. US dollars per million tokens, from the
// providers' published prices as listed on 2026-10-27; the bill itself may differ a little.
export const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gemini-3.5-flash": { input: 1.5, output: 9 },
};

/** The estimated cost in dollars; nothing for the scripted test model or unknown models. */
export function costOf(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICES[model];
  if (!price) return 0;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

export function formatUsd(dollars: number): string {
  if (dollars === 0) return "$0.00";
  if (dollars < 0.01) return "under $0.01";
  return `$${dollars.toFixed(2)}`;
}
