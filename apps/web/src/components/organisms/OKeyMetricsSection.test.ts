import type { StationDTO } from '@alpimonitor/shared';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';

import fr from '@/locales/fr.json';
import { useStationsStore } from '@/stores/stations';
import { useStatusStore } from '@/stores/status';

import OKeyMetricsSection from './OKeyMetricsSection.vue';

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr } });

function makeStation(partial: Partial<StationDTO> & { id: string }): StationDTO {
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
    latestMeasurements: partial.latestMeasurements ?? [],
    activeAlertsCount: partial.activeAlertsCount ?? 0,
  };
}

function mountSection(): VueWrapper {
  return mount(OKeyMetricsSection, {
    global: { plugins: [i18n] },
  });
}

function cardValues(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.a-numeric-value__value').map((w) => w.text());
}

function statusBody(opts: {
  lastSuccessAt?: string | null;
  measurementsCreatedSum?: number;
}): unknown {
  return {
    api: { status: 'ok', uptimeSeconds: 3600 },
    database: { status: 'ok' },
    ingestion: {
      lastRun: null,
      lastSuccessAt: opts.lastSuccessAt ?? null,
      healthyThresholdMinutes: 30,
      today: {
        runsCount: 1,
        measurementsCreatedSum: opts.measurementsCreatedSum ?? 0,
        successRate: 1,
      },
    },
  };
}

function okJson<T>(body: T): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OKeyMetricsSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders em-dash placeholders for every card before any store has loaded', () => {
    const wrapper = mountSection();
    const values = cardValues(wrapper);
    expect(values).toHaveLength(4);
    // Every card falls back to the placeholder until hasLoadedOnce flips.
    expect(values.every((v) => v === '—')).toBe(true);
  });

  it('reflects LIVE vs RESEARCH counts once the stations store has loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson({
          data: [
            makeStation({ id: 'a', dataSource: 'LIVE' }),
            makeStation({ id: 'b', dataSource: 'LIVE' }),
            makeStation({ id: 'c', dataSource: 'LIVE' }),
            makeStation({ id: 'd', dataSource: 'LIVE' }),
            makeStation({ id: 'e', dataSource: 'RESEARCH' }),
            makeStation({ id: 'f', dataSource: 'RESEARCH' }),
            makeStation({ id: 'g', dataSource: 'RESEARCH' }),
          ],
        })
      )
    );
    const stationsStore = useStationsStore();
    await stationsStore.fetchStations();

    const wrapper = mountSection();
    await nextTick();

    const values = cardValues(wrapper);
    // Order matches the metrics array in the component:
    // [stationsMonitored, measurementsToday, lastSync, researchZones]
    expect(values[0]).toBe('4');
    expect(values[3]).toBe('3');
  });

  it('renders 0 as a legitimate post-load value (no placeholder flash)', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/stations')) return Promise.resolve(okJson({ data: [] }));
      return Promise.resolve(okJson(statusBody({ measurementsCreatedSum: 0 })));
    });
    vi.stubGlobal('fetch', fetchMock);

    const stationsStore = useStationsStore();
    const statusStore = useStatusStore();
    await Promise.all([stationsStore.fetchStations(), statusStore.fetchStatus()]);

    const wrapper = mountSection();
    await nextTick();

    const values = cardValues(wrapper);
    expect(values[0]).toBe('0'); // zero LIVE stations — legit, not a dash
    expect(values[1]).toBe('0'); // zero measurements today — legit
    expect(values[3]).toBe('0'); // zero RESEARCH stations — legit
  });

  it('formats minutesSinceLastSuccess via the relative-time utility', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T12:05:00.000Z'));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJson(
          statusBody({
            // 7 minutes before "now" → "il y a 7 min".
            lastSuccessAt: '2026-04-21T11:58:00.000Z',
            measurementsCreatedSum: 42,
          })
        )
      )
    );
    const statusStore = useStatusStore();
    await statusStore.fetchStatus();

    const wrapper = mountSection();
    await nextTick();

    const values = cardValues(wrapper);
    expect(values[1]).toBe('42');
    expect(values[2]).toBe('il y a 7 min');
  });

  it('keeps the placeholder when the status fetch errors without a prior success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500, statusText: 'Server Error' }))
    );
    const statusStore = useStatusStore();
    await statusStore.fetchStatus();

    expect(statusStore.error).toBeInstanceOf(Error);
    expect(statusStore.hasLoadedOnce).toBe(false);

    const wrapper = mountSection();
    await nextTick();

    const values = cardValues(wrapper);
    // Status-backed cards (measurementsToday at [1], lastSync at [2])
    // stay on placeholder; we do not bubble the error into the cards.
    expect(values[1]).toBe('—');
    expect(values[2]).toBe('—');
  });
});
