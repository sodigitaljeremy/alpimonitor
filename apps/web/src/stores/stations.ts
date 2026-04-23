import type { MeasurementSeries, StationDTO } from '@alpimonitor/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { api, type ApiError } from '@/lib/api-client';
import { ONE_DAY_MS } from '@/lib/constants/time';

export interface FetchMeasurementsOptions {
  force?: boolean;
}

export const useStationsStore = defineStore('stations', () => {
  // Single source of truth for the list. Named `stations` rather than a
  // private `items` + public `stations` computed alias — the two-name
  // pattern added no encapsulation (a writable ref is still reachable via
  // the proxy) and blocked `$patch({ stations: [...] })` from test and
  // Storybook setup code.
  const stations = ref<StationDTO[]>([]);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  // Distinguishes "fetch never returned yet" (show placeholder) from
  // "fetch returned, list is legitimately empty" (show empty-state).
  const hasLoadedOnce = ref(false);

  // Per-station measurement cache. Kept as plain records (not Maps) so
  // Vue's reactivity tracks replacement without custom deep tracking —
  // we always reassign with a new object literal.
  const measurementsByStation = ref<Record<string, MeasurementSeries[]>>({});
  const measurementsLoadingByStation = ref<Record<string, boolean>>({});
  const measurementsErrorByStation = ref<Record<string, ApiError | null>>({});

  const selectedStationId = ref<string | null>(null);

  const selectedStation = computed<StationDTO | null>(() => {
    const id = selectedStationId.value;
    if (id === null) return null;
    return stations.value.find((s) => s.id === id) ?? null;
  });

  async function fetchStations(): Promise<void> {
    loading.value = true;
    error.value = null;
    const result = await api.getStations();
    if (result.success) {
      stations.value = result.data.data;
      hasLoadedOnce.value = true;
    } else {
      error.value = result.error;
    }
    loading.value = false;
  }

  function selectStation(id: string): void {
    selectedStationId.value = id;
  }

  function clearSelection(): void {
    selectedStationId.value = null;
  }

  async function fetchMeasurements(
    stationId: string,
    opts: FetchMeasurementsOptions = {}
  ): Promise<void> {
    const { force = false } = opts;

    // Cache hit: skip network unless the caller asks for a forced refresh.
    // A present-but-empty array still counts as "fetched" — a station with
    // no DISCHARGE series over the last 24h should not re-fetch on every
    // drawer open.
    if (!force && measurementsByStation.value[stationId] !== undefined) return;

    measurementsLoadingByStation.value = {
      ...measurementsLoadingByStation.value,
      [stationId]: true,
    };
    measurementsErrorByStation.value = {
      ...measurementsErrorByStation.value,
      [stationId]: null,
    };

    const to = new Date();
    const from = new Date(to.getTime() - ONE_DAY_MS);
    const result = await api.getStationMeasurements(stationId, {
      parameter: 'DISCHARGE',
      from,
      to,
    });

    if (result.success) {
      measurementsByStation.value = {
        ...measurementsByStation.value,
        [stationId]: result.data.data.series,
      };
    } else {
      measurementsErrorByStation.value = {
        ...measurementsErrorByStation.value,
        [stationId]: result.error,
      };
    }

    measurementsLoadingByStation.value = {
      ...measurementsLoadingByStation.value,
      [stationId]: false,
    };
  }

  return {
    stations,
    loading,
    error,
    hasLoadedOnce,
    selectedStationId,
    selectedStation,
    measurementsByStation,
    measurementsLoadingByStation,
    measurementsErrorByStation,
    fetchStations,
    selectStation,
    clearSelection,
    fetchMeasurements,
  };
});
