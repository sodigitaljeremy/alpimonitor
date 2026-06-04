import type { PrismaClient } from '@prisma/client';

import type { Parameter } from '@alpimonitor/shared';

import { INGESTION_INTERVAL_MINUTES } from '../ingestion/cadence.js';
import { findOpenAnomalyAlert, reconcileAnomalyAlert } from '../services/alerts-service.js';
import { detectAnomaly } from './anomaly-detection.js';

// AI layer — extension B2 (ADR-012). Orchestrates a statistical anomaly scan over
// every LIVE station × ingested parameter, then reconciles episodes via the
// alerts-service. Runs AFTER (and isolated from) the LINDAS ingestion tick: it
// only READS measurements, so it can never block or corrupt the critical
// ingestion path. Pure detection lives in anomaly-detection.ts; this module is
// the thin I/O shell around it.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Minimal logger surface (Fastify's app.log satisfies it) so this module need
// not depend on Fastify types.
export interface ScanLogger {
  info(obj: object, msg?: string): void;
}

export interface AnomalyScanDeps {
  prisma: PrismaClient;
  logger?: ScanLogger;
  now?: () => Date;
  referenceWindowMs?: number;
}

export interface AnomalyScanResult {
  evaluated: number;
  opened: number;
  updated: number;
  closed: number;
}

export async function runAnomalyScan(deps: AnomalyScanDeps): Promise<AnomalyScanResult> {
  const now = deps.now ?? (() => new Date());
  const referenceWindowMs = deps.referenceWindowMs ?? SEVEN_DAYS_MS;
  const at = now();
  // Load a touch more than the reference window so the candidate point (the most
  // recent sample) always has a full trailing baseline behind it.
  const since = new Date(at.getTime() - referenceWindowMs - INGESTION_INTERVAL_MINUTES * 60_000);

  const stations = await deps.prisma.station.findMany({
    where: { dataSource: 'LIVE', isActive: true },
    select: {
      id: true,
      sensors: { where: { isActive: true }, select: { id: true, parameter: true } },
    },
  });

  const result: AnomalyScanResult = { evaluated: 0, opened: 0, updated: 0, closed: 0 };

  for (const station of stations) {
    for (const sensor of station.sensors) {
      const parameter = sensor.parameter as Parameter;

      const rows = await deps.prisma.measurement.findMany({
        where: { sensorId: sensor.id, recordedAt: { gte: since } },
        orderBy: { recordedAt: 'asc' },
        select: { value: true, recordedAt: true },
      });
      if (rows.length === 0) continue;
      result.evaluated += 1;

      const points = rows.map((r) => ({ t: r.recordedAt, v: r.value }));
      const openAlert = await findOpenAnomalyAlert(deps.prisma, station.id, parameter);

      const verdict = detectAnomaly(parameter, points, {
        // Hysteresis: an already-open episode uses the lower close threshold.
        previousState: openAlert ? 'open' : 'closed',
        referenceWindowMs,
        expectedIntervalMinutes: INGESTION_INTERVAL_MINUTES,
      });

      const reconciled = await reconcileAnomalyAlert(deps.prisma, {
        stationId: station.id,
        parameter,
        verdict,
        openAlert,
        now: at,
      });

      if (reconciled.action === 'opened') result.opened += 1;
      else if (reconciled.action === 'updated') result.updated += 1;
      else if (reconciled.action === 'closed') result.closed += 1;
    }
  }

  deps.logger?.info(result, 'anomaly-scan: complete');
  return result;
}
