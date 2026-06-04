import type { MeasurementPoint, Parameter } from '@alpimonitor/shared';

import type { ThresholdConfig } from '../utils/station-status.js';

// AI layer — extension A2 (ADR-012). Pure, deterministic feature extraction
// over a single parameter's measurement series within a time window.
//
// These features are the ONLY thing the LLM ever sees (strict grounding):
// the model phrases pre-computed facts, it never predicts, invents, or
// extrapolates. No I/O, no Date.now(), no LLM — fully unit-testable.

export type TrendLabel = 'RISING' | 'FALLING' | 'STABLE';

// Current value vs thresholds. NOT a binary: a station can be below vigilance
// (NORMAL), at vigilance, or at alert. Absence of a threshold yields `null` —
// we never invent a status the data can't support.
export type ThresholdLevel = 'NORMAL' | 'VIGILANCE' | 'ALERT';

export interface NarrationFeaturesOptions {
  // |deltaPct| at or below this is STABLE (default 5%). Guards against a raw
  // sign read calling a noise-level change a "trend".
  stabilityPct?: number;
  // |deltaAbs| at or below this is STABLE regardless of % (default 0 = off).
  // Useful for hydro values where % misleads near zero.
  stabilityAbs?: number;
  // completeness ratio below this flags the window as `sparse` (default 0.6),
  // so downstream can refuse to narrate a trend over hollow data.
  sparseRatio?: number;
}

export interface NarrationFeaturesInput {
  parameter: Parameter;
  unit: string;
  windowFrom: string | Date;
  windowTo: string | Date;
  points: readonly MeasurementPoint[];
  // Expected sampling cadence, used to compute completeness. Caller supplies
  // it explicitly (e.g. 10 for the LINDAS 10-min cron) — kept out of the
  // function so it stays pure and free of source assumptions.
  expectedIntervalMinutes: number;
  // Threshold for the current-status feature. `null`/absent → status is null.
  threshold?: ThresholdConfig | null;
  options?: NarrationFeaturesOptions;
}

export interface NarrationCompleteness {
  expectedPoints: number;
  presentPoints: number;
  ratio: number; // 0..1, clamped
  sparse: boolean;
  largestGapMinutes: number | null; // null when fewer than 2 points
}

export interface NarrationFeatures {
  parameter: Parameter;
  unit: string;
  window: { from: string; to: string };
  count: number;
  hasData: boolean;
  // Endpoints of the window (carry timestamps — needed to frame the window).
  firstValue: number | null;
  firstAt: string | null;
  lastValue: number | null;
  lastAt: string | null;
  // Extrema values. Extrema timestamps are deferred (ADR-012 A: "later").
  minValue: number | null;
  maxValue: number | null;
  // Change over the window. Absolute is primary; percent is complementary and
  // null when the start value is 0 (a percent off zero is meaningless).
  deltaAbs: number | null;
  deltaPct: number | null;
  trend: TrendLabel | null;
  completeness: NarrationCompleteness;
  // Current value (= last point) classified against the threshold.
  status: ThresholdLevel | null;
}

const DEFAULT_STABILITY_PCT = 5;
const DEFAULT_STABILITY_ABS = 0;
const DEFAULT_SPARSE_RATIO = 0.6;

function toMs(d: string | Date): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

function classifyTrend(
  deltaAbs: number,
  deltaPct: number | null,
  stabilityPct: number,
  stabilityAbs: number
): TrendLabel {
  if (stabilityAbs > 0 && Math.abs(deltaAbs) <= stabilityAbs) return 'STABLE';
  if (deltaPct !== null && Math.abs(deltaPct) <= stabilityPct) return 'STABLE';
  if (deltaAbs > 0) return 'RISING';
  if (deltaAbs < 0) return 'FALLING';
  return 'STABLE';
}

function classifyStatus(value: number, threshold: ThresholdConfig): ThresholdLevel {
  if (threshold.direction === 'ABOVE') {
    if (value >= threshold.alertValue) return 'ALERT';
    if (value >= threshold.vigilanceValue) return 'VIGILANCE';
    return 'NORMAL';
  }
  // direction === 'BELOW'
  if (value <= threshold.alertValue) return 'ALERT';
  if (value <= threshold.vigilanceValue) return 'VIGILANCE';
  return 'NORMAL';
}

