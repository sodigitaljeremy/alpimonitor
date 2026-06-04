// AI layer — extension D (ADR-012). Pure cost estimation for LLM calls.
//
// Rates are PUBLIC list prices, USD per 1M tokens. Source: mistral.ai/pricing
// (consulted 2026-06-04). APPROXIMATE and configurable — some sources quote
// 0.20/0.60 for certain Mistral Small versions; treat as an estimate, not a bill.
// When the LiteLLM proxy is deployed (D-ready, not now), it becomes the source
// of truth for cost and these constants can be retired.
export interface ModelPriceUsdPerMillion {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const LLM_PRICING_USD_PER_MILLION: Record<string, ModelPriceUsdPerMillion> = {
  'mistral-small-latest': { inputPerMillion: 0.1, outputPerMillion: 0.3 },
};

// Returns the estimated USD cost, or null when it cannot be computed honestly:
// unknown model, or missing token counts. We never guess a cost.
export function computeCostUsd(
  model: string,
  promptTokens: number | null | undefined,
  completionTokens: number | null | undefined
): number | null {
  const price = LLM_PRICING_USD_PER_MILLION[model];
  if (!price) return null;
  if (promptTokens == null || completionTokens == null) return null;

  const cost =
    (promptTokens / 1_000_000) * price.inputPerMillion +
    (completionTokens / 1_000_000) * price.outputPerMillion;
  // 6 decimals: sub-cent precision, enough for per-call estimates.
  return Math.round(cost * 1_000_000) / 1_000_000;
}
