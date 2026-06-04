import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api-client';

import { useAiStatusStore } from './aiStatus';

function aiResponse(overrides: Partial<{ callsToday: number; errorRate: number | null }> = {}) {
  return {
    success: true as const,
    data: {
      ai: {
        callsToday: 5,
        errorRate: 0,
        costUsdToday: 0.0012,
        avgLatencyMs: 800,
        lastCallAt: '2026-06-04T14:00:00.000Z',
        ...overrides,
      },
    },
  };
}

describe('useAiStatusStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('populates metrics on success and is not degraded at low error rate', async () => {
    vi.spyOn(api, 'getAiStatus').mockResolvedValue(aiResponse());
    const store = useAiStatusStore();
    await store.fetchAiStatus();

    expect(store.callsToday).toBe(5);
    expect(store.costUsdToday).toBe(0.0012);
    expect(store.hasLoadedOnce).toBe(true);
    expect(store.error).toBeNull();
    expect(store.isDegraded).toBe(false);
  });

  it('flags degraded when the error rate is at/above the threshold', async () => {
    vi.spyOn(api, 'getAiStatus').mockResolvedValue(aiResponse({ errorRate: 0.6 }));
    const store = useAiStatusStore();
    await store.fetchAiStatus();
    expect(store.isDegraded).toBe(true);
  });

  it('records a transport error', async () => {
    vi.spyOn(api, 'getAiStatus').mockResolvedValue({
      success: false,
      error: { kind: 'http', status: 503, statusText: 'x', path: '/ai/status' },
    });
    const store = useAiStatusStore();
    await store.fetchAiStatus();
    expect(store.error?.kind).toBe('http');
    expect(store.hasLoadedOnce).toBe(true);
  });
});
