import { describe, expect, it } from 'vitest';

import {
  detectAnomaly,
  type AnomalyDetectionOptions,
  type AnomalyPoint,
} from '../src/anomaly/anomaly-detection.js';

// Candidate anchored to a fixed time; the reference is the run of points just
// before it. A realistic dense baseline (~1000 points) fills the default 7-day
// window at the 10-min cadence, so the sparseness guard only trips when we
// deliberately under-fill it.
const CANDIDATE = '2026-06-08T00:00:00.000Z';
const CANDIDATE_MS = Date.parse(CANDIDATE);
const TEN_MIN = 10 * 60_000;
const DENSE = 1000; // ~6.9 days at 10-min cadence → ratio ≈ 0.99 over a 7-day window

// `count` reference points stepping back 10 min from just before the candidate,
// at `baseValue` ± a deterministic ripple (alternating, so the mean stays
// ≈ baseValue and σ is controlled). Candidate point appended last.
function withBaseline(
  count: number,
  baseValue: number,
  candidateValue: number,
  ripple = 0
): AnomalyPoint[] {
  const pts: AnomalyPoint[] = [];
  for (let i = count; i >= 1; i--) {
    const v = baseValue + (i % 2 === 0 ? ripple : -ripple);
    pts.push({ t: new Date(CANDIDATE_MS - i * TEN_MIN).toISOString(), v });
  }
  pts.push({ t: CANDIDATE, v: candidateValue });
  return pts;
}

// Reference drawn from an explicit value list (known mean/σ), candidate last.
function fromValues(values: number[], candidateValue: number): AnomalyPoint[] {
  const pts: AnomalyPoint[] = [];
  const n = values.length;
  for (let i = n; i >= 1; i--) {
    pts.push({ t: new Date(CANDIDATE_MS - i * TEN_MIN).toISOString(), v: values[n - i]! });
  }
  pts.push({ t: CANDIDATE, v: candidateValue });
  return pts;
}

// 1000 points alternating 8/12 → mean 10, sample σ ≈ 2.001.
const ALT_8_12 = Array.from({ length: DENSE }, (_, i) => (i % 2 === 0 ? 8 : 12));

const DISCHARGE = 'DISCHARGE' as const;

describe('detectAnomaly', () => {
  it('flags a spike far above the baseline as an ALERT (ABOVE)', () => {
    const v = detectAnomaly(DISCHARGE, withBaseline(DENSE, 10, 30, 1));
    expect(v).not.toBeNull();
    expect(v!.direction).toBe('ABOVE');
    expect(v!.level).toBe('ALERT');
    expect(v!.value).toBe(30);
    expect(v!.stats.sampleSize).toBe(DENSE);
    expect(v!.stats.z).toBeGreaterThan(3);
    expect(v!.recordedAt).toBe(CANDIDATE);
  });

  it('flags a drop far below the baseline as BELOW', () => {
    const v = detectAnomaly(DISCHARGE, withBaseline(DENSE, 50, 5, 1));
    expect(v).not.toBeNull();
    expect(v!.direction).toBe('BELOW');
    expect(v!.stats.z).toBeLessThan(-3);
    // boundary is μ − k·σ for a BELOW verdict
    expect(v!.boundary).toBeLessThan(v!.stats.mean);
  });

  it('returns null on a flat series within the noise band', () => {
    // candidate equals the baseline → z ≈ 0 → no anomaly
    const v = detectAnomaly(DISCHARGE, withBaseline(DENSE, 10, 10, 1));
    expect(v).toBeNull();
  });

  it('returns null when the series is perfectly flat (σ = 0)', () => {
    // zero variance reference; even an off candidate must not divide by zero
    const v = detectAnomaly(DISCHARGE, withBaseline(DENSE, 10, 25, 0));
    expect(v).toBeNull();
  });

  it('returns null when the reference window is under-sampled (< minSamples)', () => {
    const v = detectAnomaly(DISCHARGE, withBaseline(20, 10, 30, 1));
    expect(v).toBeNull();
  });

  it('returns null when the window is too sparse for its expected cadence', () => {
    // 100 points clears minSamples but fills < 10% of the 7-day window at 10-min
    // cadence (ratio ≈ 0.1 < 0.6) → the sparseness guard trips.
    const v = detectAnomaly(DISCHARGE, withBaseline(100, 10, 30, 1));
    expect(v).toBeNull();
  });

  it('honours the 2σ boundary: |z| ≥ 2 fires, just below does not', () => {
    // mean 10, σ ≈ 2.001. 13.9 → z ≈ 1.95 (< 2) → null; 15 → z ≈ 2.50 (≥ 2).
    const justBelow = detectAnomaly(DISCHARGE, fromValues(ALT_8_12, 13.9));
    const atBoundary = detectAnomaly(DISCHARGE, fromValues(ALT_8_12, 15));
    expect(justBelow).toBeNull();
    expect(atBoundary).not.toBeNull();
    expect(atBoundary!.level).toBe('VIGILANCE');
  });

  it('hysteresis: a closed episode stays closed in the 1.5–2σ band', () => {
    // candidate 13.5 → z ≈ 1.75, between closeK (1.5) and k (2)
    const closed: AnomalyDetectionOptions = { previousState: 'closed' };
    expect(detectAnomaly(DISCHARGE, fromValues(ALT_8_12, 13.5), closed)).toBeNull();
  });

  it('hysteresis: an open episode sustains in the 1.5–2σ band, then closes below 1.5σ', () => {
    const open: AnomalyDetectionOptions = { previousState: 'open' };
    // 13.5 → z ≈ 1.75 ≥ closeK → sustains
    expect(detectAnomaly(DISCHARGE, fromValues(ALT_8_12, 13.5), open)).not.toBeNull();
    // 12.5 → z ≈ 1.25 < closeK → closes (null)
    expect(detectAnomaly(DISCHARGE, fromValues(ALT_8_12, 12.5), open)).toBeNull();
  });

  it('excludes the candidate from its own reference (no self-masking)', () => {
    // A lone extreme value must not pull μ/σ toward itself: detection still fires.
    const v = detectAnomaly(DISCHARGE, withBaseline(DENSE, 10, 1000, 1));
    expect(v).not.toBeNull();
    expect(v!.stats.mean).toBeCloseTo(10, 1);
    // reference window excludes the candidate timestamp
    expect(v!.stats.window.to).toBe(CANDIDATE);
  });

  it('returns null on an empty series', () => {
    expect(detectAnomaly(DISCHARGE, [])).toBeNull();
  });

  it('exposes mean/std/z/sampleSize/window for downstream persistence', () => {
    const v = detectAnomaly(DISCHARGE, withBaseline(DENSE, 10, 30, 1));
    expect(v!.stats.sampleSize).toBe(DENSE);
    expect(typeof v!.stats.mean).toBe('number');
    expect(typeof v!.stats.std).toBe('number');
    expect(typeof v!.stats.z).toBe('number');
    expect(v!.stats.window.from).toBeTypeOf('string');
    expect(v!.stats.window.to).toBeTypeOf('string');
  });
});
