/**
 * Read-only facade over useStationsStore for the "selection" concern.
 *
 * Consumers should import this composable, NOT useStationsStore directly.
 * Exception: test files (.test.ts) and Storybook decorators (seedStations)
 * legitimately access the underlying store to seed controlled states via
 * $patch — that's a test setup concern incompatible with a public facade API.
 */

import type { StationDTO } from '@alpimonitor/shared';
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';

import { useStationsStore } from '@/stores/stations';

export interface UseStationSelection {
  selectedStation: Ref<StationDTO | null>;
  selectedStationId: Ref<string | null>;
  selectStation: (id: string) => void;
  clearSelection: () => void;
}

export function useStationSelection(): UseStationSelection {
  const store = useStationsStore();
  const { selectedStation, selectedStationId } = storeToRefs(store);

  return {
    selectedStation,
    selectedStationId,
    selectStation: (id: string) => store.selectStation(id),
    clearSelection: () => store.clearSelection(),
  };
}
