import type { StationDTO } from '@alpimonitor/shared';
import type { CircleMarkerOptions } from 'leaflet';

// Tailwind tokens duplicated here because Leaflet draws circle markers
// on SVG/canvas — the fill/stroke must be resolved to concrete colour
// strings at marker creation time, not via CSS classes. Keep in sync
// with tailwind.config.ts (primary.DEFAULT, alpine.DEFAULT).
const PRIMARY = '#0F2847';
const ALPINE = '#F4C542';

export function stationToMarkerOptions(station: StationDTO): CircleMarkerOptions {
  if (station.dataSource === 'LIVE') {
    return {
      radius: 10,
      weight: 2,
      color: PRIMARY,
      fillColor: PRIMARY,
      fillOpacity: 0.9,
    };
  }
  // RESEARCH / SEED: hollow alpine-yellow marker to read as "not live".
  return {
    radius: 10,
    weight: 2,
    color: ALPINE,
    fillColor: ALPINE,
    fillOpacity: 0,
  };
}

export function findLatestDischarge(station: StationDTO): number | null {
  const m = station.latestMeasurements.find((lm) => lm.parameter === 'DISCHARGE');
  return m ? m.value : null;
}
