import type { AskResponseDTO } from '@alpimonitor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api-client';

import { useDataChat } from './useDataChat';

function dto(overrides: Partial<AskResponseDTO> = {}): AskResponseDTO {
  return {
    answer: 'Le débit à Sion est de 42,5 m³/s.',
    used: [
      {
        tool: 'get_latest_measurements',
        args: '{"stationId":"s1"}',
        resultSummary: '1 résultat(s)',
      },
    ],
    language: 'fr',
    generatedAt: '2026-06-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('useDataChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('appends a user message then an assistant answer with its tool trace on success', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue({ success: true, data: dto() });

    const chat = useDataChat();
    await chat.ask('Quel est le débit à Sion ?');

    expect(chat.messages.value).toHaveLength(2);
    const [user, assistant] = chat.messages.value;
    expect(user).toMatchObject({ role: 'user', content: 'Quel est le débit à Sion ?' });
    expect(assistant?.role).toBe('assistant');
    if (assistant?.role !== 'assistant') throw new Error('expected an assistant message');
    expect(assistant.answer).toBe('Le débit à Sion est de 42,5 m³/s.');
    expect(assistant.used[0]?.tool).toBe('get_latest_measurements');
    expect(chat.error.value).toBeNull();
    expect(chat.isLoading.value).toBe(false);
    expect(chat.hasMessages.value).toBe(true);
  });

  it('forwards the language hint to the api client', async () => {
    const spy = vi
      .spyOn(api, 'ask')
      .mockResolvedValue({ success: true, data: dto({ language: 'en' }) });

    const chat = useDataChat();
    await chat.ask('What is the discharge at Sion?', 'en');

    expect(spy).toHaveBeenCalledWith('What is the discharge at Sion?', 'en');
  });

  it('maps a 429 to a rate_limited error without an assistant message', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue({
      success: false,
      error: { kind: 'http', status: 429, statusText: 'Too Many Requests', path: '/ask' },
    });

    const chat = useDataChat();
    await chat.ask('trop souvent');

    expect(chat.error.value?.reason).toBe('rate_limited');
    // The user turn stays in the thread; no assistant bubble was added.
    expect(chat.messages.value).toHaveLength(1);
    expect(chat.messages.value[0]?.role).toBe('user');
  });

  it('maps a 503 to ai_unavailable', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue({
      success: false,
      error: { kind: 'http', status: 503, statusText: 'Service Unavailable', path: '/ask' },
    });

    const chat = useDataChat();
    await chat.ask('service coupé ?');

    expect(chat.error.value?.reason).toBe('ai_unavailable');
  });

  it('maps a 400 to bad_request', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue({
      success: false,
      error: { kind: 'http', status: 400, statusText: 'Bad Request', path: '/ask' },
    });

    const chat = useDataChat();
    await chat.ask('?');

    expect(chat.error.value?.reason).toBe('bad_request');
  });

  it('maps a network failure to unknown', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue({
      success: false,
      error: { kind: 'network', cause: new Error('offline') },
    });

    const chat = useDataChat();
    await chat.ask('hors ligne');

    expect(chat.error.value?.reason).toBe('unknown');
  });

  it('ignores empty / whitespace-only questions (no api call, no message)', async () => {
    const spy = vi.spyOn(api, 'ask');

    const chat = useDataChat();
    await chat.ask('   ');

    expect(spy).not.toHaveBeenCalled();
    expect(chat.messages.value).toHaveLength(0);
  });

  it('clears a previous error when a new ask succeeds', async () => {
    const spy = vi.spyOn(api, 'ask');
    spy.mockResolvedValueOnce({
      success: false,
      error: { kind: 'http', status: 503, statusText: 'Service Unavailable', path: '/ask' },
    });
    spy.mockResolvedValueOnce({ success: true, data: dto() });

    const chat = useDataChat();
    await chat.ask('première');
    expect(chat.error.value?.reason).toBe('ai_unavailable');

    await chat.ask('seconde');
    expect(chat.error.value).toBeNull();
  });

  it('reset() clears the thread and error', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue({ success: true, data: dto() });

    const chat = useDataChat();
    await chat.ask('une question');
    chat.reset();

    expect(chat.messages.value).toHaveLength(0);
    expect(chat.error.value).toBeNull();
    expect(chat.hasMessages.value).toBe(false);
  });
});
