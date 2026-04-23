/**
 * Read-only facade over useStationsStore for the "stations list" concern.
 *
 * Consumers should import this composable, NOT useStationsStore directly.
 * Exception: test files (.test.ts) and Storybook decorators (seedStations)
 * legitimately access the underlying store to seed controlled states via
 * $patch — that's a test setup concern incompatible with a public facade API.
 */

import type { StationDTO } from '@alpimonitor/shared';
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';

import type { ApiError } from '@/lib/api-client';
import { useStationsStore } from '@/stores/stations';

export interface UseStationsList {
  stations: Ref<StationDTO[]>;
  isLoading: Ref<boolean>;
  error: Ref<ApiError | null>;
  hasLoadedOnce: Ref<boolean>;
  loadAll: () => Promise<void>;
}

export function useStationsList(): UseStationsList {
  const store = useStationsStore();
  const { stations, loading: isLoading, error, hasLoadedOnce } = storeToRefs(store);

  return {
    stations,
    isLoading,
    error,
    hasLoadedOnce,
    loadAll: () => store.fetchStations(),
  };
}
