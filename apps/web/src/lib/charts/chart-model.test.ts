import type { MeasurementPoint } from '@alpimonitor/shared';
import { describe, expect, it } from 'vitest';

import { computeYDomain, findNearestPointByPx } from './chart-model';

describe('computeYDomain', () => {
  it('returns [0, 1] for an empty series (avoids a zero-height scale)', () => {
    expect(computeYDomain([])).toEqual([0, 1]);
  });

  it('returns [0, 1] when all values are non-positive', () => {
    expect(computeYDomain([0, 0, 0])).toEqual([0, 1]);
  });

  it('adds 10% headroom above the max value', () => {
    const [min, max] = computeYDomain([4, 10, 7]);
    expect(min).toBe(0);
    expect(max).toBeCloseTo(11, 5);
  });

  it('pins the floor to 0 even when the series min is large', () => {
    const [min] = computeYDomain([50, 55, 60]);
    expect(min).toBe(0);
  });
});

function pt(t: string, v: number): MeasurementPoint {
  return { t, v };
}

describe('findNearestPointByPx', () => {
  const points = [
    pt('2026-04-21T10:00:00Z', 1),
    pt('2026-04-21T12:00:00Z', 2),
    pt('2026-04-21T14:00:00Z', 3),
  ];
  const project = (p: MeasurementPoint): number => {
    if (p.t.startsWith('2026-04-21T10')) return 0;
    if (p.t.startsWith('2026-04-21T12')) return 100;
    return 200;
  };

  it('returns null for an empty list', () => {
    expect(findNearestPointByPx([], 50, project)).toBeNull();
  });

  it('picks the point closest to the cursor pixel', () => {
    expect(findNearestPointByPx(points, 110, project)?.v).toBe(2);
    expect(findNearestPointByPx(points, 5, project)?.v).toBe(1);
    expect(findNearestPointByPx(points, 190, project)?.v).toBe(3);
  });

  it('resolves ties by keeping the earlier candidate (stable)', () => {
    // Cursor exactly between two adjacent points → earlier wins.
    expect(findNearestPointByPx(points, 50, project)?.v).toBe(1);
  });
});
