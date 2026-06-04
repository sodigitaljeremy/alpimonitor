import { z } from 'zod';

// GET /api/v1/alerts — query validation, mirroring schemas/stations.ts.

export const ALERT_STATUS_VALUES = ['open', 'closed', 'all'] as const;
export const ALERT_TYPE_VALUES = [
  'THRESHOLD_EXCEEDED',
  'STATISTICAL_ANOMALY',
  'STATION_OFFLINE',
] as const;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const listAlertsQuerySchema = z.object({
  // Episode lifecycle filter. Defaults to `open` — the panel's primary concern
  // is what's currently anomalous, not historical noise.
  status: z
    .enum(ALERT_STATUS_VALUES)
    .optional()
    .transform((v) => v ?? 'open'),
  stationId: z.string().min(1).optional(),
  type: z.enum(ALERT_TYPE_VALUES).optional(),
  // Query params arrive as strings, so coerce; cap to keep the response bounded.
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_LIMIT)
    .optional()
    .transform((v) => v ?? DEFAULT_LIMIT),
});

export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
