import type { AlertDTO } from '@alpimonitor/shared';

// AI layer — extension B4 (ADR-012). Pure, deterministic helpers that turn an
// AlertDTO into the small pieces the panel renders. No I/O, no Date.now(), no
// i18n — the component wraps these tokens in localised strings. The grounded
// stats live in `metadata` as an opaque JSON bag (mean/std/z/hourBucket/…);
// we read them defensively because the column is typed `unknown` end-to-end.

export type AlertDirection = 'ABOVE' | 'BELOW';

function metaNumber(metadata: Record<string, unknown> | null, key: string): number | null {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// Per-hour deseasonalised z-score the verdict was built from (B1-bis), or null
// if the metadata bag is missing it.
export function alertZ(alert: AlertDTO): number | null {
  return metaNumber(alert.metadata, 'z');
}

// UTC hour-of-day bucket (0–23) the candidate was compared against.
export function alertHourBucket(alert: AlertDTO): number | null {
  return metaNumber(alert.metadata, 'hourBucket');
}

// Direction of the anomaly. Prefer the sign of z (the statistic that fired);
// fall back to the trigger-vs-boundary comparison if metadata is absent.
export function alertDirection(alert: AlertDTO): AlertDirection {
  const z = alertZ(alert);
  if (z !== null) return z >= 0 ? 'ABOVE' : 'BELOW';
  if (alert.thresholdValue !== null) {
    return alert.triggerValue >= alert.thresholdValue ? 'ABOVE' : 'BELOW';
  }
  return 'ABOVE';
}

// One decimal, with a typographic minus so "-2.4" reads as "−2,4"-grade text.
export function formatZ(z: number | null): string | null {
  if (z === null) return null;
  return z.toFixed(1).replace('-', '−');
}

// Zero-padded UTC hour ("6" → "06"). The component appends " h UTC".
export function formatHourBucket(hour: number | null): string | null {
  if (hour === null) return null;
  return String(hour).padStart(2, '0');
}

// Compact UTC day + time from an ISO-8601 string, parsed by string slicing so
// the result is timezone- and clock-independent (deterministic in tests).
// "2026-06-04T06:10:00.000Z" → "04.06 06:10".
export function formatIsoDayTime(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, , month, day, hh, mm] = match;
  return `${day}.${month} ${hh}:${mm}`;
}
