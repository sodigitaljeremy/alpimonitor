import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FastifyInstance } from 'fastify';

import { pickAggregate } from '../src/services/stations-service.js';

interface StubState {
  stationById: Record<string, { id: string } | null>;
  sensors: Array<{ id: string; parameter: string; unit: string }>;
  rawMeasurements: Array<{
    value: number;
    recordedAt: Date;
    sensor: { parameter: string };
  }>;
  queryRawReturn: unknown[];
}

const state: StubState = {
  stationById: {},
  sensors: [],
  rawMeasurements: [],
  queryRawReturn: [],
};

vi.mock('@prisma/client', () => ({
  Prisma: {
    sql: (parts: TemplateStringsArray, ..._v: unknown[]) => ({ parts }),
    empty: {},
  },
  PrismaClient: class {
    async $connect(): Promise<void> {}
    async $disconnect(): Promise<void> {}
    async $queryRaw(): Promise<unknown[]> {
      return state.queryRawReturn;
    }
    station = {
      findMany: async (): Promise<unknown[]> => [],
      findUnique: async (args: { where: { id: string } }): Promise<{ id: string } | null> =>
        state.stationById[args.where.id] ?? null,
    };
    sensor = {
      findMany: async (): Promise<Array<{ id: string; parameter: string; unit: string }>> =>
        state.sensors,
    };
    measurement = {
      findMany: async (): Promise<
        Array<{ value: number; recordedAt: Date; sensor: { parameter: string } }>
      > => state.rawMeasurements,
    };
  },
}));

process.env.INGESTION_ENABLED = 'false';

const { buildServer } = await import('../src/server.js');

describe('pickAggregate', () => {
  it('returns raw for ranges ≤ 24h', () => {
    const from = new Date('2026-04-21T00:00:00Z');
    const to = new Date('2026-04-21T23:59:00Z');
    expect(pickAggregate(from, to)).toBe('raw');
  });

  it('returns hourly for ranges > 24h and ≤ 7d', () => {
    const from = new Date('2026-04-14T00:00:00Z');
    const to = new Date('2026-04-21T00:00:00Z');
    expect(pickAggregate(from, to)).toBe('hourly');
  });

  it('returns daily for ranges > 7d', () => {
    const from = new Date('2026-03-01T00:00:00Z');
    const to = new Date('2026-04-21T00:00:00Z');
    expect(pickAggregate(from, to)).toBe('daily');
  });
});

describe('GET /api/v1/stations/:id/measurements', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    state.stationById = {};
    state.sensors = [];
    state.rawMeasurements = [];
    state.queryRawReturn = [];
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 404 when the station does not exist', async () => {
    state.stationById = { nope: null };
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/stations/nope/measurements?from=2026-04-20T00:00:00Z&to=2026-04-21T00:00:00Z',
    });
    expect(res.statusCode).toBe(404);
    const body = res.json() as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when from is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/stations/stn-1/measurements?to=2026-04-21T00:00:00Z',
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when from >= to', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/stations/stn-1/measurements?from=2026-04-21T00:00:00Z&to=2026-04-21T00:00:00Z',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns raw series for a ≤24h range, grouped by parameter', async () => {
    state.stationById = { 'stn-1': { id: 'stn-1' } };
    state.sensors = [
      { id: 'sen-1', parameter: 'DISCHARGE', unit: 'm3/s' },
      { id: 'sen-2', parameter: 'WATER_LEVEL', unit: 'm' },
    ];
    state.rawMeasurements = [
      {
        value: 10,
        recordedAt: new Date('2026-04-20T00:30:00Z'),
        sensor: { parameter: 'DISCHARGE' },
      },
      {
        value: 11,
        recordedAt: new Date('2026-04-20T01:00:00Z'),
        sensor: { parameter: 'DISCHARGE' },
      },
      {
        value: 1.2,
        recordedAt: new Date('2026-04-20T00:30:00Z'),
        sensor: { parameter: 'WATER_LEVEL' },
      },
    ];

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/stations/stn-1/measurements?from=2026-04-20T00:00:00Z&to=2026-04-21T00:00:00Z',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      data: {
        stationId: string;
        aggregate: string;
        series: Array<{ parameter: string; unit: string; points: Array<{ t: string; v: number }> }>;
      };
    };
    expect(body.data.stationId).toBe('stn-1');
    expect(body.data.aggregate).toBe('raw');
    expect(body.data.series).toHaveLength(2);

    const discharge = body.data.series.find((s) => s.parameter === 'DISCHARGE');
    expect(discharge?.unit).toBe('m3/s');
    expect(discharge?.points).toHaveLength(2);
    expect(discharge?.points[0]?.v).toBe(10);

    const level = body.data.series.find((s) => s.parameter === 'WATER_LEVEL');
    expect(level?.points).toHaveLength(1);
  });

  it('returns an empty series envelope when no sensors match the parameter filter', async () => {
    state.stationById = { 'stn-1': { id: 'stn-1' } };
    state.sensors = []; // filter by TURBIDITY matches nothing

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/stations/stn-1/measurements?from=2026-04-20T00:00:00Z&to=2026-04-21T00:00:00Z&parameter=TURBIDITY',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { series: unknown[] } };
    expect(body.data.series).toEqual([]);
  });
});
