import type { AlertDTO } from '@alpimonitor/shared';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api-client';

import { useAlertsStore } from './alerts';

function makeAlert(partial: Partial<AlertDTO> & { id: string }): AlertDTO {
  return {
    id: partial.id,
    stationId: partial.stationId ?? 'station-1',
    type: partial.type ?? 'STATISTICAL_ANOMALY',
    level: partial.level ?? 'VIGILANCE',
    parameter: partial.parameter ?? 'DISCHARGE',
    triggerValue: partial.triggerValue ?? 1.2,
    thresholdValue: partial.thresholdValue ?? 2.0,
    openedAt: partial.openedAt ?? '2026-06-04T06:00:00.000Z',
    closedAt: partial.closedAt ?? null,
    metadata: partial.metadata ?? { z: -2.4, hourBucket: 6 },
  };
}

// getAlerts is called twice per refresh (status:'open' then status:'closed').
// Route each call to the right fixture by its `status` param.
function mockAlerts(open: AlertDTO[], closed: AlertDTO[]) {
  return vi.spyOn(api, 'getAlerts').mockImplementation((params = {}) => {
    const data = params.status === 'closed' ? closed : open;
    return Promise.resolve({ success: true as const, data: { data } });
  });
}

describe('useAlertsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('populates open and recent-closed lists and derives the active count', async () => {
    mockAlerts(
      [makeAlert({ id: 'open-1' }), makeAlert({ id: 'open-2', stationId: 'station-2' })],
      [makeAlert({ id: 'closed-1', closedAt: '2026-06-03T12:00:00.000Z' })]
    );
    const store = useAlertsStore();
    await store.fetchAlerts();

    expect(store.openAlerts).toHaveLength(2);
    expect(store.recentClosedAlerts).toHaveLength(1);
    expect(store.activeAlertsCount).toBe(2);
    expect(store.hasOpenAlerts).toBe(true);
    expect(store.hasLoadedOnce).toBe(true);
    expect(store.error).toBeNull();
  });

  it('reports a nominal network when no episode is open', async () => {
    mockAlerts([], []);
    const store = useAlertsStore();
    await store.fetchAlerts();

    expect(store.activeAlertsCount).toBe(0);
    expect(store.hasOpenAlerts).toBe(false);
    expect(store.error).toBeNull();
    expect(store.hasLoadedOnce).toBe(true);
  });

  it('surfaces an error when the open-episodes read fails', async () => {
    vi.spyOn(api, 'getAlerts').mockImplementation((params = {}) => {
      if (params.status === 'closed') {
        return Promise.resolve({ success: true as const, data: { data: [] } });
      }
      return Promise.resolve({
        success: false as const,
        error: { kind: 'http', status: 503, statusText: 'x', path: '/alerts' },
      });
    });
    const store = useAlertsStore();
    await store.fetchAlerts();

    expect(store.error?.kind).toBe('http');
    expect(store.hasLoadedOnce).toBe(true);
  });

  it('keeps the open list and raises no panel error when only the history read fails', async () => {
    vi.spyOn(api, 'getAlerts').mockImplementation((params = {}) => {
      if (params.status === 'closed') {
        return Promise.resolve({
          success: false as const,
          error: { kind: 'network', cause: new Error('boom') },
        });
      }
      return Promise.resolve({ success: true as const, data: { data: [makeAlert({ id: 'o' })] } });
    });
    const store = useAlertsStore();
    await store.fetchAlerts();

    expect(store.openAlerts).toHaveLength(1);
    expect(store.error).toBeNull();
  });
});
