import type { PrismaClient } from '@prisma/client';

import type { Parameter } from '@alpimonitor/shared';

import type { AnomalyVerdict } from '../anomaly/anomaly-detection.js';

// AI layer — extension B2 (ADR-012). Episodic persistence of statistical anomaly
// alerts. The invariant: ONE open Alert per (station, parameter) per anomaly
// episode. A sustained anomaly updates that single row; a return to normal closes
// it (sets closedAt). No migration — reuses the Alert model and the
// STATISTICAL_ANOMALY type that have existed since the init migration.

const ANOMALY_TYPE = 'STATISTICAL_ANOMALY' as const;

export type AlertLevel = 'INFO' | 'VIGILANCE' | 'ALERT';

// The currently-open episode for a (station, parameter), if any. Carries `level`
// so the caller can see escalation, and `id` to update/close in place.
export interface OpenAlertRef {
  id: string;
  level: AlertLevel;
}

export type ReconcileAction = 'opened' | 'updated' | 'closed' | 'none';

export interface ReconcileResult {
  action: ReconcileAction;
  alertId: string | null;
}

// The grounded stats persisted alongside the alert — the exact numbers the
// verdict was built from, for transparency and a future narration/UI layer.
function buildMetadata(verdict: AnomalyVerdict): Record<string, number | string> {
  return {
    mean: verdict.stats.mean,
    std: verdict.stats.std,
    z: verdict.stats.z,
    sampleSize: verdict.stats.sampleSize,
    windowFrom: verdict.stats.window.from,
    windowTo: verdict.stats.window.to,
  };
}

// Finds the single open anomaly episode for a (station, parameter), or null.
// "Open" = closedAt is null. Ordered by openedAt desc so that, even if a prior
// bug ever left two open, we reconcile against the most recent.
export async function findOpenAnomalyAlert(
  prisma: PrismaClient,
  stationId: string,
  parameter: Parameter
): Promise<OpenAlertRef | null> {
  const alert = await prisma.alert.findFirst({
    where: { stationId, parameter, type: ANOMALY_TYPE, closedAt: null },
    orderBy: { openedAt: 'desc' },
    select: { id: true, level: true },
  });
  return alert ? { id: alert.id, level: alert.level as AlertLevel } : null;
}

// Reconciles one (station, parameter) episode against a fresh verdict:
//   verdict + no open alert → open a new Alert
//   verdict + open alert    → update it in place (level/value/threshold/metadata)
//   no verdict + open alert → close it (closedAt = now)
//   no verdict + no alert   → nothing to do
export async function reconcileAnomalyAlert(
  prisma: PrismaClient,
  params: {
    stationId: string;
    parameter: Parameter;
    verdict: AnomalyVerdict | null;
    openAlert: OpenAlertRef | null;
    now: Date;
  }
): Promise<ReconcileResult> {
  const { stationId, parameter, verdict, openAlert, now } = params;

  if (verdict) {
    const metadata = buildMetadata(verdict);
    if (!openAlert) {
      const created = await prisma.alert.create({
        data: {
          stationId,
          parameter,
          type: ANOMALY_TYPE,
          level: verdict.level,
          triggerValue: verdict.value,
          thresholdValue: verdict.boundary,
          metadata,
        },
        select: { id: true },
      });
      return { action: 'opened', alertId: created.id };
    }

    await prisma.alert.update({
      where: { id: openAlert.id },
      data: {
        level: verdict.level,
        triggerValue: verdict.value,
        thresholdValue: verdict.boundary,
        metadata,
      },
    });
    return { action: 'updated', alertId: openAlert.id };
  }

  if (openAlert) {
    await prisma.alert.update({
      where: { id: openAlert.id },
      data: { closedAt: now },
    });
    return { action: 'closed', alertId: openAlert.id };
  }

  return { action: 'none', alertId: null };
}
