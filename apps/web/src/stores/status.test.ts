import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStatusStore } from './status';

type StatusResponseShape = {
  api: { status: 'ok'; uptimeSeconds: number };
  database: { status: 'ok' | 'error' };
  ingestion: {
    lastRun: null;
    lastSuccessAt: string | null;
    healthyThresholdMinutes: number;
    today: { runsCount: number; measurementsCreatedSum: number; successRate: number | null };
  };
};

const ok = <T>(body: T): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const httpError = (status: number, statusText: string): Response =>
  new Response('', { status, statusText });

function statusBody(
  overrides: Partial<StatusResponseShape['ingestion']> = {}
): StatusResponseShape {
  return {
    api: { status: 'ok', uptimeSeconds: 3600 },
    database: { status: 'ok' },
    ingestion: {
      lastRun: null,
      lastSuccessAt: null,
      healthyThresholdMinutes: 30,
      today: { runsCount: 0, measurementsCreatedSum: 0, successRate: null },
      ...overrides,
    },
  };
}

describe('useStatusStore', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Freeze the reactive clock so (now - lastSuccessAt) is deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T12:00:00Z'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('populates state from a successful /status response', async () => {
    fetchMock.mockResolvedValueOnce(
      ok(
        statusBody({
          lastSuccessAt: '2026-04-21T11:58:00.000Z', // 2 minutes ago
          today: { runsCount: 6, measurementsCreatedSum: 48, successRate: 1 },
        })
      )
    );

    const store = useStatusStore();
    await store.fetchStatus();

    expect(store.error).toBeNull();
    expect(store.hasLoadedOnce).toBe(true);
    expect(store.lastSuccessAt).toEqual(new Date('2026-04-21T11:58:00.000Z'));
    expect(store.today).toEqual({ runsCount: 6, measurementsCreatedSum: 48, successRate: 1 });
    expect(store.healthyThresholdMinutes).toBe(30);
  });

  it('isHealthy is true when lastSuccessAt is within the threshold', async () => {
    fetchMock.mockResolvedValueOnce(
      ok(statusBody({ lastSuccessAt: '2026-04-21T11:55:00.000Z' })) // 5 min ago, threshold 30
    );
    const store = useStatusStore();
    await store.fetchStatus();

    expect(store.isHealthy).toBe(true);
    expect(store.minutesSinceLastSuccess).toBe(5);
  });

  it('isHealthy is false (stale) when lastSuccessAt is past the threshold', async () => {
    fetchMock.mockResolvedValueOnce(
      ok(statusBody({ lastSuccessAt: '2026-04-21T11:20:00.000Z' })) // 40 min ago
    );
    const store = useStatusStore();
    await store.fetchStatus();

    expect(store.isHealthy).toBe(false);
    expect(store.minutesSinceLastSuccess).toBe(40);
  });

  it('isHealthy is false and minutesSinceLastSuccess is null when lastSuccessAt is unset', async () => {
    fetchMock.mockResolvedValueOnce(ok(statusBody({ lastSuccessAt: null })));
    const store = useStatusStore();
    await store.fetchStatus();

    expect(store.isHealthy).toBe(false);
    expect(store.minutesSinceLastSuccess).toBeNull();
  });

  it('captures an http error on HTTP 500 and leaves state otherwise untouched', async () => {
    fetchMock.mockResolvedValueOnce(httpError(500, 'Internal Server Error'));
    const store = useStatusStore();
    await store.fetchStatus();

    expect(store.error?.kind).toBe('http');
    if (store.error?.kind === 'http') {
      expect(store.error.status).toBe(500);
      expect(store.error.path).toBe('/status');
    }
    expect(store.hasLoadedOnce).toBe(false);
    expect(store.lastSuccessAt).toBeNull();
  });

  it('captures a network error with the underlying cause', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const store = useStatusStore();
    await store.fetchStatus();

    expect(store.error?.kind).toBe('network');
    if (store.error?.kind === 'network') {
      expect(store.error.cause.message).toBe('Failed to fetch');
    }
    expect(store.hasLoadedOnce).toBe(false);
  });

  it('minutesSinceLastSuccess recomputes as the reactive clock advances', async () => {
    fetchMock.mockResolvedValueOnce(
      ok(statusBody({ lastSuccessAt: '2026-04-21T12:00:00.000Z' })) // now
    );
    const store = useStatusStore();
    await store.fetchStatus();

    expect(store.minutesSinceLastSuccess).toBe(0);

    // Advance the clock by 3 minutes — useNow's 60_000ms interval fires
    // three times over the span and its ref tracks the new "now".
    await vi.advanceTimersByTimeAsync(3 * 60_000);

    expect(store.minutesSinceLastSuccess).toBe(3);
  });
});
