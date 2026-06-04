import { describe, expect, it } from 'vitest';

import { computeNarrationFeatures } from '../src/ai/narration-features.js';
import type { ThresholdConfig } from '../src/utils/station-status.js';

// 24h window, 10-min cadence → 144 expected points.
const FROM = '2026-06-01T00:00:00.000Z';
const TO = '2026-06-02T00:00:00.000Z';
const FROM_MS = Date.parse(FROM);

function pt(offsetMin: number, v: number): { t: string; v: number } {
  return { t: new Date(FROM_MS + offsetMin * 60_000).toISOString(), v };
}

function base(points: { t: string; v: number }[], threshold?: ThresholdConfig | null) {
  return {
    parameter: 'DISCHARGE' as const,
    unit: 'm³/s',
    windowFrom: FROM,
    windowTo: TO,
    points,
    expectedIntervalMinutes: 10,
    threshold,
  };
}

describe('computeNarrationFeatures', () => {
  it('classifies a rising trend with absolute and percent delta', () => {
    const f = computeNarrationFeatures(base([pt(0, 10), pt(720, 20), pt(1430, 30)]));
    expect(f.trend).toBe('RISING');
    expect(f.firstValue).toBe(10);
    expect(f.lastValue).toBe(30);
    expect(f.deltaAbs).toBe(20);
    expect(f.deltaPct).toBe(200);
    expect(f.minValue).toBe(10);
    expect(f.maxValue).toBe(30);
    expect(f.count).toBe(3);
  });

  it('classifies a falling trend', () => {
    const f = computeNarrationFeatures(base([pt(0, 30), pt(1430, 10)]));
    expect(f.trend).toBe('FALLING');
    expect(f.deltaAbs).toBe(-20);
  });

  it('classifies a stable trend when percent change is within stability band', () => {
    const f = computeNarrationFeatures(base([pt(0, 100), pt(1430, 102)]));
    expect(f.trend).toBe('STABLE');
    expect(f.deltaAbs).toBe(2);
    expect(f.deltaPct).toBe(2);
  });

  it('treats a small absolute change as stable when stabilityAbs is set (percent misleads near zero)', () => {
    const input = { ...base([pt(0, 1), pt(1430, 1.2)]), options: { stabilityAbs: 0.5 } };
    const f = computeNarrationFeatures(input);
    // deltaPct = 20% would read RISING, but |deltaAbs|=0.2 <= 0.5 → STABLE
    expect(f.deltaPct).toBe(20);
    expect(f.trend).toBe('STABLE');
  });

  it('returns null-rich features and no status when the window is empty', () => {
    const f = computeNarrationFeatures(
      base([], { vigilanceValue: 40, alertValue: 80, direction: 'ABOVE' })
    );
    expect(f.hasData).toBe(false);
    expect(f.count).toBe(0);
    expect(f.firstValue).toBeNull();
    expect(f.lastValue).toBeNull();
    expect(f.deltaAbs).toBeNull();
    expect(f.deltaPct).toBeNull();
    expect(f.trend).toBeNull();
    expect(f.status).toBeNull();
    expect(f.completeness.presentPoints).toBe(0);
    expect(f.completeness.ratio).toBe(0);
  });

  it('has no delta or trend for a single point but still computes status', () => {
    const f = computeNarrationFeatures(
      base([pt(0, 50)], { vigilanceValue: 40, alertValue: 80, direction: 'ABOVE' })
    );
    expect(f.count).toBe(1);
    expect(f.deltaAbs).toBeNull();
    expect(f.deltaPct).toBeNull();
    expect(f.trend).toBeNull();
    expect(f.status).toBe('VIGILANCE');
  });

  describe('status vs thresholds (current value = last point)', () => {
    const above: ThresholdConfig = { vigilanceValue: 40, alertValue: 80, direction: 'ABOVE' };

    it('flags ALERT when last value reaches the alert threshold (ABOVE)', () => {
      const f = computeNarrationFeatures(base([pt(0, 10), pt(1430, 90)], above));
      expect(f.status).toBe('ALERT');
    });

    it('flags VIGILANCE between vigilance and alert (ABOVE)', () => {
      const f = computeNarrationFeatures(base([pt(0, 10), pt(1430, 50)], above));
      expect(f.status).toBe('VIGILANCE');
    });

    it('flags NORMAL below vigilance (ABOVE)', () => {
      const f = computeNarrationFeatures(base([pt(0, 10), pt(1430, 20)], above));
      expect(f.status).toBe('NORMAL');
    });

    it('handles BELOW direction (low-flow style thresholds)', () => {
      const below: ThresholdConfig = { vigilanceValue: 20, alertValue: 10, direction: 'BELOW' };
      expect(computeNarrationFeatures(base([pt(0, 30), pt(1430, 5)], below)).status).toBe('ALERT');
      expect(computeNarrationFeatures(base([pt(0, 30), pt(1430, 15)], below)).status).toBe(
        'VIGILANCE'
      );
      expect(computeNarrationFeatures(base([pt(0, 30), pt(1430, 30)], below)).status).toBe(
        'NORMAL'
      );
    });

    it('returns null status for a parameter without any threshold (no invention)', () => {
      const f = computeNarrationFeatures(base([pt(0, 10), pt(1430, 90)], null));
      expect(f.status).toBeNull();
    });

    it('returns null status when threshold is omitted entirely', () => {
      const f = computeNarrationFeatures(base([pt(0, 10), pt(1430, 90)]));
      expect(f.status).toBeNull();
    });
  });

  it('keeps percent delta null when the start value is zero but reports absolute delta', () => {
    const f = computeNarrationFeatures(base([pt(0, 0), pt(1430, 5)]));
    expect(f.deltaAbs).toBe(5);
    expect(f.deltaPct).toBeNull();
    expect(f.trend).toBe('RISING');
  });

  it('flags sparse/incomplete data over a hollow window', () => {
    // 5 points over a 24h/10-min window (expected 144) → deeply incomplete.
    const f = computeNarrationFeatures(
      base([pt(0, 1), pt(10, 2), pt(20, 3), pt(30, 4), pt(40, 5)])
    );
    expect(f.completeness.expectedPoints).toBe(144);
    expect(f.completeness.presentPoints).toBe(5);
    expect(f.completeness.ratio).toBeLessThan(0.6);
    expect(f.completeness.sparse).toBe(true);
  });

  it('does not flag sparse when the window is fully sampled', () => {
    const points = Array.from({ length: 144 }, (_, i) => pt(i * 10, 100 + i));
    const f = computeNarrationFeatures(base(points));
    expect(f.completeness.presentPoints).toBe(144);
    expect(f.completeness.ratio).toBe(1);
    expect(f.completeness.sparse).toBe(false);
  });

  it('reports the largest inter-point gap in minutes', () => {
    // gaps: 10 min, then 590 min
    const f = computeNarrationFeatures(base([pt(0, 1), pt(10, 2), pt(600, 3)]));
    expect(f.completeness.largestGapMinutes).toBe(590);
  });

  it('has a null largest gap with fewer than two points', () => {
    const f = computeNarrationFeatures(base([pt(0, 1)]));
    expect(f.completeness.largestGapMinutes).toBeNull();
  });

  it('ignores points outside the window', () => {
    const before = { t: new Date(FROM_MS - 100 * 60_000).toISOString(), v: 999 };
    const after = { t: new Date(Date.parse(TO) + 100 * 60_000).toISOString(), v: -999 };
    const f = computeNarrationFeatures(base([before, pt(0, 10), pt(1430, 30), after]));
    expect(f.count).toBe(2);
    expect(f.firstValue).toBe(10);
    expect(f.lastValue).toBe(30);
    expect(f.maxValue).toBe(30);
  });

  it('sorts unordered input before computing endpoints', () => {
    const f = computeNarrationFeatures(base([pt(1430, 30), pt(0, 10), pt(720, 20)]));
    expect(f.firstValue).toBe(10);
    expect(f.lastValue).toBe(30);
    expect(f.trend).toBe('RISING');
  });
});
