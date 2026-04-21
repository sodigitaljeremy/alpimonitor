import type { StationDTO } from '@alpimonitor/shared';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStationsStore } from './stations';

const ok = <T>(body: T): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const httpError = (status: number, statusText: string): Response =>
  new Response('', { status, statusText });

function station(partial: Partial<StationDTO> & { id: string }): StationDTO {
  return {
    id: partial.id,
    ofevCode: partial.ofevCode ?? partial.id,
    name: partial.name ?? partial.id,
    riverName: partial.riverName ?? 'Rhône',
    latitude: partial.latitude ?? 46.2,
    longitude: partial.longitude ?? 7.35,
    altitudeM: partial.altitudeM ?? 500,
    flowType: partial.flowType ?? 'NATURAL',
    operatorName: partial.operatorName ?? 'OFEV',
    dataSource: partial.dataSource ?? 'LIVE',
    latestMeasurements: partial.latestMeasurements ?? [],
    activeAlertsCount: partial.activeAlertsCount ?? 0,
  };
}

describe('useStationsStore', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('populates stations from a successful /stations response', async () => {
    const payload = [
      station({ id: 'a', name: 'Brig', dataSource: 'LIVE' }),
      station({ id: 'b', name: 'Borgne — Bramois', dataSource: 'RESEARCH' }),
    ];
    fetchMock.mockResolvedValueOnce(ok({ data: payload }));

    const store = useStationsStore();
    await store.fetchStations();

    expect(store.error).toBeNull();
    expect(store.hasLoadedOnce).toBe(true);
    expect(store.stations).toHaveLength(2);
    expect(store.stations.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('accepts an empty list as a valid loaded state', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [] }));

    const store = useStationsStore();
    await store.fetchStations();

    expect(store.error).toBeNull();
    expect(store.hasLoadedOnce).toBe(true);
    expect(store.stations).toEqual([]);
  });

  it('captures error on HTTP 500 and keeps hasLoadedOnce false', async () => {
    fetchMock.mockResolvedValueOnce(httpError(500, 'Internal Server Error'));

    const store = useStationsStore();
    await store.fetchStations();

    expect(store.error).toBeInstanceOf(Error);
    expect(store.error?.message).toContain('500');
    expect(store.hasLoadedOnce).toBe(false);
    expect(store.stations).toEqual([]);
  });

  it('captures a network error as an Error instance', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const store = useStationsStore();
    await store.fetchStations();

    expect(store.error).toBeInstanceOf(Error);
    expect(store.error?.message).toBe('Failed to fetch');
    expect(store.hasLoadedOnce).toBe(false);
  });

  it('resets error on a subsequent successful fetch', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(ok({ data: [station({ id: 'a' })] }));

    const store = useStationsStore();
    await store.fetchStations();
    expect(store.error).toBeInstanceOf(Error);

    await store.fetchStations();
    expect(store.error).toBeNull();
    expect(store.stations).toHaveLength(1);
  });
});
