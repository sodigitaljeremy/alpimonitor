import type { StationDTO, StationMeasurementsDTO } from '@alpimonitor/shared';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStationsStore } from './stations';

const ok = <T>(body: T): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const httpError = (status: number, statusText: string): Response =>
  new Response('', { status, statusText });

function station(partial: Partial<StationDTO> & { id: string }): StationDTO {
  return {
    id: partial.id,
    ofevCode: partial.ofevCode ?? partial.id,
    name: partial.name ?? partial.id,
    riverName: partial.riverName ?? 'Rhône',
    latitude: partial.latitude ?? 46.2,
    longitude: partial.longitude ?? 7.35,
    altitudeM: partial.altitudeM ?? 500,
    flowType: partial.flowType ?? 'NATURAL',
    operatorName: partial.operatorName ?? 'OFEV',
    dataSource: partial.dataSource ?? 'LIVE',
    sourcingStatus: partial.sourcingStatus ?? 'CONFIRMED',
    latestMeasurements: partial.latestMeasurements ?? [],
    activeAlertsCount: partial.activeAlertsCount ?? 0,
  };
}

function measurementsDto(
  stationId: string,
  points: Array<{ t: string; v: number }>
): StationMeasurementsDTO {
  return {
    stationId,
    from: '2026-04-20T12:00:00.000Z',
    to: '2026-04-21T12:00:00.000Z',
    aggregate: 'raw',
    series: [{ parameter: 'DISCHARGE', unit: 'm³/s', points }],
  };
}

