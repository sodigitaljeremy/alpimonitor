import { describe, expect, it } from 'vitest';

import {
  detectAnomaly,
  type AnomalyDetectionOptions,
  type AnomalyPoint,
} from '../src/anomaly/anomaly-detection.js';

// B1-bis — the detector is hour-of-day DESEASONALISED: the candidate is compared
// only to reference points from the SAME UTC hour. Fixtures therefore build a
// multi-day 10-min series so each hour bucket is populated, and assert against the
// per-hour statistics (not the whole-window statistics).

const CANDIDATE = '2026-06-08T06:00:00.000Z'; // UTC hour 6 → the candidate's bucket
const TEN_MIN = 10 * 60_000;
const STEPS_PER_DAY = 24 * 6; // 10-min cadence → 144 points/day, 6 per hour bucket

// Build `days` of reference points at the 10-min cadence ending just before the
// candidate, each point valued `baselineForHour(utcHour) ± ripple`. The ripple
// alternates by step index; any hour bucket spans whole runs of 6 consecutive
// steps per day (3 even + 3 odd), so its mean is exactly the baseline and its
// sample σ ≈ ripple·√(n/(n−1)). Candidate appended last.
function buildSeries(opts: {
  days: number;
  baselineForHour: (hour: number) => number;
  ripple?: number;
  candidateValue: number;
  candidateIso?: string;
}): AnomalyPoint[] {
  const { days, baselineForHour, candidateValue } = opts;
  const ripple = opts.ripple ?? 0;
  const candidateIso = opts.candidateIso ?? CANDIDATE;
  const candidateMs = Date.parse(candidateIso);
  const pts: AnomalyPoint[] = [];
  for (let i = days * STEPS_PER_DAY; i >= 1; i--) {
    const ms = candidateMs - i * TEN_MIN;
    const hour = new Date(ms).getUTCHours();
    const v = baselineForHour(hour) + (i % 2 === 0 ? ripple : -ripple);
    pts.push({ t: new Date(ms).toISOString(), v });
  }
  pts.push({ t: candidateIso, v: candidateValue });
  return pts;
}

const flat = (value: number) => () => value;

// A sharp diurnal cycle: a few night hours sit LOW, the rest of the day HIGH —
// like a glacier-fed river's nightly recession trough. Candidate hour 6 is one of
// the night-trough hours.
const NIGHT_TROUGH_HOURS = new Set([3, 4, 5, 6]);
const diurnal = (low: number, high: number) => (h: number) =>
  NIGHT_TROUGH_HOURS.has(h) ? low : high;

// Whole-window (NON-deseasonalised) z of a value — what the old detector judged.
// Used only to PROVE the diurnal cycle would have fired the naive detector.
function naiveZ(points: AnomalyPoint[], value: number): number {
  const ref = points.slice(0, -1).map((p) => p.v);
  const mean = ref.reduce((a, v) => a + v, 0) / ref.length;
  const variance = ref.reduce((a, v) => a + (v - mean) * (v - mean), 0) / (ref.length - 1);
  return (value - mean) / Math.sqrt(variance);
}

const DISCHARGE = 'DISCHARGE' as const;

