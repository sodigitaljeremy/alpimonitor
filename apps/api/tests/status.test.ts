import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FastifyInstance } from 'fastify';

// Each test provides its own findFirst stub by writing into this object
// before importing the server. Order-dependent (cf. Prisma query order
// in src/routes/status.ts): 1st = latest run, 2nd = latest SUCCESS.
const findFirstQueue: Array<() => Promise<unknown>> = [];

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    async $connect(): Promise<void> {}
    async $disconnect(): Promise<void> {}
    async $queryRaw(): Promise<unknown[]> {
      return [{ '?column?': 1 }];
    }
    ingestionRun = {
      findFirst: async (): Promise<unknown> => {
        const next = findFirstQueue.shift();
        if (!next) throw new Error('no findFirst behaviour queued for this call');
        return next();
      },
    };
  },
}));

process.env.INGESTION_ENABLED = 'false';

const { buildServer } = await import('../src/server.js');

function queueFindFirst(latest: unknown, latestSuccess: unknown): void {
  findFirstQueue.length = 0;
  findFirstQueue.push(
    async () => latest,
    async () => latestSuccess
  );
}

describe('GET /api/v1/status', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
    findFirstQueue.length = 0;
  });

  it('returns the latest run and lastSuccessAt when both are present', async () => {
    const startedAt = new Date('2026-04-21T10:00:00Z');
    const completedAt = new Date('2026-04-21T10:00:02.340Z');

    queueFindFirst(
      {
        source: 'LINDAS_HYDRO',
        status: 'SUCCESS',
        startedAt,
        completedAt,
        stationsSeenCount: 4,
        measurementsCreatedCount: 8,
        durationMs: 2340,
      },
      { completedAt }
    );

    const res = await app.inject({ method: 'GET', url: '/api/v1/status' });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      api: { status: string; uptimeSeconds: number };
      database: { status: string };
      ingestion: {
        lastRun: Record<string, unknown> | null;
        lastSuccessAt: string | null;
        healthyThresholdMinutes: number;
      };
    };

    expect(body.api.status).toBe('ok');
    expect(body.api.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.database.status).toBe('ok');
    expect(body.ingestion.lastRun).toMatchObject({
      source: 'LINDAS_HYDRO',
      status: 'SUCCESS',
      startedAt: '2026-04-21T10:00:00.000Z',
      completedAt: '2026-04-21T10:00:02.340Z',
      stationsSeenCount: 4,
      measurementsCreatedCount: 8,
      durationMs: 2340,
    });
    expect(body.ingestion.lastSuccessAt).toBe('2026-04-21T10:00:02.340Z');
    expect(body.ingestion.healthyThresholdMinutes).toBe(30);
  });

  it('returns null lastRun / lastSuccessAt when the IngestionRun table is empty', async () => {
    queueFindFirst(null, null);

    const res = await app.inject({ method: 'GET', url: '/api/v1/status' });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      ingestion: { lastRun: null; lastSuccessAt: null };
    };
    expect(body.ingestion.lastRun).toBeNull();
    expect(body.ingestion.lastSuccessAt).toBeNull();
  });

  it('returns lastSuccessAt=null when the latest run is a FAILURE and no prior success exists', async () => {
    queueFindFirst(
      {
        source: 'LINDAS_HYDRO',
        status: 'FAILURE',
        startedAt: new Date('2026-04-21T10:10:00Z'),
        completedAt: new Date('2026-04-21T10:10:01Z'),
        stationsSeenCount: 0,
        measurementsCreatedCount: 0,
        durationMs: 1000,
      },
      null
    );

    const res = await app.inject({ method: 'GET', url: '/api/v1/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      ingestion: { lastRun: { status: string }; lastSuccessAt: string | null };
    };
    expect(body.ingestion.lastRun!.status).toBe('FAILURE');
    expect(body.ingestion.lastSuccessAt).toBeNull();
  });

  it('returns 503 with database.status=error when Prisma throws', async () => {
    findFirstQueue.length = 0;
    findFirstQueue.push(
      async () => {
        throw new Error('connection refused');
      },
      async () => null
    );

    const res = await app.inject({ method: 'GET', url: '/api/v1/status' });
    expect(res.statusCode).toBe(503);
    const body = res.json() as {
      api: { status: string };
      database: { status: string };
      ingestion: { lastRun: null; lastSuccessAt: null };
    };
    expect(body.api.status).toBe('ok');
    expect(body.database.status).toBe('error');
    expect(body.ingestion.lastRun).toBeNull();
    expect(body.ingestion.lastSuccessAt).toBeNull();
  });
});
