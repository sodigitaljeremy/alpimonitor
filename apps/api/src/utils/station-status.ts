import type { StationStatus } from '@alpimonitor/shared';

// A measurement is considered OFFLINE if its recordedAt is older than this.
// The LINDAS cron ticks every 10 min → 60 min leaves room for ~5 consecutive
// misses before the UI flags a station offline, which is stricter than the
// global ingestion badge (30 min) by design: a single station can lag even
// when the global pipeline is healthy.
export const STATION_STALE_MINUTES = 60;

export interface ThresholdConfig {
  vigilanceValue: number;
  alertValue: number;
  direction: 'ABOVE' | 'BELOW';
}

// Pure function, easy to unit-test. `now` is injectable for deterministic tests.
export function computeMeasurementStatus(
  value: number,
  recordedAt: Date,
  threshold: ThresholdConfig | null,
  now: Date = new Date()
): StationStatus {
  const ageMinutes = (now.getTime() - recordedAt.getTime()) / 60_000;
  if (ageMinutes > STATION_STALE_MINUTES) return 'OFFLINE';

  if (!threshold) return 'NORMAL';

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
