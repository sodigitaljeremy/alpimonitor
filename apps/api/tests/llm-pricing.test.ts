import { describe, expect, it } from 'vitest';

import { computeCostUsd } from '../src/ai/llm-pricing.js';

describe('computeCostUsd', () => {
  it('computes cost from input/output tokens for a known model', () => {
    // 1000 in * 0.1/M + 500 out * 0.3/M = 0.0001 + 0.00015 = 0.00025
    expect(computeCostUsd('mistral-small-latest', 1000, 500)).toBe(0.00025);
  });

  it('returns null for an unknown model', () => {
    expect(computeCostUsd('gpt-unknown', 1000, 500)).toBeNull();
  });

  it('returns null when a token count is missing (no guessing)', () => {
    expect(computeCostUsd('mistral-small-latest', null, 500)).toBeNull();
    expect(computeCostUsd('mistral-small-latest', 1000, undefined)).toBeNull();
  });

  it('returns 0 for zero tokens (known model)', () => {
    expect(computeCostUsd('mistral-small-latest', 0, 0)).toBe(0);
  });

  it('rounds to sub-cent (6 decimal) precision', () => {
    const c = computeCostUsd('mistral-small-latest', 1, 1);
    expect(c).toBe(0); // 0.0000004 → rounds to 0 at 6 decimals
  });
});
