import type { MeasurementSeries } from '@alpimonitor/shared';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import OHydroChart from './OHydroChart.vue';

/**
 * jsdom does not implement ResizeObserver, and the chart mounts one in
 * onMounted to recompute its viewBox on container resize. We install a
 * minimal fake that captures the latest callback so a test can fire a
 * synthetic resize and assert the reactive branches that depend on width.
 */
let lastResizeCallback: ResizeObserverCallback | null = null;

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    lastResizeCallback = cb;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function fireResize(width: number): void {
  if (!lastResizeCallback) return;
  lastResizeCallback(
    [{ contentRect: { width } as DOMRect } as ResizeObserverEntry],
    // @ts-expect-error second arg unused in the chart
    null
  );
}

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  messages: {
    fr: {
      drawer: {
        chartAriaLabel: 'Hydrogramme',
        chartEmpty: 'Aucune donnée pour les dernières 24h',
      },
    },
  },
});

function buildSeries(pointCount: number): MeasurementSeries {
  const baseMs = new Date('2026-04-21T12:00:00Z').getTime();
  const points = Array.from({ length: pointCount }, (_, i) => ({
    t: new Date(baseMs - (pointCount - 1 - i) * 30 * 60_000).toISOString(),
    v: 10 + Math.sin(i / 3) * 2,
  }));
  return { parameter: 'DISCHARGE', unit: 'm³/s', points };
}

const WINDOW_TO = new Date('2026-04-21T12:00:00Z');
const WINDOW_FROM = new Date(WINDOW_TO.getTime() - 24 * 60 * 60 * 1000);

describe('OHydroChart', () => {
  beforeEach(() => {
    lastResizeCallback = null;
    globalThis.ResizeObserver = MockResizeObserver;
  });

  afterEach(() => {
    // Let vi's normal cleanup handle globals; ResizeObserver isn't a
    // system global we want to leak between tests that don't install it.
    // @ts-expect-error deliberate teardown
    delete globalThis.ResizeObserver;
  });

  it('renders the SVG with a non-empty line path and an axis when data is present', () => {
    const wrapper = mount(OHydroChart, {
      global: { plugins: [i18n] },
      props: {
        series: buildSeries(48),
        windowFrom: WINDOW_FROM,
        windowTo: WINDOW_TO,
      },
    });

    const svg = wrapper.find('svg.o-hydro-chart__svg');
    expect(svg.exists()).toBe(true);

    // The line and area paths are built from the series — their `d`
    // attribute must not be empty. A bug that dropped the points (or
    // broke the scale) would surface here as `d=""` rather than a crash.
    const linePath = wrapper.find('path.o-hydro-chart__line');
    const areaPath = wrapper.find('path.o-hydro-chart__area');
    expect(linePath.attributes('d')).toBeTruthy();
    expect(linePath.attributes('d')?.length ?? 0).toBeGreaterThan(20);
    expect(areaPath.attributes('d')).toBeTruthy();

    // Y-axis always draws 4 ticks (see computeYDomain + .ticks(4)).
    const yTicks = wrapper.findAll('.o-hydro-chart__y-axis text');
    expect(yTicks.length).toBeGreaterThanOrEqual(3);

    // The empty state div must not be rendered when data is present.
    expect(wrapper.find('.o-hydro-chart__empty').exists()).toBe(false);
  });

  it('shows the i18n empty message and no SVG when series is null', () => {
    const wrapper = mount(OHydroChart, {
      global: { plugins: [i18n] },
      props: { series: null, windowFrom: WINDOW_FROM, windowTo: WINDOW_TO },
    });

    expect(wrapper.find('svg.o-hydro-chart__svg').exists()).toBe(false);

    const empty = wrapper.find('.o-hydro-chart__empty');
    expect(empty.exists()).toBe(true);
    expect(empty.text()).toBe('Aucune donnée pour les dernières 24h');
  });

  it('drops from 3 x-ticks (narrow) to 6 x-ticks (desktop) when the ResizeObserver fires a wider rect', async () => {
    const wrapper = mount(OHydroChart, {
      global: { plugins: [i18n] },
      props: {
        series: buildSeries(48),
        windowFrom: WINDOW_FROM,
        windowTo: WINDOW_TO,
      },
    });
    await nextTick();

    // Initial width default is 400 (< 420) -> narrow branch asks d3-scale
    // for 3 ticks. d3 treats that as a hint and returns "pretty" values
    // (3 to 5 depending on the heuristic — env-sensitive). The semantic
    // we verify is the monotonic comparison below (narrow < desktop),
    // not a hard bound on the narrow count itself.
    const narrowCount = wrapper.findAll('.o-hydro-chart__x-axis text').length;

    // Fire a simulated resize into the desktop branch.
    fireResize(800);
    await nextTick();

    const desktopCount = wrapper.findAll('.o-hydro-chart__x-axis text').length;
    // Desktop asks for 6 ticks; the semantic we care about is strictly
    // more ticks than narrow. A regression that dropped the branch and
    // always asked for 3 ticks would fail this assertion.
    expect(desktopCount).toBeGreaterThan(narrowCount);
    expect(desktopCount).toBeGreaterThanOrEqual(6);
  });

  it('renders without crashing when the series contains exactly one point', () => {
    const single: MeasurementSeries = {
      parameter: 'DISCHARGE',
      unit: 'm³/s',
      points: [{ t: new Date(WINDOW_FROM.getTime() + 12 * 60 * 60 * 1000).toISOString(), v: 7.3 }],
    };

    const wrapper = mount(OHydroChart, {
      global: { plugins: [i18n] },
      props: { series: single, windowFrom: WINDOW_FROM, windowTo: WINDOW_TO },
    });

    // Single-point series: the line generator yields an "M x y" segment
    // with no line connecting nothing to nothing. Assert that the path is
    // present and free of NaN — NaN would surface as `NaN` literal in the
    // attribute, which is a classic d3-scale edge-case bug.
    const linePath = wrapper.find('path.o-hydro-chart__line');
    expect(linePath.exists()).toBe(true);
    const d = linePath.attributes('d') ?? '';
    expect(d).not.toContain('NaN');

    // The empty state must not trigger on a single-point series.
    expect(wrapper.find('.o-hydro-chart__empty').exists()).toBe(false);
  });
});
