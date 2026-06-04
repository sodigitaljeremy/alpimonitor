import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { api, type ApiError } from '@/lib/api-client';

// AI layer — extension D (ADR-012). Global LLM observability state, consumed by
// the AI health badge next to the ingestion badge. Mirrors useStatusStore.

// Above this share of failed calls today, the AI layer is considered degraded.
const DEGRADED_ERROR_RATE = 0.5;

export const useAiStatusStore = defineStore('aiStatus', () => {
  const callsToday = ref(0);
  const errorRate = ref<number | null>(null);
  const costUsdToday = ref(0);
  const avgLatencyMs = ref<number | null>(null);
  const lastCallAt = ref<string | null>(null);

  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  const hasLoadedOnce = ref(false);

  // Operational unless a transport error or a high failure rate.
  const isDegraded = computed(() => (errorRate.value ?? 0) >= DEGRADED_ERROR_RATE);

  async function fetchAiStatus(): Promise<void> {
    loading.value = true;
    const result = await api.getAiStatus();
    if (result.success) {
      const { ai } = result.data;
      callsToday.value = ai.callsToday;
      errorRate.value = ai.errorRate;
      costUsdToday.value = ai.costUsdToday;
      avgLatencyMs.value = ai.avgLatencyMs;
      lastCallAt.value = ai.lastCallAt;
      error.value = null;
    } else {
      error.value = result.error;
    }
    loading.value = false;
    hasLoadedOnce.value = true;
  }

  return {
    callsToday,
    errorRate,
    costUsdToday,
    avgLatencyMs,
    lastCallAt,
    loading,
    error,
    hasLoadedOnce,
    isDegraded,
    fetchAiStatus,
  };
});
