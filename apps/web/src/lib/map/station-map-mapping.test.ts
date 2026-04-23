import type { StationDTO } from '@alpimonitor/shared';
import { describe, expect, it } from 'vitest';

import { findLatestDischarge, stationToMarkerOptions } from './station-map-mapping';

function station(overrides: Partial<StationDTO>): StationDTO {
  return {
    id: 's',
    ofevCode: 's',
    name: 's',
    riverName: 'Rhône',
    latitude: 46.2,
    longitude: 7.35,
    altitudeM: 500,
    flowType: 'NATURAL',
    operatorName: 'OFEV',
    dataSource: 'LIVE',
    latestMeasurements: [],
    activeAlertsCount: 0,
    ...overrides,
  };
}

describe('stationToMarkerOptions', () => {
  it('renders LIVE stations as filled primary circles', () => {
    const opts = stationToMarkerOptions(station({ dataSource: 'LIVE' }));
    expect(opts.color).toBe('#0F2847');
    expect(opts.fillColor).toBe('#0F2847');
    expect(opts.fillOpacity).toBe(0.9);
    expect(opts.radius).toBe(10);
    expect(opts.weight).toBe(2);
  });

  it('renders RESEARCH stations as hollow alpine-yellow circles', () => {
    const opts = stationToMarkerOptions(station({ dataSource: 'RESEARCH' }));
    expect(opts.color).toBe('#F4C542');
    expect(opts.fillOpacity).toBe(0);
    expect(opts.radius).toBe(10);
    expect(opts.weight).toBe(2);
  });

  it('treats SEED stations like RESEARCH (not public-live)', () => {
    const opts = stationToMarkerOptions(station({ dataSource: 'SEED' }));
    expect(opts.fillOpacity).toBe(0);
    expect(opts.color).toBe('#F4C542');
  });
});

describe('findLatestDischarge', () => {
  it('returns the DISCHARGE value when present', () => {
    const v = findLatestDischarge(
      station({
        latestMeasurements: [
          {
            parameter: 'WATER_LEVEL',
            unit: 'cm',
            value: 120,
            recordedAt: '2026-04-21T10:00:00Z',
            status: 'NORMAL',
          },
          {
            parameter: 'DISCHARGE',
            unit: 'm³/s',
            value: 42.5,
            recordedAt: '2026-04-21T10:00:00Z',
            status: 'NORMAL',
          },
        ],
      })
    );
    expect(v).toBe(42.5);
  });

  it('returns null when no DISCHARGE measurement exists', () => {
    const v = findLatestDischarge(
      station({
        latestMeasurements: [
          {
            parameter: 'WATER_LEVEL',
            unit: 'cm',
            value: 120,
            recordedAt: '2026-04-21T10:00:00Z',
            status: 'NORMAL',
          },
        ],
      })
    );
    expect(v).toBeNull();
  });

  it('returns null when latestMeasurements is empty', () => {
    const v = findLatestDischarge(station({ latestMeasurements: [] }));
    expect(v).toBeNull();
  });
});
