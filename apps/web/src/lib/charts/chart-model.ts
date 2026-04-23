import type { MeasurementPoint } from '@alpimonitor/shared';

// 10% headroom above the max so the line never kisses the top axis and
// the area fill still reads as "filled". For a flat series (min === max)
// we pad by 1 unit to avoid a zero-height domain that breaks scaleLinear.
export function computeYDomain(values: readonly number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  let max = -Infinity;
  for (const v of values) if (v > max) max = v;
  if (max <= 0) return [0, 1];
  return [0, max * 1.1];
}

// Find the point whose projected x-pixel is closest to the cursor.
// Caller provides the projection (xScale) so this stays pure w.r.t. D3 —
// the hot-path tooltip handler doesn't need to reconstruct scales.
export function findNearestPointByPx(
  points: readonly MeasurementPoint[],
  xPx: number,
  project: (p: MeasurementPoint) => number
): MeasurementPoint | null {
  if (points.length === 0) return null;
  let best = points[0];
  let bestDist = Math.abs(project(best) - xPx);
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    const d = Math.abs(project(p) - xPx);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}
