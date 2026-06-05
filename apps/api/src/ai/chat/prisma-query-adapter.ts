import type { PrismaClient } from '@prisma/client';

import type { AlertDTO, StationLatestMeasurement } from '@alpimonitor/shared';

import { listAlerts } from '../../services/alerts-service.js';
import { getStationMeasurementStats, listStations } from '../../services/stations-service.js';
import type {
  FindStationsQuery,
  LatestMeasurementsQuery,
  ListAlertsQuery,
  MeasurementStats,
  MeasurementStatsQuery,
  QueryPort,
  StationIdentity,
} from './query-port.js';

// AI layer — extension C1 (ADR-012 D2). The only Prisma-aware implementation of
// QueryPort. It DELEGATES to the existing services (listStations, listAlerts) plus
// the getStationMeasurementStats aggregation helper — no query is rewritten here.
// This is the seam where the hexagonal boundary meets infrastructure.

// list_alerts is read-only and unpaginated at the chat layer; cap the rows we hand
// to the LLM so a noisy history can't blow up the prompt.
const ALERTS_LIMIT = 50;

export class PrismaQueryAdapter implements QueryPort {
  constructor(private readonly prisma: PrismaClient) {}

  // find_stations — identity WITHOUT values. Delegates to listStations, then
  // strips every measured value, keeping only identity + the parameters the
  // station actually reports data for.
  async findStations(query: FindStationsQuery): Promise<StationIdentity[]> {
    const stations = await listStations(this.prisma, { isActive: true });

    const needle = query.search?.trim().toLowerCase();
    const matched = needle
      ? stations.filter(
          (s) => s.name.toLowerCase().includes(needle) || s.riverName.toLowerCase().includes(needle)
        )
      : stations;

    return matched.map((s) => ({
      id: s.id,
      name: s.name,
      riverName: s.riverName,
      dataSource: s.dataSource,
      parameters: s.latestMeasurements.map((m) => m.parameter),
    }));
  }

  // get_latest_measurements — the latest value per parameter. listStations already
  // computes these (value + unit + status + recordedAt); pick the requested station.
  async getLatestMeasurements(query: LatestMeasurementsQuery): Promise<StationLatestMeasurement[]> {
    const stations = await listStations(this.prisma, { isActive: true });
    const station = stations.find((s) => s.id === query.stationId);
    return station ? station.latestMeasurements : [];
  }

  // get_measurement_stats — windowed aggregate via the helper, with the two derived
  // deltas computed here (keeps the SQL helper focused on raw aggregation).
  async getMeasurementStats(query: MeasurementStatsQuery): Promise<MeasurementStats | null> {
    const stats = await getStationMeasurementStats(this.prisma, {
      stationId: query.stationId,
      parameter: query.parameter,
      from: query.from,
      to: query.to,
    });
    if (!stats) return null;

    const deltaAbs = stats.last - stats.first;
    const deltaPct = stats.first === 0 ? 0 : (deltaAbs / stats.first) * 100;

    return {
      stationId: query.stationId,
      parameter: query.parameter,
      unit: stats.unit,
      from: query.from.toISOString(),
      to: query.to.toISOString(),
      first: stats.first,
      last: stats.last,
      min: stats.min,
      max: stats.max,
      avg: stats.avg,
      deltaAbs,
      deltaPct,
      sampleSize: stats.sampleSize,
    };
  }

  // list_alerts — straight delegation to extension B's read side.
  async listAlerts(query: ListAlertsQuery): Promise<AlertDTO[]> {
    return listAlerts(this.prisma, {
      status: query.status,
      stationId: query.stationId,
      limit: ALERTS_LIMIT,
    });
  }
}
