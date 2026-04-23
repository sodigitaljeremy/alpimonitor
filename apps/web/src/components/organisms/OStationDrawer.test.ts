import type { StationDTO, StationMeasurementsDTO } from '@alpimonitor/shared';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';

import fr from '@/locales/fr.json';
import { useStationsStore } from '@/stores/stations';

import OStationDrawer from './OStationDrawer.vue';

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr } });

function makeStation(overrides: Partial<StationDTO> = {}): StationDTO {
  return {
    id: 's1',
    ofevCode: '2011',
    name: 'Sion',
    riverName: 'Rhône',
    latitude: 46.2191,
    longitude: 7.3579,
    altitudeM: 483,
    flowType: 'NATURAL',
    operatorName: 'OFEV',
    dataSource: 'LIVE',
    sourcingStatus: 'CONFIRMED',
    latestMeasurements: [],
    activeAlertsCount: 0,
    ...overrides,
  };
}

function okJson<T>(body: T): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function measurementsDto(id: string): StationMeasurementsDTO {
  return {
    stationId: id,
    from: '2026-04-20T12:00:00.000Z',
    to: '2026-04-21T12:00:00.000Z',
    aggregate: 'raw',
    series: [
      {
        parameter: 'DISCHARGE',
        unit: 'm³/s',
        points: [{ t: '2026-04-21T11:00:00.000Z', v: 42 }],
      },
    ],
  };
}

function mountDrawer(): VueWrapper {
  return mount(OStationDrawer, {
    global: {
      plugins: [i18n],
      stubs: {
        Teleport: { template: '<div><slot /></div>' },
        Transition: false,
      },
    },
  });
}

async function setupOpenDrawer(
  stationOverrides: Partial<StationDTO> = {}
): Promise<{ wrapper: VueWrapper; store: ReturnType<typeof useStationsStore> }> {
  const store = useStationsStore();
  const st = makeStation(stationOverrides);

  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/stations')) return Promise.resolve(okJson({ data: [st] }));
    if (url.includes('/measurements')) {
      return Promise.resolve(okJson({ data: measurementsDto(st.id) }));
    }
    return Promise.reject(new Error(`unexpected url: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);

  await store.fetchStations();
  store.selectStation(st.id);

  const wrapper = mountDrawer();
  await nextTick();
  await nextTick();

  return { wrapper, store };
}

describe('OStationDrawer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.style.overflow = '';
  });

  it('renders nothing when no station is selected', () => {
    const wrapper = mountDrawer();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('opens when selectedStationId is set and shows the station name + ofev code', async () => {
    const { wrapper } = await setupOpenDrawer({ id: 's1', name: 'Sion', ofevCode: '2011' });
    expect(wrapper.text()).toContain('Sion');
    expect(wrapper.text()).toContain('2011');
  });

  it('clears the selection when the close button is clicked', async () => {
    const { wrapper, store } = await setupOpenDrawer();
    await wrapper.find('.o-station-drawer__close').trigger('click');
    expect(store.selectedStationId).toBeNull();
  });

  it('clears the selection when the overlay is clicked', async () => {
    const { wrapper, store } = await setupOpenDrawer();
    await wrapper.find('.o-station-drawer__overlay').trigger('click');
    expect(store.selectedStationId).toBeNull();
  });

  it('closes on Escape key', async () => {
    const { store } = await setupOpenDrawer();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(store.selectedStationId).toBeNull();
  });

  it('locks body scroll while open and restores it on close', async () => {
    const { store } = await setupOpenDrawer();
    expect(document.body.style.overflow).toBe('hidden');

    store.clearSelection();
    await nextTick();
    expect(document.body.style.overflow).toBe('');
  });

  it('hides the hydrodaten link for RESEARCH stations (TBD ofev codes)', async () => {
    const { wrapper } = await setupOpenDrawer({
      id: 's2',
      ofevCode: 'TBD-BRAMOIS',
      dataSource: 'RESEARCH',
    });
    expect(wrapper.find('.o-station-drawer__external-link').exists()).toBe(false);
  });
});
