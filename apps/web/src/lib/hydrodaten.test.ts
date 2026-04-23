import type { StationDTO } from '@alpimonitor/shared';
import { describe, expect, it } from 'vitest';

import { RESEARCH_OFEV_PREFIX, stationToHydrodatenUrl } from './hydrodaten';

function station(ofevCode: string): StationDTO {
  return {
    id: ofevCode,
    ofevCode,
    name: ofevCode,
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

describe('stationToHydrodatenUrl', () => {
  it('builds the Hydrodaten URL when the station has a real OFEV code', () => {
    expect(stationToHydrodatenUrl(station('2174'))).toBe(
      'https://www.hydrodaten.admin.ch/fr/2174.html'
    );
  });

  it(`returns null for a research station (ofevCode prefixed with "${RESEARCH_OFEV_PREFIX}")`, () => {
    expect(stationToHydrodatenUrl(station('TBD-BRAMOIS'))).toBeNull();
  });

  it('returns null when the station is null (no selection)', () => {
    expect(stationToHydrodatenUrl(null)).toBeNull();
  });
});
