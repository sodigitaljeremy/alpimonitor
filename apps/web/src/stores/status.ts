import { useNow } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { api, type ApiError } from '@/lib/api-client';

export type { IngestionLastRun, IngestionToday } from '@/lib/api-client';

export const useStatusStore = defineStore('status', () => {
  // useNow ticks every 60s by default — this is what keeps
  // `minutesSinceLastSuccess` alive between two fetches. Without a
  // reactive clock, the badge would freeze its "X min" label until the
  // next poll landed.
  const now = useNow({ interval: 60_000 });

  const lastSuccessAt = ref<Date | null>(null);
  const healthyThresholdMinutes = ref<number>(30);
  const today = ref({
    runsCount: 0,
    measurementsCreatedSum: 0,
    successRate: null as number | null,
  });
  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  // Distinguishes "fetch never completed yet" from "fetched, but lastSuccessAt
  // is legitimately null" (DB reset, no SUCCESS run ever). The badge needs
  // both signals to show a 'loading' state without flashing 'offline'.
  const hasLoadedOnce = ref(false);

  const minutesSinceLastSuccess = computed<number | null>(() => {
    if (lastSuccessAt.value === null) return null;
    const diffMs = now.value.getTime() - lastSuccessAt.value.getTime();
    return Math.max(0, Math.floor(diffMs / 60_000));
  });

  const isHealthy = computed<boolean>(() => {
    if (lastSuccessAt.value === null) return false;
    const diffMs = now.value.getTime() - lastSuccessAt.value.getTime();
    return diffMs < healthyThresholdMinutes.value * 60_000;
  });

  async function fetchStatus(): Promise<void> {
    loading.value = true;
    error.value = null;
    const result = await api.getStatus();
    if (result.success) {
      const body = result.data;
      lastSuccessAt.value = body.ingestion.lastSuccessAt
        ? new Date(body.ingestion.lastSuccessAt)
        : null;
      healthyThresholdMinutes.value = body.ingestion.healthyThresholdMinutes;
      today.value = body.ingestion.today;
      hasLoadedOnce.value = true;
    } else {
      error.value = result.error;
    }
    loading.value = false;
  }

  return {
    lastSuccessAt,
    healthyThresholdMinutes,
    today,
    loading,
    error,
    hasLoadedOnce,
    minutesSinceLastSuccess,
    isHealthy,
    fetchStatus,
  };
});
