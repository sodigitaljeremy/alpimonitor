import type { Parameter } from '@alpimonitor/shared';

// AI layer — extension B1 (ADR-012). Pure, deterministic statistical anomaly
// detection over a single parameter's measurement series. No I/O, no Date.now(),
// no LLM — fully unit-testable. The LLM (if ever wired) only *narrates* a verdict
// produced here; it never decides whether a point is anomalous.
//
// Method: classic z-score against a LONG trailing reference window (~7 days) that
// PRECEDES the candidate point. Excluding the candidate from the reference keeps a
// genuine outlier from inflating μ/σ and masking itself, and a multi-day window
// absorbs the diurnal glacier-melt cycle into the baseline variance rather than
// flagging every afternoon peak. The candidate is the most recent point.
//
//   z = (xN − μ) / σ      over the reference window [tN − refWindow, tN)
//   |z| ≥ k            → anomaly (k = 2 by default)
//   z > 0 → ABOVE, z < 0 → BELOW
//   |z| ≥ 3            → ALERT, otherwise VIGILANCE
//
// Hysteresis (debounce): a CLOSED episode opens only at |z| ≥ k (2σ); an already
// OPEN episode stays open until |z| < closeK (1.5σ). The caller passes the current
// episode state; the function stays pure by taking it as input. A returned verdict
// always means "anomaly active now"; `null` always means "no anomaly now" (so the
// caller closes any open episode).

export type AnomalyDirection = 'ABOVE' | 'BELOW';
export type AnomalyLevel = 'VIGILANCE' | 'ALERT';
export type EpisodeState = 'open' | 'closed';

export interface AnomalyPoint {
  t: string | Date;
  v: number;
}

export interface AnomalyDetectionOptions {
  // Trailing reference window length, in ms. Default 7 days. Long on purpose:
  // it absorbs the diurnal melt cycle into the baseline instead of over-flagging.
  referenceWindowMs?: number;
  // Open threshold in σ units. |z| ≥ k opens an episode. Default 2.
  k?: number;
  // Close threshold in σ units (hysteresis). An open episode stays open until
  // |z| < closeK. Default 1.5. Must be ≤ k to debounce rather than flap.
  closeK?: number;
  // |z| ≥ alertK escalates VIGILANCE → ALERT. Default 3.
  alertK?: number;
  // Minimum reference sample size. Below this, σ is not trustworthy → null.
  minSamples?: number;
  // σ at or below this is treated as a constant series (no variance) → null.
  // Default 1e-9: only catches genuinely flat data, not real hydro noise.
  minStd?: number;
  // Expected sampling cadence, used for the sparseness guard. Default 10 (the
  // LINDAS 10-min cron). Kept overridable so the function makes no source
  // assumption of its own.
  expectedIntervalMinutes?: number;
  // Reference completeness ratio below which the window is too sparse to assess
  // → null. Default 0.6.
  sparseRatio?: number;
  // Current episode state for this (station, parameter). Drives hysteresis.
  // Default 'closed'.
  previousState?: EpisodeState;
}

export interface AnomalyStats {
  mean: number;
  std: number;
  z: number;
  sampleSize: number;
  // Reference window the stats were computed over (excludes the candidate).
  window: { from: string; to: string };
}

export interface AnomalyVerdict {
  parameter: Parameter;
  // The candidate (most recent) point that was assessed.
  value: number;
  recordedAt: string;
  direction: AnomalyDirection;
  level: AnomalyLevel;
  // The statistical boundary the value crossed: μ ± k·σ in the candidate's
  // direction. Stored as the alert's thresholdValue for transparency.
  boundary: number;
  stats: AnomalyStats;
}

const DEFAULT_REFERENCE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_K = 2;
const DEFAULT_CLOSE_K = 1.5;
const DEFAULT_ALERT_K = 3;
const DEFAULT_MIN_SAMPLES = 30;
const DEFAULT_MIN_STD = 1e-9;
const DEFAULT_EXPECTED_INTERVAL_MIN = 10;
const DEFAULT_SPARSE_RATIO = 0.6;

