import type { Parameter } from '@alpimonitor/shared';

// AI layer — extension B1-bis (ADR-012). Pure, deterministic statistical anomaly
// detection over a single parameter's measurement series. No I/O, no Date.now(),
// no LLM — fully unit-testable. The LLM (if ever wired) only *narrates* a verdict
// produced here; it never decides whether a point is anomalous.
//
// Method: HOUR-OF-DAY DESEASONALISED z-score. The candidate (most recent) point
// is compared NOT to the whole trailing window, but to the distribution of points
// from the SAME hour-of-day in the trailing reference window — "this 06:00 trough
// vs the 06:00 troughs of the previous days". Glacier-fed rivers have a strong
// diurnal melt cycle; a plain whole-window z-score flags every nightly trough as a
// BELOW anomaly (the trough sits well under the 24 h mean). Bucketing by hour
// removes the diurnal component from the baseline, so only a value that is unusual
// FOR ITS HOUR fires.
//
//   bucket = reference points whose recordedAt UTC hour == candidate's UTC hour
//   z      = (xN − μ_bucket) / σ_bucket
//   |z| ≥ k            → anomaly (k = 2 by default)
//   z > 0 → ABOVE, z < 0 → BELOW
//   |z| ≥ 3            → ALERT, otherwise VIGILANCE
//
// Why UTC hour is the right bucket key: recordedAt is stored in UTC, and over a
// 7–14 day reference window the Swiss civil offset is constant (no DST flip on a
// summer monitoring window), so the same UTC hour is the same moment of the local
// day across all reference days. We group by the raw UTC hour and never convert.
//
// Excluding the candidate from its bucket keeps a genuine outlier from inflating
// μ/σ and masking itself. Per-bucket guards (minBucketSamples, σ_bucket ≈ 0) mean
// cold-start stations with under-populated hour buckets return `null` honestly
// rather than firing on a flimsy baseline.
//
// Hysteresis (debounce): a CLOSED episode opens only at |z| ≥ k (2σ); an already
// OPEN episode stays open until |z| < closeK (1.5σ). The caller passes the current
// episode state; the function stays pure by taking it as input. A returned verdict
// always means "anomaly active now"; `null` always means "no anomaly now" (so the
// caller closes any open episode). Thresholds and hysteresis are unchanged from the
// pre-deseasonalisation detector — only the z they judge is now per-hour.

export type AnomalyDirection = 'ABOVE' | 'BELOW';
export type AnomalyLevel = 'VIGILANCE' | 'ALERT';
export type EpisodeState = 'open' | 'closed';

export interface AnomalyPoint {
  t: string | Date;
  v: number;
}

export interface AnomalyDetectionOptions {
  // Trailing reference window length, in ms. Default 7 days. The window only
  // bounds which past days feed the hour buckets; the diurnal cycle is removed by
  // the bucketing itself, not by the window length.
  referenceWindowMs?: number;
  // Open threshold in σ units. |z| ≥ k opens an episode. Default 2.
  k?: number;
  // Close threshold in σ units (hysteresis). An open episode stays open until
  // |z| < closeK. Default 1.5. Must be ≤ k to debounce rather than flap.
  closeK?: number;
  // |z| ≥ alertK escalates VIGILANCE → ALERT. Default 3.
  alertK?: number;
  // Minimum SAME-HOUR sample size. Below this, the hour bucket is too thin to
  // trust σ → null. Default 20 (≈ 3+ days of points at the 10-min cadence).
  minBucketSamples?: number;
  // σ_bucket at or below this is treated as a constant series (no variance) →
  // null. Default 1e-9: only catches genuinely flat data, not real hydro noise.
  minStd?: number;
  // Current episode state for this (station, parameter). Drives hysteresis.
  // Default 'closed'.
  previousState?: EpisodeState;
}

export interface AnomalyStats {
  mean: number;
  std: number;
  z: number;
  // Total reference points in the trailing window (excludes the candidate).
  sampleSize: number;
  // UTC hour-of-day (0–23) of the candidate — the bucket key.
  hourBucket: number;
  // Same-hour subset the μ/σ/z were actually computed over. Always ≤ sampleSize.
  bucketSampleSize: number;
  // Reference window the bucket was drawn from (excludes the candidate).
  window: { from: string; to: string };
}

export interface AnomalyVerdict {
  parameter: Parameter;
  // The candidate (most recent) point that was assessed.
  value: number;
  recordedAt: string;
  direction: AnomalyDirection;
  level: AnomalyLevel;
  // The statistical boundary the value crossed: μ_bucket ± k·σ_bucket in the
  // candidate's direction. Stored as the alert's thresholdValue for transparency.
  boundary: number;
  stats: AnomalyStats;
}

const DEFAULT_REFERENCE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_K = 2;
const DEFAULT_CLOSE_K = 1.5;
const DEFAULT_ALERT_K = 3;
const DEFAULT_MIN_BUCKET_SAMPLES = 20;
const DEFAULT_MIN_STD = 1e-9;

function toMs(d: string | Date): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

function hourOf(ms: number): number {
  return new Date(ms).getUTCHours();
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
  const minBucketSamples = opts.minBucketSamples ?? DEFAULT_MIN_BUCKET_SAMPLES;
  const minStd = opts.minStd ?? DEFAULT_MIN_STD;
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
  const candidateHour = hourOf(candidateMs);
  const refFromMs = candidateMs - referenceWindowMs;
  const reference = sorted.filter((p) => {
    const t = toMs(p.t);
    return t >= refFromMs && t < candidateMs;
  });

  // Deseasonalise: keep only reference points from the SAME UTC hour as the
  // candidate. This is the bucket the candidate is judged against.
  const bucket = reference.filter((p) => hourOf(toMs(p.t)) === candidateHour);

  const sampleSize = reference.length;
  const bucketSampleSize = bucket.length;

  // Per-bucket guard: too few same-hour points means σ for this hour is not
  // trustworthy (typical of cold-start stations) → refuse to assess.
  if (bucketSampleSize < minBucketSamples) return null;

  const mean = bucket.reduce((acc, p) => acc + p.v, 0) / bucketSampleSize;
  // Sample standard deviation (Bessel's n−1): the bucket is a sample we use to
  // estimate this hour's underlying variability, not the whole population.
  const variance =
    bucket.reduce((acc, p) => acc + (p.v - mean) * (p.v - mean), 0) / (bucketSampleSize - 1);
  const std = Math.sqrt(variance);

  // Constant (or near-constant) hour bucket: z is undefined / explosive → null.
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
      hourBucket: candidateHour,
      bucketSampleSize,
      window: {
        from: new Date(refFromMs).toISOString(),
        to: new Date(candidateMs).toISOString(),
      },
    },
  };
}
