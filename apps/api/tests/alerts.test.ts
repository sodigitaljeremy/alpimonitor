import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FastifyInstance } from 'fastify';

// Captures the args the route passes to prisma.alert.findMany so we can assert
// how query params map to the where/take clause, plus a canned row set to verify
// DTO serialisation.

interface FindManyArgs {
  where: Record<string, unknown>;
  take: number;
  orderBy: unknown;
}

const state: {
  lastArgs: FindManyArgs | null;
  rows: Array<Record<string, unknown>>;
} = { lastArgs: null, rows: [] };

vi.mock('@prisma/client', () => ({
  Prisma: { sql: (parts: TemplateStringsArray) => ({ parts }), empty: {} },
  PrismaClient: class {
    async $connect(): Promise<void> {}
    async $disconnect(): Promise<void> {}
    alert = {
      findMany: async (args: FindManyArgs): Promise<Array<Record<string, unknown>>> => {
        state.lastArgs = args;
        return state.rows;
      },
    };
  },
}));

process.env.INGESTION_ENABLED = 'false';

const { buildServer } = await import('../src/server.js');

const OPEN_ROW = {
  id: 'al-1',
  stationId: 'stn-1',
  type: 'STATISTICAL_ANOMALY',
  level: 'VIGILANCE',
  parameter: 'DISCHARGE',
  triggerValue: 195.9,
  thresholdValue: 201.4,
  openedAt: new Date('2026-06-04T17:30:00.000Z'),
  closedAt: null,
  metadata: { z: -2.13, mean: 285.4, sampleSize: 974 },
};

describe('GET /api/v1/alerts', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    state.lastArgs = null;
    state.rows = [];
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it('defaults to open episodes with a default limit', async () => {
    state.rows = [OPEN_ROW];
    const res = await app.inject({ method: 'GET', url: '/api/v1/alerts' });

    expect(res.statusCode).toBe(200);
    expect(state.lastArgs?.where).toEqual({ closedAt: null });
    expect(state.lastArgs?.take).toBe(50);
    expect(state.lastArgs?.orderBy).toEqual({ openedAt: 'desc' });

    const { data } = res.json() as { data: Array<Record<string, unknown>> };
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: 'al-1',
      type: 'STATISTICAL_ANOMALY',
      level: 'VIGILANCE',
      openedAt: '2026-06-04T17:30:00.000Z',
      closedAt: null,
      metadata: { z: -2.13, sampleSize: 974 },
    });
  });

  it('status=closed filters to closed episodes', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/alerts?status=closed' });
    expect(state.lastArgs?.where).toEqual({ NOT: { closedAt: null } });
  });

  it('status=all applies no lifecycle filter', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/alerts?status=all' });
    expect(state.lastArgs?.where).toEqual({});
  });

  it('passes stationId and type through to the where clause', async () => {
    await app.inject({
      method: 'GET',
      url: '/api/v1/alerts?status=all&stationId=stn-9&type=STATISTICAL_ANOMALY',
    });
    expect(state.lastArgs?.where).toEqual({
      stationId: 'stn-9',
      type: 'STATISTICAL_ANOMALY',
    });
  });

  it('coerces and caps the limit', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/alerts?limit=5' });
    expect(state.lastArgs?.take).toBe(5);
  });

  it('rejects a limit over the cap', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/alerts?limit=999' });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/alerts?status=weird' });
    expect(res.statusCode).toBe(400);
  });
});
