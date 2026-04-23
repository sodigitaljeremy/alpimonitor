import type { MeasurementSeries, StationDTO } from '@alpimonitor/shared';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';

import { useStationsStore } from '@/stores/stations';

import { useStationDrawer, type UseStationDrawer } from './useStationDrawer';

function station(id: string, name = id, ofevCode = id): StationDTO {
  return {
    id,
    ofevCode,
    name,
    riverName: 'Rhône',
    latitude: 46.2,
    longitude: 7.35,
    altitudeM: 500,
    flowType: 'NATURAL',
    operatorName: 'OFEV',
    dataSource: 'LIVE',
    sourcingStatus: 'CONFIRMED',
    latestMeasurements: [],
    activeAlertsCount: 0,
  };
}

function discharge(points: Array<{ t: string; v: number }>): MeasurementSeries {
  return { parameter: 'DISCHARGE', unit: 'm³/s', points };
}

/**
 * useStationDrawer calls useI18n() — we need a Vue app context with
 * the i18n plugin installed. Mount a tiny probe component that invokes
 * the composable in its setup and exposes the return value to tests.
 */
function mountDrawer(): { drawer: UseStationDrawer; unmount: () => void } {
  let captured: UseStationDrawer | undefined;

  const i18n = createI18n({
    legacy: false,
    locale: 'fr',
    messages: {
      fr: {
        drawer: {
          coords: '{lat}, {lng}',
        },
      },
    },
  });

  const Probe = defineComponent({
    setup() {
      captured = useStationDrawer();
      return () => h('div');
    },
  });

  const wrapper = mount(Probe, { global: { plugins: [i18n] } });
  if (!captured) throw new Error('useStationDrawer did not return a value');
  return { drawer: captured, unmount: () => wrapper.unmount() };
}

describe('useStationDrawer', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('happy path: exposes station + dischargeSeries once the store is seeded', async () => {
    const store = useStationsStore();
    const s = station('a', 'Brig', '2174');
    const seriesA = discharge([{ t: '2026-04-21T11:00:00.000Z', v: 42 }]);
    store.$patch({
      stations: [s],
      measurementsByStation: { a: [seriesA] },
      selectedStationId: 'a',
    });

    const { drawer, unmount } = mountDrawer();
    await nextTick();

    expect(drawer.isOpen.value).toBe(true);
    expect(drawer.station.value?.name).toBe('Brig');
    expect(drawer.dischargeSeries.value).toEqual(seriesA);
    expect(drawer.hydrodatenUrl.value).toBe('https://www.hydrodaten.admin.ch/fr/2174.html');
    expect(drawer.coordsLabel.value).toContain('46.2000');

    unmount();
  });

  it('isOpen reflects the current selection and close() clears it', async () => {
    const store = useStationsStore();
    store.$patch({ stations: [station('a')] });

    const { drawer, unmount } = mountDrawer();
    await nextTick();

    expect(drawer.isOpen.value).toBe(false);

    store.selectStation('a');
    await nextTick();
    expect(drawer.isOpen.value).toBe(true);

    drawer.close();
    await nextTick();
    expect(drawer.isOpen.value).toBe(false);
    expect(store.selectedStationId).toBeNull();

    unmount();
  });

  it('triggers fetchMeasurements when selectedStationId changes', async () => {
    const store = useStationsStore();
    const spy = vi.spyOn(store, 'fetchMeasurements').mockResolvedValue();
    store.$patch({ stations: [station('a'), station('b')] });

    const { unmount } = mountDrawer();
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(0);

    store.selectStation('a');
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith('a');

    store.selectStation('b');
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith('b');

    unmount();
  });

  it('retry() delegates to fetchMeasurements with force: true for the current selection', async () => {
    const store = useStationsStore();
    const spy = vi.spyOn(store, 'fetchMeasurements').mockResolvedValue();
    store.$patch({ stations: [station('a')], selectedStationId: 'a' });

    const { drawer, unmount } = mountDrawer();
    await nextTick();

    spy.mockClear();
    drawer.retry();
    await nextTick();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith('a', { force: true });

    unmount();
  });

  it('hydrodatenUrl is null for a research station (TBD-prefixed ofevCode)', async () => {
    const store = useStationsStore();
    store.$patch({
      stations: [station('r1', 'Borgne — Bramois', 'TBD-BRAMOIS')],
      selectedStationId: 'r1',
    });

    const { drawer, unmount } = mountDrawer();
    await nextTick();

    expect(drawer.hydrodatenUrl.value).toBeNull();

    unmount();
  });
});
