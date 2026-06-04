<script setup lang="ts">
import type { StationDTO } from '@alpimonitor/shared';
import L from 'leaflet';
import { onMounted, onScopeDispose, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useStationSelection } from '@/composables/stations';
import { MAP_CENTER, MAP_ZOOM, MAX_ZOOM } from '@/lib/constants/map';
import { findLatestDischarge, stationToMarkerOptions } from '@/lib/map/station-map-mapping';

import 'leaflet/dist/leaflet.css';

const props = defineProps<{ stations: StationDTO[] }>();

// Anomaly halo colour, resolved at marker-creation time because Leaflet draws
// circle markers on SVG (no CSS classes for fill/stroke). Amber-600, kept in
// sync with the OAlertsPanel "count" accent and tailwind defaults.
const ALERT = '#D97706';

const { t } = useI18n();
const { selectStation } = useStationSelection();

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
      // A station with an open statistical anomaly gets a pulsing halo behind
      // its marker (added first so it renders underneath). It is non-interactive
      // so clicks still hit the marker and open the drawer.
      const hasAnomaly = station.activeAlertsCount > 0;
      if (hasAnomaly) {
        const halo = L.circleMarker([station.latitude, station.longitude], {
          radius: 16,
          weight: 2,
          color: ALERT,
          fillColor: ALERT,
          fillOpacity: 0.15,
          className: 'o-station-map__alert-halo',
          interactive: false,
        });
        markersLayer.addLayer(halo);
      }

      // LIVE markers open the drawer directly — a popup would be a
      // dead-end preview of data the drawer's chart already shows in
      // full. A lightweight tooltip (hover on desktop, ignored on
      // mobile) keeps the station name visible without that detour.
      const discharge = findLatestDischarge(station);
      const baseTooltip =
        discharge !== null
          ? `${station.name} — ${t('map.popup.discharge', { value: discharge.toFixed(2) })}`
          : station.name;
      // Honest framing: the signal is a deseasonalised z-score, not a
      // calibrated hydrological alert. Spelled out in the tooltip itself.
      const tooltip = hasAnomaly ? `${baseTooltip} · ${t('map.popup.anomalyNotice')}` : baseTooltip;
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -8] });
      marker.on('click', () => {
        selectStation(station.id);
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
    maxZoom: MAX_ZOOM,
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

/* Anomaly halo: a slow opacity pulse behind a flagged LIVE marker. Leaflet
   renders the circleMarker as an SVG <path> carrying our className, so we
   animate it via :deep(). Motion is opt-out for reduced-motion users. */
.o-station-map :deep(.o-station-map__alert-halo) {
  animation: o-station-map-pulse 2.4s ease-in-out infinite;
}

@keyframes o-station-map-pulse {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.7;
  }
}

@media (prefers-reduced-motion: reduce) {
  .o-station-map :deep(.o-station-map__alert-halo) {
    animation: none;
    opacity: 0.45;
  }
}
</style>
