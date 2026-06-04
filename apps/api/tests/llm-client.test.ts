import { describe, expect, it, vi } from 'vitest';

import { LlmError, createMistralClient } from '../src/ai/llm-client.js';

function fakeResponse(init: {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
}): Response {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    statusText: init.statusText ?? '',
    json: init.json ?? (async () => ({})),
  } as unknown as Response;
}

const REQ = { system: 'sys', user: 'user' };

describe('createMistralClient', () => {
  it('returns text and token usage on success, with measured latency', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '  Le débit est stable.  ' } }],
          usage: { prompt_tokens: 120, completion_tokens: 30 },
        }),
      })
    );
    let t = 1000;
    const now = () => {
      const v = t;
      t += 250; // second call (end) is 250ms after the first (start)
      return v;
    };
    const client = createMistralClient({ apiKey: 'k', fetchImpl, now });

    const out = await client.complete(REQ);

    expect(out.text).toBe('Le débit est stable.');
    expect(out.promptTokens).toBe(120);
    expect(out.completionTokens).toBe(30);
    expect(out.latencyMs).toBe(250);
    expect(client.provider).toBe('mistral');
    expect(client.model).toBe('mistral-small-latest');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('throws a typed config error when the API key is missing', async () => {
    const fetchImpl = vi.fn();
    // Empty string forces the config path regardless of process.env.
    const client = createMistralClient({ apiKey: '', fetchImpl });
    await expect(client.complete(REQ)).rejects.toMatchObject({ kind: 'config' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws a typed http error on a non-OK response', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse({ ok: false, status: 429, statusText: 'Too Many Requests' })
    );
    const client = createMistralClient({ apiKey: 'k', fetchImpl });
    await expect(client.complete(REQ)).rejects.toMatchObject({ kind: 'http' });
  });

  it('throws a typed network error when fetch rejects', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const client = createMistralClient({ apiKey: 'k', fetchImpl });
    await expect(client.complete(REQ)).rejects.toMatchObject({ kind: 'network' });
  });

  it('throws a typed timeout error on abort', async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });
    const client = createMistralClient({ apiKey: 'k', fetchImpl });
    await expect(client.complete(REQ)).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('throws a typed parse error when content is absent', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse({ ok: true, json: async () => ({ choices: [{ message: {} }] }) })
    );
    const client = createMistralClient({ apiKey: 'k', fetchImpl });
    await expect(client.complete(REQ)).rejects.toBeInstanceOf(LlmError);
    await expect(client.complete(REQ)).rejects.toMatchObject({ kind: 'parse' });
  });

  it('truncates non-integer token counts to null', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 'n/a' },
        }),
      })
    );
    const client = createMistralClient({ apiKey: 'k', fetchImpl });
    const out = await client.complete(REQ);
    expect(out.promptTokens).toBeNull();
    expect(out.completionTokens).toBeNull();
  });
});
