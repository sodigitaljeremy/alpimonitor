import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FastifyInstance } from 'fastify';

// AI layer — extension C5 (ADR-012). Integration of POST /api/v1/ask: the guard
// order (429 before body), Zod validation (400), and the grounded happy path (200
// with an honest tool trace). Mistral is stubbed via fetch; the only Prisma surface
// touched is llmCallRun (observability write + cost-cap read).

const state: { costUsdToday: number } = { costUsdToday: 0 };

vi.mock('@prisma/client', () => ({
  Prisma: { sql: (parts: TemplateStringsArray) => ({ parts }), empty: {} },
  PrismaClient: class {
    async $connect(): Promise<void> {}
    async $disconnect(): Promise<void> {}
    llmCallRun = {
      create: async (): Promise<Record<string, unknown>> => ({}),
      aggregate: async (): Promise<{ _sum: { costUsd: number } }> => ({
        _sum: { costUsd: state.costUsdToday },
      }),
    };
  },
}));

process.env.INGESTION_ENABLED = 'false';
process.env.MISTRAL_API_KEY = 'test-key';

const { buildServer } = await import('../src/server.js');

// Mistral returns prose with no tool calls → the chat loop answers grounded in one
// LLM call, with an empty tool trace (the simplest 200 path).
function proseFetch(content = 'Le débit à Sion est de 42,5 m³/s.') {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 50, completion_tokens: 10 },
    }),
  })) as unknown as typeof fetch;
}

describe('POST /api/v1/ask', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    state.costUsdToday = 0;
    vi.stubGlobal('fetch', proseFetch());
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
  });

  it('returns 200 with the grounded answer and tool trace', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: { question: 'Quel est le débit à Sion ?' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      answer: string;
      used: unknown[];
      language: string;
      generatedAt: string;
    };
    expect(body.answer).toBe('Le débit à Sion est de 42,5 m³/s.');
    expect(body.used).toEqual([]);
    expect(body.language).toBe('fr');
    expect(typeof body.generatedAt).toBe('string');
  });

  it('honours an explicit language hint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: { question: 'What is the discharge at Sion?', language: 'en' },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { language: string }).language).toBe('en');
  });

  it('returns 400 on an empty question', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: { question: '   ' },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when the body is missing the question', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/ask', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 429 with Retry-After when the daily cost cap is reached', async () => {
    state.costUsdToday = 0.5; // at the $0.50 cap → cost_cap refusal, no LLM call
    const fetchSpy = proseFetch();
    vi.stubGlobal('fetch', fetchSpy);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ask',
      payload: { question: 'Quel est le débit à Sion ?' },
    });

    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    const body = res.json() as { error: { code: string; reason: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.reason).toBe('cost_cap');
    // The cap is read-only: no LLM request was emitted.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