describe('useStationsStore', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('populates stations from a successful /stations response', async () => {
    const payload = [
      station({ id: 'a', name: 'Brig', dataSource: 'LIVE' }),
      station({ id: 'b', name: 'Borgne — Bramois', dataSource: 'RESEARCH' }),
    ];
    fetchMock.mockResolvedValueOnce(ok({ data: payload }));

    const store = useStationsStore();
    await store.fetchStations();

    expect(store.error).toBeNull();
    expect(store.hasLoadedOnce).toBe(true);
    expect(store.stations).toHaveLength(2);
    expect(store.stations.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('accepts an empty list as a valid loaded state', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [] }));

    const store = useStationsStore();
    await store.fetchStations();

    expect(store.error).toBeNull();
    expect(store.hasLoadedOnce).toBe(true);
    expect(store.stations).toEqual([]);
  });

  it('captures an http error on HTTP 500 and keeps hasLoadedOnce false', async () => {
    fetchMock.mockResolvedValueOnce(httpError(500, 'Internal Server Error'));

    const store = useStationsStore();
    await store.fetchStations();

    expect(store.error?.kind).toBe('http');
    if (store.error?.kind === 'http') {
      expect(store.error.status).toBe(500);
      expect(store.error.path).toBe('/stations');
    }
    expect(store.hasLoadedOnce).toBe(false);
    expect(store.stations).toEqual([]);
  });

  it('captures a network error with the underlying cause', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const store = useStationsStore();
    await store.fetchStations();

    expect(store.error?.kind).toBe('network');
    if (store.error?.kind === 'network') {
      expect(store.error.cause.message).toBe('Failed to fetch');
    }
    expect(store.hasLoadedOnce).toBe(false);
  });

  it('resets error on a subsequent successful fetch', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(ok({ data: [station({ id: 'a' })] }));

    const store = useStationsStore();
    await store.fetchStations();
    expect(store.error?.kind).toBe('network');

    await store.fetchStations();
    expect(store.error).toBeNull();
    expect(store.stations).toHaveLength(1);
  });

  describe('selection', () => {
    it('selectStation sets selectedStationId and selectedStation derives from items', async () => {
      fetchMock.mockResolvedValueOnce(
        ok({ data: [station({ id: 'a', name: 'Brig' }), station({ id: 'b', name: 'Sion' })] })
      );
      const store = useStationsStore();
      await store.fetchStations();

      store.selectStation('b');
      expect(store.selectedStationId).toBe('b');
      expect(store.selectedStation?.name).toBe('Sion');
    });

    it('selectedStation is null when id is unknown (e.g. race with an empty list)', () => {
      const store = useStationsStore();
      store.selectStation('ghost');
      expect(store.selectedStationId).toBe('ghost');
      expect(store.selectedStation).toBeNull();
    });

    it('clearSelection resets selectedStationId to null', () => {
      const store = useStationsStore();
      store.selectStation('a');
      store.clearSelection();
      expect(store.selectedStationId).toBeNull();
      expect(store.selectedStation).toBeNull();
    });
  });

  describe('fetchMeasurements', () => {
    it('populates the per-station cache on success', async () => {
      fetchMock.mockResolvedValueOnce(
        ok({ data: measurementsDto('s1', [{ t: '2026-04-21T11:00:00.000Z', v: 42 }]) })
      );

      const store = useStationsStore();
      await store.fetchMeasurements('s1');

      const series = store.measurementsByStation.s1;
      expect(series).toBeDefined();
      expect(series).toHaveLength(1);
      expect(series?.[0]?.parameter).toBe('DISCHARGE');
      expect(series?.[0]?.points).toEqual([{ t: '2026-04-21T11:00:00.000Z', v: 42 }]);
      expect(store.measurementsErrorByStation.s1).toBeNull();
      expect(store.measurementsLoadingByStation.s1).toBe(false);
    });

    it('skips the network on a cache hit unless force is true', async () => {
      fetchMock.mockResolvedValueOnce(
        ok({ data: measurementsDto('s1', [{ t: '2026-04-21T11:00:00.000Z', v: 10 }]) })
      );

      const store = useStationsStore();
      await store.fetchMeasurements('s1');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await store.fetchMeasurements('s1');
      expect(fetchMock).toHaveBeenCalledTimes(1); // cache hit, no second call

      fetchMock.mockResolvedValueOnce(
        ok({ data: measurementsDto('s1', [{ t: '2026-04-21T11:30:00.000Z', v: 11 }]) })
      );
      await store.fetchMeasurements('s1', { force: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(store.measurementsByStation.s1?.[0]?.points).toEqual([
        { t: '2026-04-21T11:30:00.000Z', v: 11 },
      ]);
    });

    it('caches an empty series as a valid fetched state (no re-fetch on next open)', async () => {
      fetchMock.mockResolvedValueOnce(ok({ data: measurementsDto('s1', []) }));

      const store = useStationsStore();
      await store.fetchMeasurements('s1');
      await store.fetchMeasurements('s1');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(store.measurementsByStation.s1?.[0]?.points).toEqual([]);
    });

    it('captures http errors per station without polluting the cache', async () => {
      fetchMock.mockResolvedValueOnce(httpError(500, 'Internal Server Error'));

      const store = useStationsStore();
      await store.fetchMeasurements('s1');

      const err = store.measurementsErrorByStation.s1;
      expect(err?.kind).toBe('http');
      if (err?.kind === 'http') {
        expect(err.status).toBe(500);
      }
      expect(store.measurementsByStation.s1).toBeUndefined();
      expect(store.measurementsLoadingByStation.s1).toBe(false);
    });

    it('queries the /measurements endpoint with parameter=DISCHARGE and a 24h window', async () => {
      fetchMock.mockResolvedValueOnce(ok({ data: measurementsDto('s1', []) }));

      const store = useStationsStore();
      await store.fetchMeasurements('s1');

      const call = fetchMock.mock.calls[0];
      expect(call).toBeDefined();
      const url = call![0] as string;
      expect(url).toContain('/stations/s1/measurements');
      expect(url).toContain('parameter=DISCHARGE');
      const urlObj = new URL(url, 'http://localhost');
      const from = new Date(urlObj.searchParams.get('from')!);
      const to = new Date(urlObj.searchParams.get('to')!);
      expect(to.getTime() - from.getTime()).toBeCloseTo(24 * 60 * 60 * 1000, -2);
    });
  });
});
