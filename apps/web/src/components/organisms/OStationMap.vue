<script setup lang="ts">
import type { StationDTO } from '@alpimonitor/shared';
import L from 'leaflet';
import { onMounted, onScopeDispose, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useStationsStore } from '@/stores/stations';

import { findLatestDischarge, stationToMarkerOptions } from '@/lib/map/station-map-mapping';

import 'leaflet/dist/leaflet.css';

const props = defineProps<{ stations: StationDTO[] }>();

const { t } = useI18n();
const stationsStore = useStationsStore();

// Rhône valaisan: centered between Brig and Porte du Scex, zoom 10 keeps
// both the main Rhône corridor and the Val d'Hérens markers in view.
const MAP_CENTER: L.LatLngTuple = [46.22, 7.4];
const MAP_ZOOM = 10;

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let markersLayer: L.LayerGroup | null = null;
let resizeObserver: ResizeObserver | null = null;

function buildResearchPopupHtml(station: StationDTO): string {
  const lines: string[] = [
    `<strong>${station.name}</strong>`,
    `<span>${station.riverName}</span>`,
    t('map.popup.researchNotice'),
  ];
  return lines.map((line) => `<p class="o-station-map__popup-line">${line}</p>`).join('');
}

function renderMarkers(stations: StationDTO[]): void {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();
  for (const station of stations) {
    const marker = L.circleMarker(
      [station.latitude, station.longitude],
      stationToMarkerOptions(station)
    );
    if (station.dataSource === 'LIVE') {
      // LIVE markers open the drawer directly — a popup would be a
      // dead-end preview of data the drawer's chart already shows in
      // full. A lightweight tooltip (hover on desktop, ignored on
      // mobile) keeps the station name visible without that detour.
      const discharge = findLatestDischarge(station);
      const tooltip =
        discharge !== null
          ? `${station.name} — ${t('map.popup.discharge', { value: discharge.toFixed(2) })}`
          : station.name;
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -8] });
      marker.on('click', () => {
        stationsStore.selectStation(station.id);
      });
    } else {
      marker.bindPopup(buildResearchPopupHtml(station));
    }
    markersLayer.addLayer(marker);
  }
}

onMounted(() => {
  if (!mapEl.value) return;
  map = L.map(mapEl.value, {
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    scrollWheelZoom: true,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: t('map.attribution'),
    maxZoom: 18,
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);

  renderMarkers(props.stations);

  // Containers that change size after mount (tab switches, responsive
  // layouts, accordion open) leave Leaflet with a stale tile grid — the
  // classic "half-grey map". invalidateSize on every observed resize
  // forces it to recompute.
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      map?.invalidateSize();
    });
    resizeObserver.observe(mapEl.value);
  }
  // One-shot in case the container was laid out before Leaflet mounted.
  map.invalidateSize();
});

watch(
  () => props.stations,
  (next) => {
    renderMarkers(next);
  }
);

onScopeDispose(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  map?.remove();
  map = null;
  markersLayer = null;
});
</script>

<template>
  <div ref="mapEl" class="o-station-map" role="application" :aria-label="t('map.title')" />
</template>

<style scoped>
.o-station-map {
  @apply h-full w-full;
}

/* Leaflet injects popups into a portal outside this component's scoped
   boundary, so we style the popup body via a :deep() selector on the
   global .leaflet-popup-content class. Scoped to our container so no
   other Leaflet instance on the page is affected. */
.o-station-map :deep(.leaflet-popup-content) {
  @apply font-sans text-sm text-graphite;
  margin: 10px 14px;
}

.o-station-map :deep(.o-station-map__popup-line) {
  @apply leading-snug;
}

.o-station-map :deep(.o-station-map__popup-line:first-child) {
  @apply font-semibold text-primary;
}
</style>
