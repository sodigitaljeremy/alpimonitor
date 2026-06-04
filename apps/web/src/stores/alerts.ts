import type { AlertDTO } from '@alpimonitor/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { api, type ApiError } from '@/lib/api-client';

// AI layer — extension B4 (ADR-012). Global statistical-anomaly state for the
// network alerts panel (OAlertsPanel) and the map marker signalling. Mirrors
// useAiStatusStore: a light store with a single fetch + a `hasLoadedOnce` gate
// so the panel can tell "not fetched yet" from "fetched, network nominal".
//
// Two reads per refresh: the OPEN episodes (the panel's primary concern, and
// the source of `activeAlertsCount`) and a bounded slice of the most recent
// CLOSED episodes (a short history strip). The history is secondary — if only
// that call fails we keep the open list and surface no error.

// Recent closed episodes shown in the history strip. The API orders by openedAt
// desc, so this is "the last N episodes that have ended".
const RECENT_CLOSED_LIMIT = 8;

export const useAlertsStore = defineStore('alerts', () => {
  const openAlerts = ref<AlertDTO[]>([]);
  const recentClosedAlerts = ref<AlertDTO[]>([]);

  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  const hasLoadedOnce = ref(false);

  // Drives the map marker signal and the panel header counter.
  const activeAlertsCount = computed(() => openAlerts.value.length);
  const hasOpenAlerts = computed(() => openAlerts.value.length > 0);

  async function fetchAlerts(): Promise<void> {
    loading.value = true;
    const [openResult, closedResult] = await Promise.all([
      api.getAlerts({ status: 'open' }),
      api.getAlerts({ status: 'closed', limit: RECENT_CLOSED_LIMIT }),
    ]);

    // The open list is the load-bearing read: a failure here is the panel's
    // error. We keep any previously-loaded list rather than blanking it.
    if (openResult.success) {
      openAlerts.value = openResult.data.data;
      error.value = null;
    } else {
      error.value = openResult.error;
    }

    // History is best-effort; a failure leaves the prior strip untouched and
    // never raises the panel-level error.
    if (closedResult.success) {
      recentClosedAlerts.value = closedResult.data.data;
    }

    loading.value = false;
    hasLoadedOnce.value = true;
  }

  return {
    openAlerts,
    recentClosedAlerts,
    loading,
    error,
    hasLoadedOnce,
    activeAlertsCount,
    hasOpenAlerts,
    fetchAlerts,
  };
});
