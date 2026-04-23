import type { StationDTO } from '@alpimonitor/shared';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useStationsStore } from '@/stores/stations';

import { useStationSelection } from './useStationSelection';

function station(id: string, name = id): StationDTO {
  return {
    id,
    ofevCode: id,
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

describe('useStationSelection', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('selectStation sets selectedStationId and selectedStation derives from the seeded list', () => {
    const store = useStationsStore();
    store.$patch({
      stations: [station('a', 'Brig'), station('b', 'Sion')],
    });

    const selection = useStationSelection();
    selection.selectStation('b');

    expect(selection.selectedStationId.value).toBe('b');
    expect(selection.selectedStation.value?.name).toBe('Sion');
  });

  it('clearSelection resets selectedStationId and selectedStation to null', () => {
    const store = useStationsStore();
    store.$patch({ stations: [station('a')] });

    const selection = useStationSelection();
    selection.selectStation('a');
    expect(selection.selectedStationId.value).toBe('a');

    selection.clearSelection();
    expect(selection.selectedStationId.value).toBeNull();
    expect(selection.selectedStation.value).toBeNull();
  });

  it('selectedStation is null when the id does not match any item (race or typo)', () => {
    const selection = useStationSelection();
    selection.selectStation('ghost');

    expect(selection.selectedStationId.value).toBe('ghost');
    expect(selection.selectedStation.value).toBeNull();
  });
});