export function computeNarrationFeatures(input: NarrationFeaturesInput): NarrationFeatures {
  const fromMs = toMs(input.windowFrom);
  const toMsValue = toMs(input.windowTo);
  const threshold = input.threshold ?? null;

  const stabilityPct = input.options?.stabilityPct ?? DEFAULT_STABILITY_PCT;
  const stabilityAbs = input.options?.stabilityAbs ?? DEFAULT_STABILITY_ABS;
  const sparseRatio = input.options?.sparseRatio ?? DEFAULT_SPARSE_RATIO;

  // Keep only in-window points, then sort ascending (don't trust input order).
  const inWindow = input.points
    .filter((p) => {
      const t = toMs(p.t);
      return !Number.isNaN(t) && t >= fromMs && t <= toMsValue;
    })
    .slice()
    .sort((a, b) => toMs(a.t) - toMs(b.t));

  const count = inWindow.length;
  const hasData = count > 0;

  // Completeness — expected samples at the given cadence vs what we actually have.
  const intervalMs = input.expectedIntervalMinutes * 60_000;
  const windowMs = Math.max(0, toMsValue - fromMs);
  const expectedPoints =
    intervalMs > 0 && windowMs > 0 ? Math.max(1, Math.floor(windowMs / intervalMs)) : 0;
  const ratio = expectedPoints > 0 ? Math.min(1, count / expectedPoints) : hasData ? 1 : 0;

  let largestGapMinutes: number | null = null;
  if (count >= 2) {
    let maxGap = 0;
    for (let i = 1; i < count; i++) {
      const prev = inWindow[i - 1];
      const cur = inWindow[i];
      if (!prev || !cur) continue;
      const gap = toMs(cur.t) - toMs(prev.t);
      if (gap > maxGap) maxGap = gap;
    }
    largestGapMinutes = Math.round((maxGap / 60_000) * 10) / 10;
  }

  const completeness: NarrationCompleteness = {
    expectedPoints,
    presentPoints: count,
    ratio: Math.round(ratio * 1000) / 1000,
    sparse: ratio < sparseRatio,
    largestGapMinutes,
  };

  if (!hasData) {
    return {
      parameter: input.parameter,
      unit: input.unit,
      window: { from: new Date(fromMs).toISOString(), to: new Date(toMsValue).toISOString() },
      count: 0,
      hasData: false,
      firstValue: null,
      firstAt: null,
      lastValue: null,
      lastAt: null,
      minValue: null,
      maxValue: null,
      deltaAbs: null,
      deltaPct: null,
      trend: null,
      completeness,
      status: null,
    };
  }

  const first = inWindow[0]!;
  const last = inWindow[count - 1]!;

  let minValue = Infinity;
  let maxValue = -Infinity;
  for (const p of inWindow) {
    if (p.v < minValue) minValue = p.v;
    if (p.v > maxValue) maxValue = p.v;
  }

  // Delta needs at least two points; a single sample has no measurable change.
  const deltaAbs = count >= 2 ? last.v - first.v : null;
  const deltaPct =
    deltaAbs !== null && first.v !== 0
      ? Math.round((deltaAbs / Math.abs(first.v)) * 1000) / 10
      : null;
  const trend =
    deltaAbs !== null ? classifyTrend(deltaAbs, deltaPct, stabilityPct, stabilityAbs) : null;

  return {
    parameter: input.parameter,
    unit: input.unit,
    window: { from: new Date(fromMs).toISOString(), to: new Date(toMsValue).toISOString() },
    count,
    hasData: true,
    firstValue: first.v,
    firstAt: new Date(toMs(first.t)).toISOString(),
    lastValue: last.v,
    lastAt: new Date(toMs(last.t)).toISOString(),
    minValue,
    maxValue,
    deltaAbs,
    deltaPct,
    trend,
    completeness,
    status: threshold ? classifyStatus(last.v, threshold) : null,
  };
}