function toMs(d: string | Date): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

export function detectAnomaly(
  parameter: Parameter,
  points: readonly AnomalyPoint[],
  opts: AnomalyDetectionOptions = {}
): AnomalyVerdict | null {
  const referenceWindowMs = opts.referenceWindowMs ?? DEFAULT_REFERENCE_WINDOW_MS;
  const k = opts.k ?? DEFAULT_K;
  const closeK = opts.closeK ?? DEFAULT_CLOSE_K;
  const alertK = opts.alertK ?? DEFAULT_ALERT_K;
  const minSamples = opts.minSamples ?? DEFAULT_MIN_SAMPLES;
  const minStd = opts.minStd ?? DEFAULT_MIN_STD;
  const expectedIntervalMinutes = opts.expectedIntervalMinutes ?? DEFAULT_EXPECTED_INTERVAL_MIN;
  const sparseRatio = opts.sparseRatio ?? DEFAULT_SPARSE_RATIO;
  const previousState = opts.previousState ?? 'closed';

  // Drop unparseable points, then sort ascending (don't trust input order).
  const sorted = points
    .filter((p) => !Number.isNaN(toMs(p.t)) && Number.isFinite(p.v))
    .slice()
    .sort((a, b) => toMs(a.t) - toMs(b.t));

  if (sorted.length === 0) return null;

  // Candidate = most recent point. Reference = points strictly before it within
  // the trailing window, so the candidate never contaminates its own baseline.
  const candidate = sorted[sorted.length - 1]!;
  const candidateMs = toMs(candidate.t);
  const refFromMs = candidateMs - referenceWindowMs;
  const reference = sorted.filter((p) => {
    const t = toMs(p.t);
    return t >= refFromMs && t < candidateMs;
  });

  const sampleSize = reference.length;
  if (sampleSize < minSamples) return null;

  // Sparseness guard: too few points relative to the expected cadence means the
  // window is hollow and σ unreliable — refuse to assess rather than guess.
  const intervalMs = expectedIntervalMinutes * 60_000;
  const expectedPoints =
    intervalMs > 0 ? Math.max(1, Math.floor(referenceWindowMs / intervalMs)) : 0;
  const ratio = expectedPoints > 0 ? Math.min(1, sampleSize / expectedPoints) : 1;
  if (ratio < sparseRatio) return null;

  const mean = reference.reduce((acc, p) => acc + p.v, 0) / sampleSize;
  // Sample standard deviation (Bessel's n−1): the reference is a sample we use to
  // estimate the underlying variability, not the whole population.
  const variance =
    reference.reduce((acc, p) => acc + (p.v - mean) * (p.v - mean), 0) / (sampleSize - 1);
  const std = Math.sqrt(variance);

  // Constant (or near-constant) series: z is undefined / explosive → null.
  if (!Number.isFinite(std) || std <= minStd) return null;

  const z = (candidate.v - mean) / std;
  const absZ = Math.abs(z);

  // Hysteresis: an open episode uses the lower close threshold; a closed one uses
  // the open threshold. Below the active threshold → no anomaly now (→ caller
  // closes any open episode).
  const activeThreshold = previousState === 'open' ? closeK : k;
  if (absZ < activeThreshold) return null;

  const direction: AnomalyDirection = z >= 0 ? 'ABOVE' : 'BELOW';
  const level: AnomalyLevel = absZ >= alertK ? 'ALERT' : 'VIGILANCE';
  const boundary = direction === 'ABOVE' ? mean + k * std : mean - k * std;

  return {
    parameter,
    value: candidate.v,
    recordedAt: new Date(candidateMs).toISOString(),
    direction,
    level,
    boundary,
    stats: {
      mean,
      std,
      z,
      sampleSize,
      window: {
        from: new Date(refFromMs).toISOString(),
        to: new Date(candidateMs).toISOString(),
      },
    },
  };
}
