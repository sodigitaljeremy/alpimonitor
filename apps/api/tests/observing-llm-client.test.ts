import { describe, expect, it, vi } from 'vitest';

import { LlmError, type LlmClient } from '../src/ai/llm-client.js';
import {
  type LlmCallRecord,
  type LlmCallStore,
  createObservingLlmClient,
} from '../src/ai/observing-llm-client.js';

function fakeStore(): LlmCallStore & { records: LlmCallRecord[] } {
  const records: LlmCallRecord[] = [];
  return {
    records,
    async record(r) {
      records.push(r);
    },
  };
}

function innerOk(): LlmClient {
  return {
    provider: 'mistral',
    model: 'mistral-small-latest',
    async complete() {
      return {
        text: 'ok',
        promptTokens: 1000,
        completionTokens: 500,
        latencyMs: 1,
        costUsd: null,
      };
    },
    async completeWithTools() {
      return {
        text: null,
        toolCalls: [{ id: 'c1', name: 'listStations', arguments: '{}' }],
        promptTokens: 1000,
        completionTokens: 500,
        latencyMs: 1,
        costUsd: null,
      };
    },
  };
}

// Deterministic clock: start, then end = +123ms.
function clock123(): () => number {
  let t = 1000;
  return () => {
    const v = t;
    t += 123;
    return v;
  };
}

const REQ = { system: 's', user: 'u' };

describe('createObservingLlmClient', () => {
  it('records a SUCCESS call with computed cost and latency, and fills costUsd', async () => {
    const store = fakeStore();
    const client = createObservingLlmClient(innerOk(), store, {
      operation: 'narration',
      now: clock123(),
    });

    const out = await client.complete(REQ);

    expect(out.costUsd).toBe(0.00025); // 1000*0.1/M + 500*0.3/M
    expect(store.records).toHaveLength(1);
    expect(store.records[0]).toMatchObject({
      provider: 'mistral',
      model: 'mistral-small-latest',
      operation: 'narration',
      status: 'SUCCESS',
      errorKind: null,
      promptTokens: 1000,
      completionTokens: 500,
      costUsd: 0.00025,
      latencyMs: 123,
    });
  });

  it('records an ERROR call with the typed error kind and rethrows', async () => {
    const store = fakeStore();
    const inner: LlmClient = {
      provider: 'mistral',
      model: 'mistral-small-latest',
      complete: vi.fn(async () => {
        throw new LlmError('http', 'boom 503');
      }),
      completeWithTools: vi.fn(async () => {
        throw new LlmError('http', 'boom 503');
      }),
    };
    const client = createObservingLlmClient(inner, store, { operation: 'narration' });

    await expect(client.complete(REQ)).rejects.toBeInstanceOf(LlmError);
    expect(store.records).toHaveLength(1);
    expect(store.records[0]).toMatchObject({
      status: 'ERROR',
      errorKind: 'http',
      promptTokens: null,
      costUsd: null,
    });
  });

  it('records a completeWithTools call as operation:chat and surfaces the tool calls (C2)', async () => {
    const store = fakeStore();
    // Decorator default is 'narration'; the chat request overrides it per call.
    const client = createObservingLlmClient(innerOk(), store, {
      operation: 'narration',
      now: clock123(),
    });

    const out = await client.completeWithTools({
      system: 's',
      messages: [{ role: 'user', content: 'combien de stations ?' }],
      tools: [],
      operation: 'chat',
    });

    // Tool calls are passed through untouched, costUsd filled by the decorator.
    expect(out.toolCalls).toEqual([{ id: 'c1', name: 'listStations', arguments: '{}' }]);
    expect(out.costUsd).toBe(0.00025); // 1000*0.1/M + 500*0.3/M

    expect(store.records).toHaveLength(1);
    expect(store.records[0]).toMatchObject({
      provider: 'mistral',
      model: 'mistral-small-latest',
      operation: 'chat', // per-call label, not the decorator default
      status: 'SUCCESS',
      errorKind: null,
      promptTokens: 1000,
      completionTokens: 500,
      costUsd: 0.00025,
      latencyMs: 123,
    });
  });

  it('falls back to the decorator operation when completeWithTools omits one (narration not regressed)', async () => {
    const store = fakeStore();
    const client = createObservingLlmClient(innerOk(), store, { operation: 'narration' });

    await client.completeWithTools({ system: 's', messages: [], tools: [] });

    expect(store.records).toHaveLength(1);
    expect(store.records[0]).toMatchObject({ operation: 'narration', status: 'SUCCESS' });
  });

  it('never breaks the call when the store fails (best-effort observability)', async () => {
    const brokenStore: LlmCallStore = {
      record: vi.fn(async () => {
        throw new Error('db down');
      }),
    };
    const client = createObservingLlmClient(innerOk(), brokenStore, { operation: 'narration' });

    const out = await client.complete(REQ);
    expect(out.text).toBe('ok');
  });
});
