import { describe, expect, it, vi } from 'vitest';

import { computeNarrationFeatures } from '../src/ai/narration-features.js';
import { LlmError, type LlmClient } from '../src/ai/llm-client.js';
import {
  type InsightRecord,
  type InsightStore,
  computeInputHash,
  generateNarration,
} from '../src/ai/narration-service.js';

const FROM = '2026-06-01T00:00:00.000Z';
const TO = '2026-06-02T00:00:00.000Z';

function featuresFixture() {
  return computeNarrationFeatures({
    parameter: 'DISCHARGE',
    unit: 'm³/s',
    windowFrom: FROM,
    windowTo: TO,
    points: [
      { t: FROM, v: 10 },
      { t: '2026-06-01T23:50:00.000Z', v: 30 },
    ],
    expectedIntervalMinutes: 10,
  });
}

// In-memory store keyed by the compound cache key.
function fakeStore(): InsightStore & { saved: InsightRecord[] } {
  const map = new Map<string, InsightRecord>();
  const k = (key: { stationId: string; parameter: string; language: string; inputHash: string }) =>
    `${key.stationId}|${key.parameter}|${key.language}|${key.inputHash}`;
  const saved: InsightRecord[] = [];
  return {
    saved,
    async find(key) {
      return map.get(k(key)) ?? null;
    },
    async save(data) {
      const rec: InsightRecord = { ...data, id: `ins-${map.size + 1}`, generatedAt: new Date(0) };
      map.set(k(data), rec);
      saved.push(rec);
      return rec;
    },
  };
}

function fakeLlm(overrides: Partial<LlmClient> = {}): LlmClient & { calls: number } {
  const client = {
    calls: 0,
    provider: 'mistral',
    model: 'mistral-small-latest',
    async complete() {
      client.calls += 1;
      return {
        text: 'Le débit a augmenté.',
        promptTokens: 100,
        completionTokens: 20,
        latencyMs: 42,
        costUsd: null,
      };
    },
    async completeWithTools() {
      return {
        text: 'unused by narration',
        toolCalls: null,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
        costUsd: null,
      };
    },
    ...overrides,
  };
  return client as LlmClient & { calls: number };
}

describe('generateNarration', () => {
  it('calls the LLM and persists the insight on a cache miss', async () => {
    const store = fakeStore();
    const llm = fakeLlm();
    const out = await generateNarration(
      { store, llm },
      { stationId: 's1', features: featuresFixture() }
    );

    expect(out.status).toBe('generated');
    if (out.status === 'generated') {
      expect(out.insight.text).toBe('Le débit a augmenté.');
      expect(out.insight.provider).toBe('mistral');
      expect(out.insight.model).toBe('mistral-small-latest');
      expect(out.insight.promptTokens).toBe(100);
      expect(out.insight.latencyMs).toBe(42);
      expect(out.insight.costUsd).toBeNull();
    }
    expect(llm.calls).toBe(1);
    expect(store.saved).toHaveLength(1);
  });

  it('returns the cached insight without calling the LLM again', async () => {
    const store = fakeStore();
    const llm = fakeLlm();
    const params = { stationId: 's1', features: featuresFixture() };

    const first = await generateNarration({ store, llm }, params);
    const second = await generateNarration({ store, llm }, params);

    expect(first.status).toBe('generated');
    expect(second.status).toBe('cached');
    expect(llm.calls).toBe(1); // not called a second time
  });

  it('returns a typed error and does not persist when the LLM fails', async () => {
    const store = fakeStore();
    const llm = fakeLlm({
      complete: vi.fn(async () => {
        throw new LlmError('http', 'Mistral responded 503');
      }),
    });

    const out = await generateNarration(
      { store, llm },
      { stationId: 's1', features: featuresFixture() }
    );

    expect(out.status).toBe('error');
    if (out.status === 'error') {
      expect(out.error.kind).toBe('llm');
      expect(out.error.cause).toBe('http');
    }
    expect(store.saved).toHaveLength(0);
  });

  it('maps a config LlmError to a config outcome', async () => {
    const store = fakeStore();
    const llm = fakeLlm({
      complete: vi.fn(async () => {
        throw new LlmError('config', 'MISTRAL_API_KEY is not set');
      }),
    });

    const out = await generateNarration(
      { store, llm },
      { stationId: 's1', features: featuresFixture() }
    );

    expect(out.status).toBe('error');
    if (out.status === 'error') expect(out.error.kind).toBe('config');
  });

  it('never throws on an unexpected (non-typed) LLM failure', async () => {
    const store = fakeStore();
    const llm = fakeLlm({
      complete: vi.fn(async () => {
        throw new Error('boom');
      }),
    });

    const out = await generateNarration(
      { store, llm },
      { stationId: 's1', features: featuresFixture() }
    );
    expect(out.status).toBe('error');
    if (out.status === 'error') expect(out.error.kind).toBe('llm');
  });
});

describe('computeInputHash', () => {
  const features = featuresFixture();

  it('is deterministic for identical inputs', () => {
    const a = computeInputHash({ features, language: 'fr', model: 'm', promptVersion: 'v1' });
    const b = computeInputHash({ features, language: 'fr', model: 'm', promptVersion: 'v1' });
    expect(a).toBe(b);
  });

  it('changes when language, model, or prompt version changes', () => {
    const base = computeInputHash({ features, language: 'fr', model: 'm', promptVersion: 'v1' });
    expect(
      computeInputHash({ features, language: 'en', model: 'm', promptVersion: 'v1' })
    ).not.toBe(base);
    expect(
      computeInputHash({ features, language: 'fr', model: 'x', promptVersion: 'v1' })
    ).not.toBe(base);
    expect(
      computeInputHash({ features, language: 'fr', model: 'm', promptVersion: 'v2' })
    ).not.toBe(base);
  });
});
