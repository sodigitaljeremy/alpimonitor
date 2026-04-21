import type { StationDTO } from '@alpimonitor/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

type StationsListResponse = { data: StationDTO[] };

export const useStationsStore = defineStore('stations', () => {
  const items = ref<StationDTO[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  // Distinguishes "fetch never returned yet" (show placeholder) from
  // "fetch returned, list is legitimately empty" (show empty-state).
  const hasLoadedOnce = ref(false);

  const stations = computed<StationDTO[]>(() => items.value);

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

  return {
    stations,
    loading,
    error,
    hasLoadedOnce,
    fetchStations,
  };
});
