import type { PrismaClient } from '@prisma/client';

import type { AlertDTO, AlertLevel, AlertType, Parameter } from '@alpimonitor/shared';

import type { AnomalyVerdict } from '../anomaly/anomaly-detection.js';

// AI layer — extension B2 (ADR-012). Episodic persistence of statistical anomaly
// alerts. The invariant: ONE open Alert per (station, parameter) per anomaly
// episode. A sustained anomaly updates that single row; a return to normal closes
// it (sets closedAt). No migration — reuses the Alert model and the
// STATISTICAL_ANOMALY type that have existed since the init migration.

const ANOMALY_TYPE = 'STATISTICAL_ANOMALY' as const;

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
    // B1-bis: the μ/σ/z above are per-hour (deseasonalised); these expose which
    // hour bucket and how many same-hour points they were built from.
    hourBucket: verdict.stats.hourBucket,
    bucketSampleSize: verdict.stats.bucketSampleSize,
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

// ---------- Read side: GET /api/v1/alerts (B3) ----------

export type AlertStatusFilter = 'open' | 'closed' | 'all';

export interface ListAlertsParams {
  status: AlertStatusFilter;
  stationId?: string;
  type?: AlertType;
  limit: number;
}

interface AlertEntity {
  id: string;
  stationId: string;
  type: string;
  level: string;
  parameter: string;
  triggerValue: number;
  thresholdValue: number | null;
  openedAt: Date;
  closedAt: Date | null;
  metadata: unknown;
}

function toAlertDto(a: AlertEntity): AlertDTO {
  return {
    id: a.id,
    stationId: a.stationId,
    type: a.type as AlertType,
    level: a.level as AlertLevel,
    parameter: a.parameter as Parameter,
    triggerValue: a.triggerValue,
    thresholdValue: a.thresholdValue,
    openedAt: a.openedAt.toISOString(),
    closedAt: a.closedAt ? a.closedAt.toISOString() : null,
    // Prisma types JSON as a broad union; the column only ever holds an object
    // (the grounded stats) or null in practice.
    metadata: (a.metadata as Record<string, unknown> | null) ?? null,
  };
}

export async function listAlerts(
  prisma: PrismaClient,
  params: ListAlertsParams
): Promise<AlertDTO[]> {
  const statusWhere =
    params.status === 'open'
      ? { closedAt: null }
      : params.status === 'closed'
        ? { NOT: { closedAt: null } }
        : {};

  const rows = await prisma.alert.findMany({
    where: {
      ...statusWhere,
      ...(params.stationId ? { stationId: params.stationId } : {}),
      ...(params.type ? { type: params.type } : {}),
    },
    orderBy: { openedAt: 'desc' },
    take: params.limit,
    select: {
      id: true,
      stationId: true,
      type: true,
      level: true,
      parameter: true,
      triggerValue: true,
      thresholdValue: true,
      openedAt: true,
      closedAt: true,
      metadata: true,
    },
  });

  return rows.map(toAlertDto);
}
