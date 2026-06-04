import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FastifyInstance } from 'fastify';

interface AiState {
  aggregate: {
    _count: { _all: number };
    _sum: { costUsd: number | null };
    _avg: { latencyMs: number | null };
  };
  errorCount: number;
  latest: { createdAt: Date } | null;
  throwOnQuery: boolean;
}

const state: AiState = {
  aggregate: { _count: { _all: 0 }, _sum: { costUsd: null }, _avg: { latencyMs: null } },
  errorCount: 0,
  latest: null,
  throwOnQuery: false,
};

vi.mock('@prisma/client', () => ({
  Prisma: {},
  PrismaClient: class {
    async $connect(): Promise<void> {}
    async $disconnect(): Promise<void> {}
    llmCallRun = {
      aggregate: async (): Promise<unknown> => {
        if (state.throwOnQuery) throw new Error('db down');
        return state.aggregate;
      },
      count: async (): Promise<number> => {
        if (state.throwOnQuery) throw new Error('db down');
        return state.errorCount;
      },
      findFirst: async (): Promise<unknown> => {
        if (state.throwOnQuery) throw new Error('db down');
        return state.latest;
      },
    };
  },
}));

process.env.INGESTION_ENABLED = 'false';

const { buildServer } = await import('../src/server.js');

describe('GET /api/v1/ai/status', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    state.aggregate = { _count: { _all: 0 }, _sum: { costUsd: null }, _avg: { latencyMs: null } };
    state.errorCount = 0;
    state.latest = null;
    state.throwOnQuery = false;
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns zeros/nulls when no LLM call happened today', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/status' });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { ai: unknown }).ai).toEqual({
      callsToday: 0,
      errorRate: null,
      costUsdToday: 0,
      avgLatencyMs: null,
      lastCallAt: null,
    });
  });

  it('aggregates today calls, error rate, cost and latency', async () => {
    state.aggregate = {
      _count: { _all: 10 },
      _sum: { costUsd: 0.0025 },
      _avg: { latencyMs: 432.6 },
    };
    state.errorCount = 2;
    state.latest = { createdAt: new Date('2026-06-04T14:00:00.000Z') };

    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/status' });
    expect(res.statusCode).toBe(200);
    const { ai } = res.json() as {
      ai: {
        callsToday: number;
        errorRate: number;
        costUsdToday: number;
        avgLatencyMs: number;
        lastCallAt: string;
      };
    };
    expect(ai.callsToday).toBe(10);
    expect(ai.errorRate).toBeCloseTo(0.2);
    expect(ai.costUsdToday).toBe(0.0025);
    expect(ai.avgLatencyMs).toBe(433);
    expect(ai.lastCallAt).toBe('2026-06-04T14:00:00.000Z');
  });

  it('returns 503 when the database probe fails', async () => {
    state.throwOnQuery = true;
    const res = await app.inject({ method: 'GET', url: '/api/v1/ai/status' });
    expect(res.statusCode).toBe(503);
  });
});