describe('detectAnomaly (hour-of-day deseasonalised)', () => {
  it('does NOT flag a normal nocturnal trough, even though the naive z would fire', () => {
    // Sharp diurnal cycle (night 30, day 70). Candidate at 06:00 sits at its
    // normal trough value (30). Against the WHOLE window it looks like a >2σ drop
    // — exactly the false BELOW the old detector produced. Against the 06:00
    // bucket it is dead-on the mean → no anomaly.
    const series = buildSeries({
      days: 7,
      baselineForHour: diurnal(30, 70),
      ripple: 2,
      candidateValue: 30,
    });
    expect(Math.abs(naiveZ(series, 30))).toBeGreaterThan(2); // naive detector WOULD fire
    expect(detectAnomaly(DISCHARGE, series)).toBeNull(); // deseasonalised does not
  });

  it('flags a trough that is abnormally low FOR ITS HOUR as a BELOW anomaly', () => {
    // Same diurnal series, but 06:00 reads 18 — far below the ~30 typical of 06:00.
    const series = buildSeries({
      days: 7,
      baselineForHour: diurnal(30, 70),
      ripple: 2,
      candidateValue: 18,
    });
    const v = detectAnomaly(DISCHARGE, series);
    expect(v).not.toBeNull();
    expect(v!.direction).toBe('BELOW');
    expect(v!.level).toBe('ALERT');
    expect(v!.stats.hourBucket).toBe(6);
    expect(v!.stats.mean).toBeCloseTo(30, 5); // bucket mean, not the ~63 window mean
    expect(v!.stats.z).toBeLessThan(-3);
  });

  it('flags a spike far above the hour baseline as an ALERT (ABOVE)', () => {
    const series = buildSeries({
      days: 7,
      baselineForHour: flat(10),
      ripple: 2,
      candidateValue: 30,
    });
    const v = detectAnomaly(DISCHARGE, series);
    expect(v).not.toBeNull();
    expect(v!.direction).toBe('ABOVE');
    expect(v!.level).toBe('ALERT');
    expect(v!.value).toBe(30);
    expect(v!.stats.z).toBeGreaterThan(3);
    expect(v!.recordedAt).toBe(CANDIDATE);
  });

  it('flags a drop far below the hour baseline as BELOW', () => {
    const series = buildSeries({
      days: 7,
      baselineForHour: flat(50),
      ripple: 2,
      candidateValue: 5,
    });
    const v = detectAnomaly(DISCHARGE, series);
    expect(v).not.toBeNull();
    expect(v!.direction).toBe('BELOW');
    expect(v!.stats.z).toBeLessThan(-3);
    // boundary is μ − k·σ for a BELOW verdict
    expect(v!.boundary).toBeLessThan(v!.stats.mean);
  });

  it('returns null on a value within the hour-bucket noise band', () => {
    // candidate equals the hour baseline → z ≈ 0 → no anomaly
    const series = buildSeries({
      days: 7,
      baselineForHour: flat(10),
      ripple: 2,
      candidateValue: 10,
    });
    expect(detectAnomaly(DISCHARGE, series)).toBeNull();
  });

  it('returns null when the hour bucket is perfectly flat (σ = 0)', () => {
    // zero within-bucket variance; even an off candidate must not divide by zero
    const series = buildSeries({
      days: 7,
      baselineForHour: flat(10),
      ripple: 0,
      candidateValue: 25,
    });
    expect(detectAnomaly(DISCHARGE, series)).toBeNull();
  });

  it('returns null when the hour bucket is under-sampled (< minBucketSamples)', () => {
    // 3 days → 3·6 = 18 same-hour points, below the default 20 → refuse to assess.
    const series = buildSeries({
      days: 3,
      baselineForHour: flat(10),
      ripple: 2,
      candidateValue: 30,
    });
    const v = detectAnomaly(DISCHARGE, series);
    expect(v).toBeNull();
  });

  it('honours the 2σ boundary on the per-hour z: |z| ≥ 2 fires, just below does not', () => {
    // 7-day bucket of 42 points, ripple 2 → σ_bucket = 2·√(42/41) ≈ 2.0248.
    // 13.9 → z ≈ 1.93 (< 2) → null; 14.05 → z ≈ 2.00 (≥ 2) → VIGILANCE.
    const justBelow = buildSeries({
      days: 7,
      baselineForHour: flat(10),
      ripple: 2,
      candidateValue: 13.9,
    });
    const atBoundary = buildSeries({
      days: 7,
      baselineForHour: flat(10),
      ripple: 2,
      candidateValue: 14.05,
    });
    expect(detectAnomaly(DISCHARGE, justBelow)).toBeNull();
    const v = detectAnomaly(DISCHARGE, atBoundary);
    expect(v).not.toBeNull();
    expect(v!.level).toBe('VIGILANCE');
  });

  it('hysteresis: a closed episode stays closed in the 1.5–2σ band', () => {
    // 13.5 → z ≈ 1.73, between closeK (1.5) and k (2)
    const series = buildSeries({
      days: 7,
      baselineForHour: flat(10),
      ripple: 2,
      candidateValue: 13.5,
    });
    const closed: AnomalyDetectionOptions = { previousState: 'closed' };
    expect(detectAnomaly(DISCHARGE, series, closed)).toBeNull();
  });

  it('hysteresis: an open episode sustains in the 1.5–2σ band, then closes below 1.5σ', () => {
    const open: AnomalyDetectionOptions = { previousState: 'open' };
    // 13.5 → z ≈ 1.73 ≥ closeK → sustains
    const sustains = buildSeries({
      days: 7,
      baselineForHour: flat(10),
      ripple: 2,
      candidateValue: 13.5,
    });
    expect(detectAnomaly(DISCHARGE, sustains, open)).not.toBeNull();
    // 12.5 → z ≈ 1.23 < closeK → closes (null)
    const closes = buildSeries({
      days: 7,
      baselineForHour: flat(10),
      ripple: 2,
      candidateValue: 12.5,
    });
    expect(detectAnomaly(DISCHARGE, closes, open)).toBeNull();
  });

  it('excludes the candidate from its own bucket (no self-masking)', () => {
    // A lone extreme value must not pull the hour μ/σ toward itself: it still fires.
    const series = buildSeries({
      days: 7,
      baselineForHour: flat(10),
      ripple: 2,
      candidateValue: 1000,
    });
    const v = detectAnomaly(DISCHARGE, series);
    expect(v).not.toBeNull();
    expect(v!.stats.mean).toBeCloseTo(10, 5);
    expect(v!.stats.window.to).toBe(CANDIDATE);
  });

  it('returns null on an empty series', () => {
    expect(detectAnomaly(DISCHARGE, [])).toBeNull();
  });

  it('exposes per-hour stats (mean/std/z/sampleSize/hourBucket/bucketSampleSize/window)', () => {
    const series = buildSeries({
      days: 7,
      baselineForHour: flat(10),
      ripple: 2,
      candidateValue: 30,
    });
    const v = detectAnomaly(DISCHARGE, series);
    expect(v!.stats.hourBucket).toBe(6);
    expect(v!.stats.bucketSampleSize).toBe(7 * 6); // 42 same-hour points
    expect(v!.stats.sampleSize).toBe(7 * STEPS_PER_DAY); // full trailing window
    expect(v!.stats.bucketSampleSize).toBeLessThan(v!.stats.sampleSize);
    expect(typeof v!.stats.mean).toBe('number');
    expect(typeof v!.stats.std).toBe('number');
    expect(typeof v!.stats.z).toBe('number');
    expect(v!.stats.window.from).toBeTypeOf('string');
    expect(v!.stats.window.to).toBeTypeOf('string');
  });
});
