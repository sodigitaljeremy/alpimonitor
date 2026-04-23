/**
 * Read-only facade over useStationsStore for the "per-station measurements"
 * concern. Takes a reactive stationId and derives the matching series,
 * loading flag, and error from the store's per-station Records.
 *
 * Consumers should import this composable, NOT useStationsStore directly.
 * Exception: test files (.test.ts) and Storybook decorators (seedStations)
 * legitimately access the underlying store to seed controlled states via
 * $patch — that's a test setup concern incompatible with a public facade API.
 */

import type { MeasurementSeries } from '@alpimonitor/shared';
import { computed, type ComputedRef, type Ref } from 'vue';

import type { ApiError } from '@/lib/api-client';
import { useStationsStore } from '@/stores/stations';

export interface UseStationMeasurements {
  series: ComputedRef<MeasurementSeries[] | undefined>;
  isLoading: ComputedRef<boolean>;
  error: ComputedRef<ApiError | null>;
  /** Fetch the series for the current stationId, respecting the store cache. */
  load: () => Promise<void>;
  /** Force-refetch the series for the current stationId, bypassing the cache. */
  reload: () => Promise<void>;
}

export function useStationMeasurements(stationId: Ref<string | null>): UseStationMeasurements {
  const store = useStationsStore();

  const series = computed<MeasurementSeries[] | undefined>(() => {
    const id = stationId.value;
    if (id === null) return undefined;
    return store.measurementsByStation[id];
  });

  const isLoading = computed<boolean>(() => {
    const id = stationId.value;
    if (id === null) return false;
    return store.measurementsLoadingByStation[id] ?? false;
  });

  const error = computed<ApiError | null>(() => {
    const id = stationId.value;
    if (id === null) return null;
    return store.measurementsErrorByStation[id] ?? null;
  });

  async function load(): Promise<void> {
    const id = stationId.value;
    if (id === null) return;
    await store.fetchMeasurements(id);
  }

  async function reload(): Promise<void> {
    const id = stationId.value;
    if (id === null) return;
    await store.fetchMeasurements(id, { force: true });
  }

  return { series, isLoading, error, load, reload };
}
