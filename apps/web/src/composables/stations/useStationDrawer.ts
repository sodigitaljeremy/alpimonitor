import type { MeasurementSeries, StationDTO } from '@alpimonitor/shared';
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useEscapeClose } from '@/composables/shared/useEscapeClose';
import { useScrollLock } from '@/composables/shared/useScrollLock';
import type { ApiError } from '@/lib/api-client';
import { ONE_DAY_MS } from '@/lib/constants/time';
import { stationToHydrodatenUrl } from '@/lib/hydrodaten';

import { useStationMeasurements } from './useStationMeasurements';
import { useStationNarrative, type UseStationNarrative } from './useStationNarrative';
import { useStationSelection } from './useStationSelection';

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
  /** AI narration (ADR-012, A5) — user-triggered, on the displayed series. */
  narrative: UseStationNarrative;
  /** True when there is a displayed series with data to narrate. */
  canNarrate: ComputedRef<boolean>;
  /** Generate the narrative for the currently displayed parameter + window. */
  generateNarrative: () => Promise<void>;
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
  const { t, locale } = useI18n();

  const { selectedStation, selectedStationId, clearSelection } = useStationSelection();
  const {
    series: allSeries,
    isLoading,
    error,
    load,
    reload,
  } = useStationMeasurements(selectedStationId);

  const isOpen = computed(() => selectedStationId.value !== null);
  const station = computed(() => selectedStation.value);

  // Snapshot `now` at selection time so the chart window stays stable
  // while the drawer is open. A future auto-refresh feature would
  // reassign `now` on a timer.
  const now: Ref<Date> = ref(new Date());
  const windowFrom = computed(() => new Date(now.value.getTime() - ONE_DAY_MS));
  const windowTo = computed(() => now.value);

  const narrative = useStationNarrative();

  watch(selectedStationId, (id) => {
    // Switching (or closing) clears any previous summary — a narrative is tied
    // to one station/window snapshot and must not bleed across selections.
    narrative.reset();
    if (id === null) return;
    now.value = new Date();
    void load();
  });

  const dischargeSeries = computed<MeasurementSeries | null>(() => {
    const series = allSeries.value;
    if (!series) return null;
    return series.find((s) => s.parameter === 'DISCHARGE') ?? null;
  });

  // The narratable series is the one currently displayed in the chart. Today
  // that is the discharge series; reading its `parameter` (rather than hard-
  // coding DISCHARGE) keeps this correct if a parameter switcher is added.
  const canNarrate = computed(
    () => (dischargeSeries.value?.points.length ?? 0) > 0 && station.value !== null
  );

  async function generateNarrative(): Promise<void> {
    const s = station.value;
    const series = dischargeSeries.value;
    if (!s || !series || series.points.length === 0) return;
    await narrative.generate({
      stationId: s.id,
      parameter: series.parameter,
      from: windowFrom.value,
      to: windowTo.value,
      language: locale.value,
    });
  }

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
    narrative,
    canNarrate,
    generateNarrative,
  };
}
