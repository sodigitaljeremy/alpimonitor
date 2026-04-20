import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FastifyInstance } from 'fastify';

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    async $connect(): Promise<void> {}
    async $disconnect(): Promise<void> {}
    async $queryRaw(): Promise<unknown[]> {
      return [{ '?column?': 1 }];
    }
  },
}));

const { buildServer } = await import('../src/server.js');

describe('GET /api/v1/health', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with database ok when prisma query succeeds', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      status: string;
      timestamp: string;
      database: string;
    };
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp)).not.toThrow();
  });
});
