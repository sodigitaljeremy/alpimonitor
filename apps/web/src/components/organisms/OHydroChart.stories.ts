import OHydroChart from './OHydroChart.vue';

import type { MeasurementSeries } from '@alpimonitor/shared';
import type { Meta, StoryObj } from '@storybook/vue3-vite';

/**
 * Build a 24-hour synthetic discharge series with a plausible diurnal
 * rhythm (low at dawn, peak mid-afternoon from glacier melt). Points are
 * evenly spaced every 30 minutes = 49 samples, which matches the chart's
 * tick density on a typical desktop drawer width.
 */
function buildSeries(windowFrom: Date, windowTo: Date, pointCount: number): MeasurementSeries {
  const span = windowTo.getTime() - windowFrom.getTime();
  const points = Array.from({ length: pointCount }, (_, i) => {
    const t = new Date(windowFrom.getTime() + (span * i) / Math.max(1, pointCount - 1));
    const hour = t.getHours() + t.getMinutes() / 60;
    // Peak around 15:00, trough around 06:00 — amplitude 4 around mean 12.
    const diurnal = 12 + 4 * Math.sin(((hour - 9) / 24) * Math.PI * 2);
    // Deterministic jitter so the chart shape is stable across reloads.
    const jitter = 0.4 * Math.sin(i * 1.7) + 0.2 * Math.cos(i * 0.9);
    return { t: t.toISOString(), v: Math.round((diurnal + jitter) * 100) / 100 };
  });
  return { parameter: 'DISCHARGE', unit: 'm³/s', points };
}

const now = new Date();
const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

const meta = {
  title: 'Organisms/OHydroChart',
  component: OHydroChart,
  tags: ['autodocs'],
  argTypes: {
    series: { control: false },
    windowFrom: { control: 'date' },
    windowTo: { control: 'date' },
  },
  args: {
    series: buildSeries(dayAgo, now, 49),
    windowFrom: dayAgo,
    windowTo: now,
  },
  decorators: [
    (story) => ({
      components: { story },
      template: `<div style="max-width: 640px; padding: 24px;"><story /></div>`,
    }),
  ],
} satisfies Meta<typeof OHydroChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default (24h discharge)',
};

export const SinglePoint: Story = {
  name: 'Single point (edge case)',
  args: {
    series: {
      parameter: 'DISCHARGE',
      unit: 'm³/s',
      points: [{ t: new Date(dayAgo.getTime() + 12 * 60 * 60 * 1000).toISOString(), v: 12.4 }],
    },
  },
};

export const Empty: Story = {
  name: 'Empty (series = null)',
  args: {
    series: null,
  },
};

export const NarrowMobile: Story = {
  name: 'Narrow mobile (320px)',
  decorators: [
    (story) => ({
      components: { story },
      template: `<div style="max-width: 320px; padding: 16px;"><story /></div>`,
    }),
  ],
};
