import { describe, expect, it } from 'vitest';

import type { AlertDTO, StationLatestMeasurement } from '@alpimonitor/shared';

import type {
  FindStationsQuery,
  LatestMeasurementsQuery,
  ListAlertsQuery,
  MeasurementStats,
  MeasurementStatsQuery,
  QueryPort,
  StationIdentity,
} from '../src/ai/chat/query-port.js';

// AI layer — extension C1 (ADR-012). The whole point of the hexagonal boundary:
// QueryPort is implementable WITHOUT a database. This in-memory fake proves the
// chat reasoning (C2+) is testable without Prisma — substitutability is the design
// goal, not an accident. If this file ever needs to import Prisma, the boundary
// has leaked.

interface FakeStation {
  identity: StationIdentity;
  latest: StationLatestMeasurement[];
  stats: Record<string, MeasurementStats>; // keyed by parameter
}

class InMemoryQueryPort implements QueryPort {
  constructor(
    private readonly stations: FakeStation[],
    private readonly alerts: AlertDTO[]
  ) {}

  async findStations(query: FindStationsQuery): Promise<StationIdentity[]> {
    const needle = query.search?.trim().toLowerCase();
    const all = this.stations.map((s) => s.identity);
    if (!needle) return all;
    return all.filter(
      (s) => s.name.toLowerCase().includes(needle) || s.riverName.toLowerCase().includes(needle)
    );
  }

  async getLatestMeasurements(query: LatestMeasurementsQuery): Promise<StationLatestMeasurement[]> {
    return this.stations.find((s) => s.identity.id === query.stationId)?.latest ?? [];
  }

  async getMeasurementStats(query: MeasurementStatsQuery): Promise<MeasurementStats | null> {
    const station = this.stations.find((s) => s.identity.id === query.stationId);
    return station?.stats[query.parameter] ?? null;
  }

  async listAlerts(query: ListAlertsQuery): Promise<AlertDTO[]> {
    return this.alerts.filter((a) => {
      if (query.stationId && a.stationId !== query.stationId) return false;
      if (query.status === 'open') return a.closedAt === null;
      if (query.status === 'closed') return a.closedAt !== null;
      return true;
    });
  }
}

const SION: FakeStation = {
  identity: {
    id: 'stn-sion',
    name: 'Sion',
    riverName: 'Rhône',
    dataSource: 'LIVE',
    parameters: ['DISCHARGE', 'WATER_LEVEL'],
  },
  latest: [
    {
      parameter: 'DISCHARGE',
      unit: 'm³/s',
      value: 42.5,
      recordedAt: '2026-06-04T21:00:00.000Z',
      status: 'NORMAL',
    },
  ],
  stats: {
    DISCHARGE: {
      stationId: 'stn-sion',
      parameter: 'DISCHARGE',
      unit: 'm³/s',
      from: '2026-05-25T00:00:00.000Z',
      to: '2026-06-05T00:00:00.000Z',
      first: 30,
      last: 42.5,
      min: 28,
      max: 50,
      avg: 39,
      deltaAbs: 12.5,
      deltaPct: 41.67,
      sampleSize: 1390,
    },
  },
};

const BRAMOIS: FakeStation = {
  identity: {
    id: 'stn-bramois',
    name: 'Bramois',
    riverName: 'Borgne',
    dataSource: 'RESEARCH',
    parameters: ['DISCHARGE'],
  },
  latest: [],
  stats: {},
};

const OPEN_ALERT: AlertDTO = {
  id: 'al-open',
  stationId: 'stn-sion',
  type: 'STATISTICAL_ANOMALY',
  level: 'VIGILANCE',
  parameter: 'DISCHARGE',
  triggerValue: 60,
  thresholdValue: 50,
  openedAt: '2026-06-04T12:00:00.000Z',
  closedAt: null,
  metadata: null,
};

const CLOSED_ALERT: AlertDTO = {
  ...OPEN_ALERT,
  id: 'al-closed',
  stationId: 'stn-bramois',
  closedAt: '2026-06-03T12:00:00.000Z',
};

function buildPort(): QueryPort {
  return new InMemoryQueryPort([SION, BRAMOIS], [OPEN_ALERT, CLOSED_ALERT]);
}

describe('QueryPort — in-memory fake (substitutability without a DB)', () => {
  describe('find_stations (identity without values)', () => {
    it('returns every identity when no search term is given', async () => {
      const port = buildPort();
      const result = await port.findStations({});
      expect(result.map((s) => s.id)).toEqual(['stn-sion', 'stn-bramois']);
    });

    it('resolves a name fragment to its station identity', async () => {
      const port = buildPort();
      const result = await port.findStations({ search: 'sio' });
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('stn-sion');
    });

    it('matches on river name too, case-insensitively', async () => {
      const port = buildPort();
      const result = await port.findStations({ search: 'BORGNE' });
      expect(result.map((s) => s.id)).toEqual(['stn-bramois']);
    });

    it('exposes identity + available parameters but NO measured value', async () => {
      const port = buildPort();
      const matched = await port.findStations({ search: 'Sion' });
      const sion = matched[0]!;
      expect(sion).toEqual({
        id: 'stn-sion',
        name: 'Sion',
        riverName: 'Rhône',
        dataSource: 'LIVE',
        parameters: ['DISCHARGE', 'WATER_LEVEL'],
      });
      // The identity object carries no value/recordedAt/status keys.
      expect(Object.keys(sion)).not.toContain('value');
    });
  });

  describe('get_latest_measurements (values)', () => {
    it('returns the latest value per parameter for a station', async () => {
      const port = buildPort();
      const result = await port.getLatestMeasurements({ stationId: 'stn-sion' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ parameter: 'DISCHARGE', value: 42.5, unit: 'm³/s' });
    });

    it('returns [] for an unknown station', async () => {
      const port = buildPort();
      expect(await port.getLatestMeasurements({ stationId: 'nope' })).toEqual([]);
    });
  });

  describe('get_measurement_stats (windowed aggregate)', () => {
    it('returns the aggregate for a known (station, parameter)', async () => {
      const port = buildPort();
      const stats = await port.getMeasurementStats({
        stationId: 'stn-sion',
        parameter: 'DISCHARGE',
        from: new Date('2026-05-25T00:00:00.000Z'),
        to: new Date('2026-06-05T00:00:00.000Z'),
      });
      expect(stats).not.toBeNull();
      expect(stats).toMatchObject({ first: 30, last: 42.5, deltaAbs: 12.5, sampleSize: 1390 });
    });

    it('returns null when the window holds no data (honest absence)', async () => {
      const port = buildPort();
      const stats = await port.getMeasurementStats({
        stationId: 'stn-bramois',
        parameter: 'DISCHARGE',
        from: new Date('2026-05-25T00:00:00.000Z'),
        to: new Date('2026-06-05T00:00:00.000Z'),
      });
      expect(stats).toBeNull();
    });
  });

  describe('list_alerts (reuses AlertDTO)', () => {
    it('filters open episodes', async () => {
      const port = buildPort();
      const result = await port.listAlerts({ status: 'open' });
      expect(result.map((a) => a.id)).toEqual(['al-open']);
    });

    it('filters closed episodes', async () => {
      const port = buildPort();
      const result = await port.listAlerts({ status: 'closed' });
      expect(result.map((a) => a.id)).toEqual(['al-closed']);
    });

    it('returns all when status = all, scoped by station', async () => {
      const port = buildPort();
      const result = await port.listAlerts({ status: 'all', stationId: 'stn-sion' });
      expect(result.map((a) => a.id)).toEqual(['al-open']);
    });
  });
});
