import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FastifyInstance } from 'fastify';

// Shared stub state, filled by each test before the request runs.
interface StubState {
  stations: unknown[];
  findManyCalls: unknown[];
}
const state: StubState = { stations: [], findManyCalls: [] };

vi.mock('@prisma/client', () => ({
  Prisma: { sql: (parts: TemplateStringsArray, ..._v: unknown[]) => ({ parts }), empty: {} },
  PrismaClient: class {
    async $connect(): Promise<void> {}
    async $disconnect(): Promise<void> {}
    async $queryRaw(): Promise<unknown[]> {
      return [{ '?column?': 1 }];
    }
    station = {
      findMany: async (args: unknown): Promise<unknown[]> => {
        state.findManyCalls.push(args);
        return state.stations;
      },
      findUnique: async (): Promise<null> => null,
    };
    sensor = { findMany: async (): Promise<unknown[]> => [] };
    measurement = { findMany: async (): Promise<unknown[]> => [] };
  },
}));

process.env.INGESTION_ENABLED = 'false';

const { buildServer } = await import('../src/server.js');

const fixedNow = new Date('2026-04-21T12:00:00Z');

function makeStation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'stn-1',
    ofevCode: '2011',
    name: 'Sion',
    riverName: 'Rhône',
    latitude: 46.23,
    longitude: 7.35,
    altitudeM: 491,
    flowType: 'NATURAL',
    operatorName: 'OFEV',
    dataSource: 'LIVE',
    sensors: [
      {
        parameter: 'DISCHARGE',
        unit: 'm3/s',
        measurements: [{ value: 12.3, recordedAt: new Date('2026-04-21T11:55:00Z') }],
      },
    ],
    thresholds: [],
    _count: { alerts: 0 },
    ...overrides,
  };
}

describe('GET /api/v1/stations', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    state.stations = [];
    state.findManyCalls = [];
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
    vi.useRealTimers();
  });

  it('returns the list wrapped under data with dataSource and latestMeasurements', async () => {
    state.stations = [makeStation()];

    const res = await app.inject({ method: 'GET', url: '/api/v1/stations' });
    expect(res.statusCode).toBe(200);

    const body = res.json() as { data: Array<Record<string, unknown>> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: 'stn-1',
      ofevCode: '2011',
      dataSource: 'LIVE',
      activeAlertsCount: 0,
    });
    const measurements = body.data[0]?.latestMeasurements as Array<Record<string, unknown>>;
    expect(measurements).toHaveLength(1);
    expect(measurements[0]).toMatchObject({
      parameter: 'DISCHARGE',
      unit: 'm3/s',
      value: 12.3,
      status: 'NORMAL',
    });
  });

  it('defaults isActive filter to true when omitted', async () => {
    state.stations = [];

    await app.inject({ method: 'GET', url: '/api/v1/stations' });
    const call = state.findManyCalls[0] as { where: { isActive: boolean } };
    expect(call.where.isActive).toBe(true);
  });

  it('forwards isActive=false when requested', async () => {
    state.stations = [];
    await app.inject({ method: 'GET', url: '/api/v1/stations?isActive=false' });
    const call = state.findManyCalls[0] as { where: { isActive: boolean } };
    expect(call.where.isActive).toBe(false);
  });

  it('forwards catchmentId when provided', async () => {
    state.stations = [];
    await app.inject({ method: 'GET', url: '/api/v1/stations?catchmentId=c-borgne' });
    const call = state.findManyCalls[0] as { where: { catchmentId?: string } };
    expect(call.where.catchmentId).toBe('c-borgne');
  });

  it('returns empty latestMeasurements for a RESEARCH station with no measurements', async () => {
    state.stations = [
      makeStation({
        id: 'stn-research',
        ofevCode: 'TBD-BRAMOIS',
        dataSource: 'RESEARCH',
        sensors: [],
      }),
    ];

    const res = await app.inject({ method: 'GET', url: '/api/v1/stations' });
    const body = res.json() as {
      data: Array<{ latestMeasurements: unknown[]; dataSource: string }>;
    };
    expect(body.data[0]?.dataSource).toBe('RESEARCH');
    expect(body.data[0]?.latestMeasurements).toEqual([]);
  });

  it('computes OFFLINE status for a stale measurement', async () => {
    state.stations = [
      makeStation({
        sensors: [
          {
            parameter: 'DISCHARGE',
            unit: 'm3/s',
            // 2h old, stale threshold is 60 min
            measurements: [{ value: 12.3, recordedAt: new Date('2026-04-21T10:00:00Z') }],
          },
        ],
      }),
    ];

    const res = await app.inject({ method: 'GET', url: '/api/v1/stations' });
    const body = res.json() as {
      data: Array<{ latestMeasurements: Array<{ status: string }> }>;
    };
    expect(body.data[0]?.latestMeasurements[0]?.status).toBe('OFFLINE');
  });

  it('computes VIGILANCE when the latest value crosses the vigilance threshold (ABOVE)', async () => {
    state.stations = [
      makeStation({
        thresholds: [
          {
            parameter: 'DISCHARGE',
            vigilanceValue: 10,
            alertValue: 20,
            direction: 'ABOVE',
          },
        ],
        sensors: [
          {
            parameter: 'DISCHARGE',
            unit: 'm3/s',
            measurements: [{ value: 15, recordedAt: new Date('2026-04-21T11:55:00Z') }],
          },
        ],
      }),
    ];

    const res = await app.inject({ method: 'GET', url: '/api/v1/stations' });
    const body = res.json() as {
      data: Array<{ latestMeasurements: Array<{ status: string }> }>;
    };
    expect(body.data[0]?.latestMeasurements[0]?.status).toBe('VIGILANCE');
  });
});
