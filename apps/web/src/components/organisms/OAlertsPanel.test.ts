import type { AlertDTO, StationDTO } from '@alpimonitor/shared';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import { api } from '@/lib/api-client';
import fr from '@/locales/fr.json';
import { useStationsStore } from '@/stores/stations';

import OAlertsPanel from './OAlertsPanel.vue';

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr } });

function makeStation(id: string, name: string): StationDTO {
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

function makeAlert(partial: Partial<AlertDTO> & { id: string }): AlertDTO {
  return {
    id: partial.id,
    stationId: partial.stationId ?? 'station-1',
    type: 'STATISTICAL_ANOMALY',
    level: partial.level ?? 'VIGILANCE',
    parameter: partial.parameter ?? 'DISCHARGE',
    triggerValue: partial.triggerValue ?? 1.2,
    thresholdValue: partial.thresholdValue ?? 2.0,
    openedAt: partial.openedAt ?? '2026-06-04T06:00:00.000Z',
    closedAt: partial.closedAt ?? null,
    metadata: partial.metadata ?? { z: -2.4, hourBucket: 6 },
  };
}

function mockAlerts(open: AlertDTO[], closed: AlertDTO[] = []) {
  vi.spyOn(api, 'getAlerts').mockImplementation((params = {}) => {
    const data = params.status === 'closed' ? closed : open;
    return Promise.resolve({ success: true as const, data: { data } });
  });
}

async function mountPanel(): Promise<VueWrapper> {
  const wrapper = mount(OAlertsPanel, { global: { plugins: [i18n] } });
  // Let the immediate poll's fetch resolve and the component re-render.
  await flushPromises();
  return wrapper;
}

describe('OAlertsPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the nominal state when no anomaly is open', async () => {
    mockAlerts([], []);
    const wrapper = await mountPanel();

    expect(wrapper.find('.o-alerts-panel__nominal').exists()).toBe(true);
    expect(wrapper.text()).toContain(fr.alerts.nominal.title);
    expect(wrapper.find('.o-alerts-panel__count').exists()).toBe(false);
    // The honest method/disclaimer footer is always present.
    expect(wrapper.text()).toContain('z-score déseasonnalisé');
  });

  it('lists open anomalies with resolved station name, level, z and hour', async () => {
    useStationsStore().$patch({ stations: [makeStation('station-1', 'Sion — Rhône')] });
    mockAlerts([makeAlert({ id: 'open-1', stationId: 'station-1', level: 'ALERT' })]);

    const wrapper = await mountPanel();

    const items = wrapper.findAll('.o-alerts-panel__item');
    expect(items).toHaveLength(1);
    const text = items[0]!.text();
    expect(text).toContain('Sion — Rhône');
    expect(text).toContain(fr.alerts.parameter.DISCHARGE);
    expect(text).toContain(fr.alerts.level.ALERT);
    expect(text).toContain(fr.alerts.direction.BELOW); // z = -2.4 → below
    expect(text).toContain('z = −2.4');
    expect(text).toContain('06 h UTC');

    // The count badge reflects the open episode.
    expect(wrapper.find('.o-alerts-panel__count').exists()).toBe(true);
    expect(wrapper.find('.o-alerts-panel__nominal').exists()).toBe(false);
  });

  it('renders a recent-history strip below the open list', async () => {
    useStationsStore().$patch({ stations: [makeStation('station-1', 'Sion — Rhône')] });
    mockAlerts([], [makeAlert({ id: 'closed-1', closedAt: '2026-06-03T12:00:00.000Z' })]);

    const wrapper = await mountPanel();

    // Nominal (nothing open) AND a history block both present.
    expect(wrapper.find('.o-alerts-panel__nominal').exists()).toBe(true);
    expect(wrapper.text()).toContain(fr.alerts.history.title);
    expect(wrapper.find('.o-alerts-panel__list--history').exists()).toBe(true);
  });
});
