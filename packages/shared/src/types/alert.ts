import type { Parameter } from './common.js';

// AI layer — extension B (ADR-012). DTO for the statistical anomaly alerts
// surfaced by GET /api/v1/alerts. Mirrors the Prisma Alert model, serialised:
// dates as ISO strings, metadata as an opaque JSON bag (the grounded stats the
// verdict was built from — mean/std/z/sampleSize/windowFrom/windowTo).

export type AlertType = 'THRESHOLD_EXCEEDED' | 'STATISTICAL_ANOMALY' | 'STATION_OFFLINE';

export type AlertLevel = 'INFO' | 'VIGILANCE' | 'ALERT';

export interface AlertDTO {
  id: string;
  stationId: string;
  type: AlertType;
  level: AlertLevel;
  parameter: Parameter;
  triggerValue: number;
  thresholdValue: number | null;
  openedAt: string; // ISO
  closedAt: string | null; // ISO; null while the episode is open
  metadata: Record<string, unknown> | null;
}
