import type { StationDTO, StationMeasurementsDTO } from '@alpimonitor/shared';

export interface IngestionLastRun {
  source: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  stationsSeenCount: number;
  measurementsCreatedCount: number;
  durationMs: number | null;
}

export interface IngestionToday {
  runsCount: number;
  measurementsCreatedSum: number;
  successRate: number | null;
}

// TODO (post-candidature): in a production build, throw at module load
// if VITE_API_BASE_URL is undefined. POC-acceptable today — the missing
// var silently becomes the string "undefined" and every fetch surfaces
// as `{ kind: 'network' }`, which the UI treats as a generic failure.
// Acceptable for dev/review; misleading in ops. See ADR-010.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Every failure the client can surface, classified so callers can pick a
 * recovery UX. We deliberately do NOT reuse `Error` as the public shape —
 * a discriminated union forces consumers (and their tests) to name which
 * kind of failure they care about.
 */
export type ApiError =
  | { kind: 'network'; cause: Error }
  | { kind: 'http'; status: number; statusText: string; path: string }
  | { kind: 'parse'; cause: Error; path: string };

/**
 * Standard response envelope. Mirrors SkillSwap's `ApiResponse<T>` pattern
 * but with a typed `error` instead of a plain string — see `ApiError`.
 */
export type ApiResponse<T> = { success: true; data: T } | { success: false; error: ApiError };

type StationsListResponse = { data: StationDTO[] };
type StationMeasurementsResponse = { data: StationMeasurementsDTO };

export interface StatusResponse {
  api: { status: 'ok'; uptimeSeconds: number };
  database: { status: 'ok' | 'error' };
  ingestion: {
    lastRun: IngestionLastRun | null;
    lastSuccessAt: string | null;
    healthyThresholdMinutes: number;
    today: IngestionToday;
  };
}

export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'ok' | 'error';
}

export interface StationMeasurementsParams {
  parameter?: string;
  from?: Date;
  to?: Date;
}

/**
 * Single place where `fetch` + error classification lives. Every other
 * method in this file delegates here, so there is one path for failure
 * categorisation and one shape to test against.
 */
async function request<T>(path: string): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch (err) {
    return {
      success: false,
      error: {
        kind: 'network',
        cause: err instanceof Error ? err : new Error(String(err)),
      },
    };
  }

  if (!response.ok) {
    return {
      success: false,
      error: {
        kind: 'http',
        status: response.status,
        statusText: response.statusText,
        path,
      },
    };
  }

  try {
    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: {
        kind: 'parse',
        cause: err instanceof Error ? err : new Error(String(err)),
        path,
      },
    };
  }
}

function buildMeasurementsPath(stationId: string, params: StationMeasurementsParams): string {
  const search = new URLSearchParams();
  if (params.parameter !== undefined) search.set('parameter', params.parameter);
  if (params.from !== undefined) search.set('from', params.from.toISOString());
  if (params.to !== undefined) search.set('to', params.to.toISOString());
  const qs = search.toString();
  return qs === ''
    ? `/stations/${stationId}/measurements`
    : `/stations/${stationId}/measurements?${qs}`;
}

/**
 * Typed entry points for every endpoint this frontend consumes. Consumers
 * (stores, composables) delegate here — no one else should call `fetch`
 * directly.
 */
export const api = {
  getStations: () => request<StationsListResponse>('/stations'),
  getStationMeasurements: (stationId: string, params: StationMeasurementsParams) =>
    request<StationMeasurementsResponse>(buildMeasurementsPath(stationId, params)),
  getStatus: () => request<StatusResponse>('/status'),
  getHealth: () => request<HealthResponse>('/health'),
};

/**
 * Short human-readable rendering of an `ApiError`. Intended for logs,
 * telemetry, or a fallback "something went wrong" UI. UX flows that need
 * to branch on the failure kind should read `error.kind` directly, not
 * parse this string.
 */
export function apiErrorMessage(error: ApiError): string {
  switch (error.kind) {
    case 'network':
      return error.cause.message;
    case 'http':
      return `API ${error.status} ${error.statusText} on ${error.path}`;
    case 'parse':
      return `Failed to parse response on ${error.path}: ${error.cause.message}`;
  }
}
