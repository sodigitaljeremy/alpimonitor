import type { MeasurementSeries, StationDTO } from '@alpimonitor/shared';
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useEscapeClose } from '@/composables/shared/useEscapeClose';
import { useScrollLock } from '@/composables/shared/useScrollLock';
import type { ApiError } from '@/lib/api-client';
import { stationToHydrodatenUrl } from '@/lib/hydrodaten';

import { useStationMeasurements } from './useStationMeasurements';
import { useStationSelection } from './useStationSelection';

const CHART_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface UseStationDrawer {
  isOpen: ComputedRef<boolean>;
  station: ComputedRef<StationDTO | null>;
  dischargeSeries: ComputedRef<MeasurementSeries | null>;
  isLoading: ComputedRef<boolean>;
  error: ComputedRef<ApiError | null>;
  /** 24 h ago snapshotted at the moment the current station was selected. */
  windowFrom: ComputedRef<Date>;
  /** Same snapshot, held stable while the drawer is open. */
  windowTo: ComputedRef<Date>;
  close: () => void;
  retry: () => void;
  coordsLabel: ComputedRef<string>;
  hydrodatenUrl: ComputedRef<string | null>;
}

/**
 * Orchestrator for the OStationDrawer organism. Composes the selection
 * and per-station measurements facades, owns the chart window timestamp,
 * wires Escape-to-close and body scroll lock, and exposes the i18n- and
 * business-aware derivations (coordsLabel, hydrodatenUrl) the template
 * needs.
 *
 * Consumers (just OStationDrawer.vue today) should import this composable
 * rather than talking to useStationsStore, useStationSelection, or
 * useStationMeasurements directly — the drawer's contract with the
 * application lives here.
 */
export function useStationDrawer(): UseStationDrawer {
  const { t } = useI18n();

  const { selectedStation, selectedStationId, clearSelection } = useStationSelection();
  const {
    series: allSeries,
    isLoading,
    error,
    load,
    reload,
  } = useStationMeasurements(selectedStationId);

  const isOpen = computed(() => selectedStationId.value !== null);

  // Snapshot `now` at selection time so the chart window stays stable
  // while the drawer is open. A future auto-refresh feature would
  // reassign `now` on a timer.
  const now: Ref<Date> = ref(new Date());
  const windowFrom = computed(() => new Date(now.value.getTime() - CHART_WINDOW_MS));
  const windowTo = computed(() => now.value);

  watch(selectedStationId, (id) => {
    if (id === null) return;
    now.value = new Date();
    void load();
  });

  const dischargeSeries = computed<MeasurementSeries | null>(() => {
    const series = allSeries.value;
    if (!series) return null;
    return series.find((s) => s.parameter === 'DISCHARGE') ?? null;
  });

  function close(): void {
    clearSelection();
  }

  function retry(): void {
    void reload();
  }

  const coordsLabel = computed(() => {
    const station = selectedStation.value;
    if (!station) return '';
    return t('drawer.coords', {
      lat: station.latitude.toFixed(4),
      lng: station.longitude.toFixed(4),
    });
  });

  const hydrodatenUrl = computed(() => stationToHydrodatenUrl(selectedStation.value));

  const station = computed(() => selectedStation.value);

  useEscapeClose(isOpen, close);
  useScrollLock(isOpen);

  return {
    isOpen,
    station,
    dischargeSeries,
    isLoading,
    error,
    windowFrom,
    windowTo,
    close,
    retry,
    coordsLabel,
    hydrodatenUrl,
  };
}
