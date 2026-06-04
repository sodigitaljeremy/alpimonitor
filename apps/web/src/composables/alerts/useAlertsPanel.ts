/**
 * Read-only facade over useAlertsStore for the network anomaly panel.
 *
 * Consumers (OAlertsPanel) import this composable, NOT useAlertsStore directly
 * — same boundary as useStationsList (ADR-010). Test files and Storybook
 * decorators legitimately reach the underlying store to seed states via $patch.
 */

import type { AlertDTO } from '@alpimonitor/shared';
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';

import type { ApiError } from '@/lib/api-client';
import { useAlertsStore } from '@/stores/alerts';

export interface UseAlertsPanel {
  openAlerts: Ref<AlertDTO[]>;
  recentClosedAlerts: Ref<AlertDTO[]>;
  activeAlertsCount: Ref<number>;
  hasOpenAlerts: Ref<boolean>;
  isLoading: Ref<boolean>;
  error: Ref<ApiError | null>;
  hasLoadedOnce: Ref<boolean>;
  loadAll: () => Promise<void>;
}

export function useAlertsPanel(): UseAlertsPanel {
  const store = useAlertsStore();
  const {
    openAlerts,
    recentClosedAlerts,
    activeAlertsCount,
    hasOpenAlerts,
    loading: isLoading,
    error,
    hasLoadedOnce,
  } = storeToRefs(store);

  return {
    openAlerts,
    recentClosedAlerts,
    activeAlertsCount,
    hasOpenAlerts,
    isLoading,
    error,
    hasLoadedOnce,
    loadAll: () => store.fetchAlerts(),
  };
}
