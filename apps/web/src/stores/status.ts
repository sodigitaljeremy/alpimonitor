import { useNow } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export type IngestionLastRun = {
  source: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  stationsSeenCount: number;
  measurementsCreatedCount: number;
  durationMs: number | null;
};

export type IngestionToday = {
  runsCount: number;
  measurementsCreatedSum: number;
  successRate: number | null;
};

type StatusResponse = {
  api: { status: 'ok'; uptimeSeconds: number };
  database: { status: 'ok' | 'error' };
  ingestion: {
    lastRun: IngestionLastRun | null;
    lastSuccessAt: string | null;
    healthyThresholdMinutes: number;
    today: IngestionToday;
  };
};

export const useStatusStore = defineStore('status', () => {
  // useNow ticks every 60s by default — this is what keeps
  // `minutesSinceLastSuccess` alive between two fetches. Without a
  // reactive clock, the badge would freeze its "X min" label until the
  // next poll landed.
  const now = useNow({ interval: 60_000 });

  const lastRun = ref<IngestionLastRun | null>(null);
  const lastSuccessAt = ref<Date | null>(null);
  const healthyThresholdMinutes = ref<number>(30);
  const today = ref<IngestionToday>({
    runsCount: 0,
    measurementsCreatedSum: 0,
    successRate: null,
  });
  const loading = ref(false);
  const error = ref<Error | null>(null);
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
    try {
      const response = await fetch(`${API_BASE_URL}/status`);
      if (!response.ok) {
        throw new Error(`API ${response.status} ${response.statusText} on /status`);
      }
      const body = (await response.json()) as StatusResponse;
      lastRun.value = body.ingestion.lastRun;
      lastSuccessAt.value = body.ingestion.lastSuccessAt
        ? new Date(body.ingestion.lastSuccessAt)
        : null;
      healthyThresholdMinutes.value = body.ingestion.healthyThresholdMinutes;
      today.value = body.ingestion.today;
      hasLoadedOnce.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      loading.value = false;
    }
  }

  return {
    lastRun,
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
