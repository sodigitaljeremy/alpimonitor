import type { Parameter } from './common.js';

// AI layer — extension A (ADR-012). DTO for the LLM narration endpoint.

// Business state of the narration. `unavailable` is a graceful degradation
// (insufficient data or an AI-layer failure) — NOT an HTTP error: the endpoint
// still returns 200 so the front degrades softly and server error monitoring
// is not polluted. Real request errors stay 400 (validation) / 404 (no station).
export type NarrativeState = 'generated' | 'cached' | 'unavailable';

export type NarrativeUnavailableReason = 'insufficient_data' | 'llm_error' | 'config_error';

// Threshold classification of the current value. No OFFLINE here — that is a
// freshness concern, not a threshold one. `null` when no threshold is defined.
export type NarrativeStatus = 'NORMAL' | 'VIGILANCE' | 'ALERT';

export interface NarrativeCompleteness {
  expectedPoints: number;
  presentPoints: number;
  ratio: number;
  sparse: boolean;
  largestGapMinutes: number | null;
}

// The grounded facts the text is built from — exposed for transparency,
// auditability, and front-end indicators without a second call.
export interface NarrativeGrounding {
  trend: 'RISING' | 'FALLING' | 'STABLE' | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  status: NarrativeStatus | null;
  completeness: NarrativeCompleteness;
}

export interface StationNarrativeDTO {
  stationId: string;
  parameter: Parameter;
  language: string;
  window: { from: string; to: string };
  state: NarrativeState;
  reason: NarrativeUnavailableReason | null; // set only when state === 'unavailable'
  text: string | null; // null when unavailable
  generatedAt: string | null; // ISO; null when unavailable
  grounding: NarrativeGrounding;
}

export interface StationNarrativeResponse {
  data: StationNarrativeDTO;
}
