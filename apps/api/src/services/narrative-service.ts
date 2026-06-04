import type { PrismaClient } from '@prisma/client';

import type { NarrativeGrounding, Parameter, StationNarrativeDTO } from '@alpimonitor/shared';

import { computeNarrationFeatures, type NarrationFeatures } from '../ai/narration-features.js';
import type { LlmClient } from '../ai/llm-client.js';
import { createPrismaInsightStore, generateNarration } from '../ai/narration-service.js';
import { INGESTION_INTERVAL_MINUTES } from '../ingestion/cadence.js';
import type { ThresholdConfig } from '../utils/station-status.js';
import { getStationMeasurements } from './stations-service.js';

// AI layer — extension A4 (ADR-012). Use-case orchestration for the narration
// endpoint: measurements → grounded features → narration (cached). Graceful
// degradation: insufficient data or an AI failure yields a `unavailable` state,
// never an HTTP error. Station-not-found still throws (→ 404 in the route).

export interface GenerateStationNarrativeParams {
  stationId: string;
  parameter: Parameter;
  from: Date;
  to: Date;
  language: string;
}

export interface NarrativeServiceDeps {
  prisma: PrismaClient;
  llm: LlmClient;
}

async function loadThreshold(
  prisma: PrismaClient,
  stationId: string,
  parameter: Parameter
): Promise<ThresholdConfig | null> {
  const t = await prisma.threshold.findUnique({
    where: { stationId_parameter: { stationId, parameter } },
    select: { vigilanceValue: true, alertValue: true, direction: true },
  });
  return t
    ? { vigilanceValue: t.vigilanceValue, alertValue: t.alertValue, direction: t.direction }
    : null;
}

function toGrounding(features: NarrationFeatures): NarrativeGrounding {
  return {
    trend: features.trend,
    deltaAbs: features.deltaAbs,
    deltaPct: features.deltaPct,
    status: features.status,
    completeness: features.completeness,
  };
}

export async function generateStationNarrative(
  deps: NarrativeServiceDeps,
  params: GenerateStationNarrativeParams
): Promise<StationNarrativeDTO> {
  const { prisma, llm } = deps;
  const { stationId, parameter, from, to, language } = params;

  // Reuses the measurements service: it validates the station (throws
  // StationNotFoundError → 404) and returns the raw in-window series.
  const measurements = await getStationMeasurements(prisma, {
    stationId,
    parameter,
    from,
    to,
    aggregate: 'raw',
  });

  const series = measurements.series.find((s) => s.parameter === parameter);
  const points = series?.points ?? [];
  const unit = series?.unit ?? '';
  const threshold = await loadThreshold(prisma, stationId, parameter);

  const features = computeNarrationFeatures({
    parameter,
    unit,
    windowFrom: from,
    windowTo: to,
    points,
    expectedIntervalMinutes: INGESTION_INTERVAL_MINUTES,
    threshold,
  });

  const base = {
    stationId,
    parameter,
    language,
    window: features.window,
    grounding: toGrounding(features),
  };

  // Not enough data to narrate a change → graceful unavailable, no LLM call.
  if (!features.hasData || features.deltaAbs === null) {
    return {
      ...base,
      state: 'unavailable',
      reason: 'insufficient_data',
      text: null,
      generatedAt: null,
    };
  }

  const store = createPrismaInsightStore(prisma);
  const outcome = await generateNarration({ store, llm }, { stationId, features, language });

  if (outcome.status === 'error') {
    return {
      ...base,
      state: 'unavailable',
      reason: outcome.error.kind === 'config' ? 'config_error' : 'llm_error',
      text: null,
      generatedAt: null,
    };
  }

  return {
    ...base,
    state: outcome.status,
    reason: null,
    text: outcome.insight.text,
    generatedAt: outcome.insight.generatedAt.toISOString(),
  };
}
