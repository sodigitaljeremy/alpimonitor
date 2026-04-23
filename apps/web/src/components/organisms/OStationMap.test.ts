import type { StationDTO } from '@alpimonitor/shared';
import { mount } from '@vue/test-utils';
import type { TileLayerOptions } from 'leaflet';
import { createPinia, setActivePinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * OStationMap imports `leaflet/dist/leaflet.css` for its side effect and
 * `import L from 'leaflet'` for the API. jsdom can load the CSS import
 * (esbuild treats it as an empty module), but the Leaflet runtime itself
 * needs a real document and leans on pieces jsdom does not ship (e.g.
 * actual tile loading, event pipelines that assume a layout engine).
 *
 * We mock the module to capture the delegation: every Leaflet call the
 * component makes becomes a vi.fn we can assert on. The goal of this
 * suite is to verify that OStationMap talks to Leaflet correctly, not to
 * verify Leaflet itself.
 */

type MarkerMock = {
  bindTooltip: ReturnType<typeof vi.fn>;
  bindPopup: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
};

const createdMarkers: MarkerMock[] = [];
const mapInstance = {
  invalidateSize: vi.fn(),
  remove: vi.fn(),
};
const layerGroupInstance = {
  addTo: vi.fn().mockReturnThis(),
  addLayer: vi.fn(),
  clearLayers: vi.fn(),
};
const tileLayerInstance = {
  addTo: vi.fn().mockReturnThis(),
};

const leafletMock = {
  map: vi.fn(() => mapInstance),
  // Typed params so `mock.calls[n]` resolves to a real tuple — the
  // OSM URL assertion below reads `mock.calls[0]?.[0]` and needs the
  // first arg position to be known.
  tileLayer: vi.fn((_url: string, _opts?: TileLayerOptions) => tileLayerInstance),
  layerGroup: vi.fn(() => layerGroupInstance),
  circleMarker: vi.fn((): MarkerMock => {
    const marker: MarkerMock = {
      bindTooltip: vi.fn().mockReturnThis(),
      bindPopup: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
    };
    createdMarkers.push(marker);
    return marker;
  }),
};

vi.mock('leaflet', () => ({
  default: leafletMock,
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));

/**
 * ResizeObserver is used by OStationMap to call map.invalidateSize
 * whenever the container resizes. Provide a minimal no-op so the
 * constructor does not throw in jsdom.
 */
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// Dynamic import after the vi.mock hoists — necessary in Vitest so the
// module-under-test picks up our Leaflet mock at import time.
const OStationMap = (await import('./OStationMap.vue')).default;
const { useStationsStore } = await import('@/stores/stations');

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      map: {
        title: 'Carte',
        attribution: '© OSM',
        popup: {
          researchNotice: 'Station de recherche.',
          discharge: '{value} m³/s',
        },
      },
    },
  },
});

function station(
  id: string,
  dataSource: StationDTO['dataSource'] = 'LIVE',
  latestDischarge: number | null = 12.4
): StationDTO {
  return {
    id,
    ofevCode: id,
    name: `Station ${id}`,
    riverName: 'Rhône',
    latitude: 46.2,
    longitude: 7.35,
    altitudeM: 500,
    flowType: 'NATURAL',
    operatorName: 'OFEV',
    dataSource,
    sourcingStatus: 'CONFIRMED',
    latestMeasurements:
      latestDischarge === null
        ? []
        : [
            {
              parameter: 'DISCHARGE',
              unit: 'm³/s',
              value: latestDischarge,
              recordedAt: '2026-04-21T11:00:00.000Z',
              status: 'NORMAL',
            },
          ],
    activeAlertsCount: 0,
  };
}

describe('OStationMap', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    createdMarkers.length = 0;
    vi.clearAllMocks();
    globalThis.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    // @ts-expect-error deliberate teardown
    delete globalThis.ResizeObserver;
  });

  it('creates a Leaflet map with OSM tiles and adds one circleMarker per station', () => {
    const stations = [station('a'), station('b'), station('c')];

    mount(OStationMap, {
      global: { plugins: [i18n] },
      props: { stations },
    });

    expect(leafletMock.map).toHaveBeenCalledTimes(1);
    expect(leafletMock.tileLayer).toHaveBeenCalledTimes(1);
    // OSM tile template — a regression that switched to swisstopo or any
    // other provider without discussion would fail this assertion.
    expect(leafletMock.tileLayer.mock.calls[0]?.[0]).toBe(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    );
    expect(leafletMock.circleMarker).toHaveBeenCalledTimes(3);
    expect(layerGroupInstance.addLayer).toHaveBeenCalledTimes(3);
  });

  it('wires a click handler on LIVE markers that calls selectStation(id); RESEARCH markers get a popup instead', () => {
    const stations = [
      station('live-1', 'LIVE'),
      station('research-1', 'RESEARCH'),
      station('live-2', 'LIVE'),
    ];

    mount(OStationMap, {
      global: { plugins: [i18n] },
      props: { stations },
    });

    expect(createdMarkers).toHaveLength(3);

    const [liveMarker1, researchMarker, liveMarker2] = createdMarkers;

    // LIVE markers: tooltip + click binding, no popup.
    expect(liveMarker1!.bindTooltip).toHaveBeenCalledTimes(1);
    expect(liveMarker1!.bindPopup).not.toHaveBeenCalled();
    expect(liveMarker1!.on).toHaveBeenCalledWith('click', expect.any(Function));
    expect(liveMarker2!.bindTooltip).toHaveBeenCalledTimes(1);

    // RESEARCH marker: popup, no tooltip/click.
    expect(researchMarker!.bindPopup).toHaveBeenCalledTimes(1);
    expect(researchMarker!.bindTooltip).not.toHaveBeenCalled();
    expect(researchMarker!.on).not.toHaveBeenCalled();

    // Trigger the first LIVE marker's click handler and assert that the
    // selection facade — the store method underneath — saw the right id.
    const store = useStationsStore();
    const clickCall = liveMarker1!.on.mock.calls.find(([event]) => event === 'click');
    expect(clickCall).toBeDefined();
    const clickHandler = clickCall![1] as () => void;
    clickHandler();
    expect(store.selectedStationId).toBe('live-1');
  });

  it('calls map.remove() and stops observing the container when the component unmounts', () => {
    const disconnectSpy = vi.fn();
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {
        disconnectSpy();
      }
    } as unknown as typeof ResizeObserver;

    const wrapper = mount(OStationMap, {
      global: { plugins: [i18n] },
      props: { stations: [station('a')] },
    });

    wrapper.unmount();

    expect(mapInstance.remove).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('re-renders markers when the stations prop changes (clears layer, adds new markers)', async () => {
    const initial = [station('a'), station('b'), station('c')];
    const next = [station('a'), station('b'), station('c'), station('d'), station('e')];

    const wrapper = mount(OStationMap, {
      global: { plugins: [i18n] },
      props: { stations: initial },
    });

    expect(leafletMock.circleMarker).toHaveBeenCalledTimes(3);
    expect(layerGroupInstance.clearLayers).toHaveBeenCalledTimes(1); // from the initial renderMarkers

    await wrapper.setProps({ stations: next });

    // clearLayers called a second time, and 5 new markers created.
    expect(layerGroupInstance.clearLayers).toHaveBeenCalledTimes(2);
    expect(leafletMock.circleMarker).toHaveBeenCalledTimes(3 + 5);
  });
});
