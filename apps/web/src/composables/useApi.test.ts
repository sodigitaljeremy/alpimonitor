import { effectScope, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useApi } from './useApi';

type FetchMock = ReturnType<typeof vi.fn>;

const ok = <T>(body: T): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const httpError = (status: number, statusText: string): Response =>
  new Response('', { status, statusText });

describe('useApi', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('populates data and clears error on a successful fetch', async () => {
    fetchMock.mockResolvedValueOnce(ok({ status: 'ok' }));

    const scope = effectScope();
    const api = scope.run(() => useApi<{ status: string }>('/health'))!;

    // Wait for the immediate refresh promise chain to resolve.
    await vi.waitFor(() => expect(api.loading.value).toBe(false));

    expect(api.data.value).toEqual({ status: 'ok' });
    expect(api.error.value).toBeNull();
    scope.stop();
  });

  it('sets error and leaves data null when the response is not ok', async () => {
    fetchMock.mockResolvedValueOnce(httpError(500, 'Internal Server Error'));

    const scope = effectScope();
    const api = scope.run(() => useApi('/health'))!;

    await vi.waitFor(() => expect(api.loading.value).toBe(false));

    expect(api.data.value).toBeNull();
    expect(api.error.value).toBeInstanceOf(Error);
    expect(api.error.value?.message).toContain('500');
    expect(api.error.value?.message).toContain('/health');
    scope.stop();
  });

  it('wraps a network failure as an Error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const scope = effectScope();
    const api = scope.run(() => useApi('/health'))!;

    await vi.waitFor(() => expect(api.loading.value).toBe(false));

    expect(api.data.value).toBeNull();
    expect(api.error.value).toBeInstanceOf(Error);
    expect(api.error.value?.message).toBe('Failed to fetch');
    scope.stop();
  });

  it('polls at the given interval and stops when the scope disposes', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(ok({ tick: 1 }));

    const scope = effectScope();
    scope.run(() => useApi('/status', { interval: 1000, immediate: false }));

    expect(fetchMock).toHaveBeenCalledTimes(0);

    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await nextTick();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    scope.stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips the initial call when immediate is false', async () => {
    fetchMock.mockResolvedValue(ok({ tick: 1 }));

    const scope = effectScope();
    const api = scope.run(() => useApi('/status', { immediate: false }))!;

    await nextTick();
    expect(fetchMock).toHaveBeenCalledTimes(0);

    await api.refresh();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    scope.stop();
  });
});
