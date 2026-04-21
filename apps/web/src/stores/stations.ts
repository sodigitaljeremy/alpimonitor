import type { MeasurementSeries, StationDTO, StationMeasurementsDTO } from '@alpimonitor/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type StationsListResponse = { data: StationDTO[] };
type StationMeasurementsResponse = { data: StationMeasurementsDTO };

export interface FetchMeasurementsOptions {
  force?: boolean;
}

export const useStationsStore = defineStore('stations', () => {
  const items = ref<StationDTO[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  // Distinguishes "fetch never returned yet" (show placeholder) from
  // "fetch returned, list is legitimately empty" (show empty-state).
  const hasLoadedOnce = ref(false);

  // Per-station measurement cache. Kept as plain records (not Maps) so
  // Vue's reactivity tracks replacement without custom deep tracking —
  // we always reassign with a new object literal.
  const measurementsByStation = ref<Record<string, MeasurementSeries[]>>({});
  const measurementsLoadingByStation = ref<Record<string, boolean>>({});
  const measurementsErrorByStation = ref<Record<string, Error | null>>({});

  const selectedStationId = ref<string | null>(null);

  const stations = computed<StationDTO[]>(() => items.value);

  const selectedStation = computed<StationDTO | null>(() => {
    const id = selectedStationId.value;
    if (id === null) return null;
    return items.value.find((s) => s.id === id) ?? null;
  });

  async function fetchStations(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch(`${API_BASE_URL}/stations`);
      if (!response.ok) {
        throw new Error(`API ${response.status} ${response.statusText} on /stations`);
      }
      const body = (await response.json()) as StationsListResponse;
      items.value = body.data;
      hasLoadedOnce.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      loading.value = false;
    }
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

    try {
      const to = new Date();
      const from = new Date(to.getTime() - ONE_DAY_MS);
      const params = new URLSearchParams({
        parameter: 'DISCHARGE',
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const url = `${API_BASE_URL}/stations/${stationId}/measurements?${params}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `API ${response.status} ${response.statusText} on /stations/${stationId}/measurements`
        );
      }
      const body = (await response.json()) as StationMeasurementsResponse;
      measurementsByStation.value = {
        ...measurementsByStation.value,
        [stationId]: body.data.series,
      };
    } catch (err) {
      measurementsErrorByStation.value = {
        ...measurementsErrorByStation.value,
        [stationId]: err instanceof Error ? err : new Error(String(err)),
      };
    } finally {
      measurementsLoadingByStation.value = {
        ...measurementsLoadingByStation.value,
        [stationId]: false,
      };
    }
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
