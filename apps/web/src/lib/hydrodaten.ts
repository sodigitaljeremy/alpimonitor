import type { StationDTO } from '@alpimonitor/shared';

/**
 * Seed convention for research stations without an official OFEV code.
 * Station IDs in the dev/demo seed start with this prefix (e.g.
 * `TBD-BRAMOIS`) specifically so the UI can tell them apart from real
 * federal BAFU station codes (`2174`, `2308`, …) and suppress links that
 * would point to a Hydrodaten page that does not exist. See ADR-008 for
 * the CONFIRMED / ILLUSTRATIVE distinction this prefix supports.
 */
export const RESEARCH_OFEV_PREFIX = 'TBD';

/**
 * Resolve the public Hydrodaten BAFU page URL for a station, or `null`
 * when no such page exists (no station selected, or a research station
 * without an official OFEV code).
 *
 * Pure function: safe to import anywhere (components, composables,
 * tests, Storybook) without carrying Pinia or Vue reactivity context.
 */
export function stationToHydrodatenUrl(station: StationDTO | null): string | null {
  if (station === null) return null;
  if (station.ofevCode.startsWith(RESEARCH_OFEV_PREFIX)) return null;
  return `https://www.hydrodaten.admin.ch/fr/${station.ofevCode}.html`;
}
