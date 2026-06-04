import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FastifyInstance } from 'fastify';

interface InsightRow {
  id: string;
  text: string;
  generatedAt: Date;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  latencyMs: number | null;
}

interface StubState {
  stationById: Record<string, { id: string } | null>;
  sensors: Array<{ id: string; parameter: string; unit: string }>;
  rawMeasurements: Array<{ value: number; recordedAt: Date; sensor: { parameter: string } }>;
  threshold: { vigilanceValue: number; alertValue: number; direction: 'ABOVE' | 'BELOW' } | null;
  cachedInsight: InsightRow | null;
}

const state: StubState = {
  stationById: {},
  sensors: [],
  rawMeasurements: [],
  threshold: null,
  cachedInsight: null,
};

vi.mock('@prisma/client', () => ({
  Prisma: { sql: (parts: TemplateStringsArray) => ({ parts }), empty: {} },
  PrismaClient: class {
    async $connect(): Promise<void> {}
    async $disconnect(): Promise<void> {}
    async $queryRaw(): Promise<unknown[]> {
      return [];
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
    threshold = {
      findUnique: async (): Promise<StubState['threshold']> => state.threshold,
    };
    insight = {
      findUnique: async (): Promise<InsightRow | null> => state.cachedInsight,
      upsert: async (args: { create: Record<string, unknown> }): Promise<InsightRow> => ({
        id: 'ins-1',
        generatedAt: new Date('2026-06-02T00:00:00.000Z'),
        text: String(args.create.text ?? ''),
        promptTokens: (args.create.promptTokens as number | null) ?? null,
        completionTokens: (args.create.completionTokens as number | null) ?? null,
        costUsd: null,
        latencyMs: (args.create.latencyMs as number | null) ?? null,
      }),
    };
  },
}));

process.env.INGESTION_ENABLED = 'false';
process.env.MISTRAL_API_KEY = 'test-key';

const { buildServer } = await import('../src/server.js');

const URL_BASE =
  '/api/v1/stations/stn-1/narrative?parameter=DISCHARGE&from=2026-06-01T00:00:00Z&to=2026-06-02T00:00:00Z';

function okFetch(content = 'Le débit a augmenté.') {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    }),
  })) as unknown as typeof fetch;
}

function twoRisingDischargePoints() {
  state.stationById = { 'stn-1': { id: 'stn-1' } };
  state.sensors = [{ id: 'sen-1', parameter: 'DISCHARGE', unit: 'm³/s' }];
  state.rawMeasurements = [
    { value: 10, recordedAt: new Date('2026-06-01T00:30:00Z'), sensor: { parameter: 'DISCHARGE' } },
    { value: 30, recordedAt: new Date('2026-06-01T23:00:00Z'), sensor: { parameter: 'DISCHARGE' } },
  ];
}

describe('GET /api/v1/stations/:id/narrative', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    state.stationById = {};
    state.sensors = [];
    state.rawMeasurements = [];
    state.threshold = null;
    state.cachedInsight = null;
    vi.stubGlobal('fetch', okFetch());
    app = await buildServer();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
    process.env.MISTRAL_API_KEY = 'test-key';
  });

  it('returns 400 when parameter is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/stations/stn-1/narrative?from=2026-06-01T00:00:00Z&to=2026-06-02T00:00:00Z',
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when from >= to', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/stations/stn-1/narrative?parameter=DISCHARGE&from=2026-06-02T00:00:00Z&to=2026-06-02T00:00:00Z',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the station does not exist', async () => {
    state.stationById = { 'stn-1': null };
    const res = await app.inject({ method: 'GET', url: URL_BASE });
    expect(res.statusCode).toBe(404);
    expect((res.json() as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });

  it('generates a narrative with grounding when data is sufficient', async () => {
    twoRisingDischargePoints();
    state.threshold = { vigilanceValue: 40, alertValue: 80, direction: 'ABOVE' };

    const res = await app.inject({ method: 'GET', url: URL_BASE });
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as {
      data: {
        state: string;
        text: string | null;
        language: string;
        grounding: { trend: string | null; deltaAbs: number | null; status: string | null };
      };
    };
    expect(data.state).toBe('generated');
    expect(data.text).toBe('Le débit a augmenté.');
    expect(data.language).toBe('fr');
    expect(data.grounding.trend).toBe('RISING');
    expect(data.grounding.deltaAbs).toBe(20);
    expect(data.grounding.status).toBe('NORMAL'); // last value 30 < vigilance 40
  });

  it('serves a cached narrative without calling the LLM', async () => {
    twoRisingDischargePoints();
    state.cachedInsight = {
      id: 'ins-old',
      text: 'Texte en cache.',
      generatedAt: new Date('2026-06-01T12:00:00.000Z'),
      promptTokens: 1,
      completionTokens: 1,
      costUsd: null,
      latencyMs: 1,
    };
    const fetchSpy = okFetch();
    vi.stubGlobal('fetch', fetchSpy);

    const res = await app.inject({ method: 'GET', url: URL_BASE });
    const { data } = res.json() as { data: { state: string; text: string } };
    expect(data.state).toBe('cached');
    expect(data.text).toBe('Texte en cache.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 200 unavailable/insufficient_data with a single point (no LLM call)', async () => {
    state.stationById = { 'stn-1': { id: 'stn-1' } };
    state.sensors = [{ id: 'sen-1', parameter: 'DISCHARGE', unit: 'm³/s' }];
    state.rawMeasurements = [
      {
        value: 10,
        recordedAt: new Date('2026-06-01T00:30:00Z'),
        sensor: { parameter: 'DISCHARGE' },
      },
    ];
    const fetchSpy = okFetch();
    vi.stubGlobal('fetch', fetchSpy);

    const res = await app.inject({ method: 'GET', url: URL_BASE });
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as { data: { state: string; reason: string; text: null } };
    expect(data.state).toBe('unavailable');
    expect(data.reason).toBe('insufficient_data');
    expect(data.text).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('degrades to unavailable/config_error when the API key is missing', async () => {
    twoRisingDischargePoints();
    process.env.MISTRAL_API_KEY = '';

    const res = await app.inject({ method: 'GET', url: URL_BASE });
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as { data: { state: string; reason: string } };
    expect(data.state).toBe('unavailable');
    expect(data.reason).toBe('config_error');
  });

  it('degrades to unavailable/llm_error on an upstream LLM failure', async () => {
    twoRisingDischargePoints();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })) as unknown as typeof fetch
    );

    const res = await app.inject({ method: 'GET', url: URL_BASE });
    expect(res.statusCode).toBe(200);
    const { data } = res.json() as { data: { state: string; reason: string } };
    expect(data.state).toBe('unavailable');
    expect(data.reason).toBe('llm_error');
  });
});
