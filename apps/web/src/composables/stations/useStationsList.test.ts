import type { StationDTO } from '@alpimonitor/shared';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiError } from '@/lib/api-client';
import { useStationsStore } from '@/stores/stations';

import { useStationsList } from './useStationsList';

function station(id: string): StationDTO {
  return {
    id,
    ofevCode: id,
    name: id,
    riverName: 'Rhône',
    latitude: 46.2,
    longitude: 7.35,
    altitudeM: 500,
    flowType: 'NATURAL',
    operatorName: 'OFEV',
    dataSource: 'LIVE',
    sourcingStatus: 'CONFIRMED',
    latestMeasurements: [],
    activeAlertsCount: 0,
  };
}

describe('useStationsList', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('happy path: exposes stations, hasLoadedOnce, isLoading, error from the seeded store', () => {
    const store = useStationsStore();
    store.$patch({
      stations: [station('a'), station('b')],
      hasLoadedOnce: true,
      loading: false,
      error: null,
    });

    const { stations, hasLoadedOnce, isLoading, error } = useStationsList();

    expect(stations.value).toHaveLength(2);
    expect(stations.value.map((s) => s.id)).toEqual(['a', 'b']);
    expect(hasLoadedOnce.value).toBe(true);
    expect(isLoading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('propagates an ApiError set on the underlying store', () => {
    const store = useStationsStore();
    const apiError: ApiError = {
      kind: 'http',
      status: 500,
      statusText: 'Internal Server Error',
      path: '/stations',
    };
    store.$patch({ error: apiError });

    const { error } = useStationsList();

    expect(error.value).toEqual(apiError);
    expect(error.value?.kind).toBe('http');
  });

  it('loadAll delegates to the underlying store.fetchStations', async () => {
    const store = useStationsStore();
    const spy = vi.spyOn(store, 'fetchStations').mockResolvedValue();

    const { loadAll } = useStationsList();
    await loadAll();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
