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

process.env.INGESTION_ENABLED = 'false';

const { buildServer, parseCorsOrigins } = await import('../src/server.js');

describe('parseCorsOrigins', () => {
  it('falls back to the dev origin when env var is undefined', () => {
    expect(parseCorsOrigins(undefined)).toEqual(['http://localhost:5173']);
  });

  it('falls back to the dev origin when env var is an empty string', () => {
    expect(parseCorsOrigins('')).toEqual(['http://localhost:5173']);
  });

  it('splits a single-origin string into a one-item array', () => {
    expect(parseCorsOrigins('https://alpimonitor.fr')).toEqual(['https://alpimonitor.fr']);
  });

  it('splits and trims multiple comma-separated origins', () => {
    expect(parseCorsOrigins('https://alpimonitor.fr, https://www.alpimonitor.fr')).toEqual([
      'https://alpimonitor.fr',
      'https://www.alpimonitor.fr',
    ]);
  });
});

describe('CORS plugin', () => {
  const originalEnv = process.env.CORS_ORIGINS;
  let app: FastifyInstance;

  beforeEach(async () => {
    process.env.CORS_ORIGINS = 'https://alpimonitor.fr';
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
    if (originalEnv === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = originalEnv;
    }
  });

  it('answers OPTIONS preflight from an allowed origin with the expected headers', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: {
        origin: 'https://alpimonitor.fr',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://alpimonitor.fr');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-methods']).toContain('OPTIONS');
  });

  it('echoes the allow-origin header on an actual GET from an allowed origin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://alpimonitor.fr' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://alpimonitor.fr');
  });

  it('does not echo allow-origin for a disallowed origin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
