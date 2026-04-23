import type { MeasurementSeries } from '@alpimonitor/shared';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { ApiError } from '@/lib/api-client';
import { useStationsStore } from '@/stores/stations';

import { useStationMeasurements } from './useStationMeasurements';

function discharge(points: Array<{ t: string; v: number }>): MeasurementSeries {
  return { parameter: 'DISCHARGE', unit: 'm³/s', points };
}

describe('useStationMeasurements', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('happy path: derives series, isLoading, error from the store for a given stationId', () => {
    const store = useStationsStore();
    const seriesA = discharge([{ t: '2026-04-21T11:00:00.000Z', v: 42 }]);
    store.$patch({
      measurementsByStation: { a: [seriesA] },
      measurementsLoadingByStation: { a: false },
      measurementsErrorByStation: { a: null },
    });

    const stationId = ref<string | null>('a');
    const { series, isLoading, error } = useStationMeasurements(stationId);

    expect(series.value).toEqual([seriesA]);
    expect(isLoading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('reacts to stationId changes and switches the derived slice', () => {
    const store = useStationsStore();
    store.$patch({
      measurementsByStation: {
        a: [discharge([{ t: '2026-04-21T11:00:00.000Z', v: 1 }])],
        b: [discharge([{ t: '2026-04-21T11:00:00.000Z', v: 2 }])],
      },
    });

    const stationId = ref<string | null>('a');
    const { series } = useStationMeasurements(stationId);
    expect(series.value?.[0]?.points[0]?.v).toBe(1);

    stationId.value = 'b';
    expect(series.value?.[0]?.points[0]?.v).toBe(2);
  });

  it('returns undefined/false/null and skips network when stationId is null', async () => {
    const store = useStationsStore();
    const spy = vi.spyOn(store, 'fetchMeasurements').mockResolvedValue();

    const stationId = ref<string | null>(null);
    const { series, isLoading, error, load, reload } = useStationMeasurements(stationId);

    expect(series.value).toBeUndefined();
    expect(isLoading.value).toBe(false);
    expect(error.value).toBeNull();

    await load();
    await reload();

    expect(spy).toHaveBeenCalledTimes(0);
  });

  it('load() delegates to store.fetchMeasurements without the force flag', async () => {
    const store = useStationsStore();
    const spy = vi.spyOn(store, 'fetchMeasurements').mockResolvedValue();

    const stationId = ref<string | null>('a');
    const { load } = useStationMeasurements(stationId);
    await load();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith('a');
  });

  it('reload() delegates to store.fetchMeasurements with force: true', async () => {
    const store = useStationsStore();
    const spy = vi.spyOn(store, 'fetchMeasurements').mockResolvedValue();

    const stationId = ref<string | null>('a');
    const { reload } = useStationMeasurements(stationId);
    await reload();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith('a', { force: true });
  });

  it('propagates an ApiError set on the underlying per-station record', () => {
    const store = useStationsStore();
    const apiError: ApiError = {
      kind: 'http',
      status: 500,
      statusText: 'Internal Server Error',
      path: '/stations/a/measurements',
    };
    store.$patch({
      measurementsErrorByStation: { a: apiError },
    });

    const stationId = ref<string | null>('a');
    const { error } = useStationMeasurements(stationId);

    expect(error.value).toEqual(apiError);
    expect(error.value?.kind).toBe('http');
  });
});
