import type {
  AlertDTO,
  DataSource,
  Parameter,
  StationLatestMeasurement,
} from '@alpimonitor/shared';

// AI layer — extension C1 (ADR-012 §« Cadrage détaillé extension C »). The
// hexagonal boundary of the chat-on-structured-data feature.
//
// `QueryPort` IS the whitelist: the four — and only four — functions the LLM may
// call (D6). It is a PURE domain interface — it knows nothing of Prisma, Fastify
// or any infrastructure. An in-memory fake implements it in tests, proving the
// chat reasoning is testable without a database. `PrismaQueryAdapter` is the only
// Prisma-aware implementation.
//
// Deliberate separation identity / values: `findStations` resolves names → ids
// WITHOUT leaking any measurement; the LLM must then explicitly ask for values
// through the three other functions.

// --- find_stations : identity without values ---

// A station as the resolver exposes it: enough to disambiguate a name and to know
// which parameters CAN be queried, but NOT a single measured value.
export interface StationIdentity {
  id: string;
  name: string;
  riverName: string;
  dataSource: DataSource;
  // Parameters this station reports data for (e.g. ['DISCHARGE','WATER_LEVEL']).
  parameters: Parameter[];
}

export interface FindStationsQuery {
  // Free-text fragment matched against station name / river name (case-insensitive,
  // substring). Omitted → every station's identity.
  search?: string;
}

// --- get_latest_measurements : the latest value per parameter ---

export interface LatestMeasurementsQuery {
  stationId: string;
}

// --- get_measurement_stats : a windowed aggregate for one parameter ---

export interface MeasurementStatsQuery {
  stationId: string;
  parameter: Parameter;
  // Half-open window [from, to). Resolved to absolute dates by the chat layer
  // (C2+) before reaching the port — the port speaks domain time, not "last 24h".
  from: Date;
  to: Date;
}

// The grounded aggregate the LLM narrates. Every number is computed from real
// measurements; `null` means "no data in the window" (honest absence, never a
// fabricated zero).
export interface MeasurementStats {
  stationId: string;
  parameter: Parameter;
  unit: string;
  from: string; // ISO
  to: string; // ISO
  first: number;
  last: number;
  min: number;
  max: number;
  avg: number;
  deltaAbs: number; // last - first
  deltaPct: number; // (last - first) / first * 100, or 0 when first === 0
  sampleSize: number;
}

// --- list_alerts : reuses extension B's AlertDTO ---

export type AlertStatusFilter = 'open' | 'closed' | 'all';

export interface ListAlertsQuery {
  status: AlertStatusFilter;
  stationId?: string;
}

// The four whitelisted functions. Implementations: PrismaQueryAdapter (real),
// in-memory fakes (tests).
export interface QueryPort {
  findStations(query: FindStationsQuery): Promise<StationIdentity[]>;
  getLatestMeasurements(query: LatestMeasurementsQuery): Promise<StationLatestMeasurement[]>;
  getMeasurementStats(query: MeasurementStatsQuery): Promise<MeasurementStats | null>;
  listAlerts(query: ListAlertsQuery): Promise<AlertDTO[]>;
}
