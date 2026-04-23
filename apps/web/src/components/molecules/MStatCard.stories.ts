import MStatCard from './MStatCard.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/MStatCard',
  component: MStatCard,
  tags: ['autodocs'],
  argTypes: {
    icon: {
      control: 'select',
      options: ['station', 'clock', 'chart', 'signal'],
    },
    label: { control: 'text' },
    value: { control: 'text' },
    hint: { control: 'text' },
  },
  args: {
    icon: 'signal',
    label: 'Débit actuel',
    value: '12.4 m³/s',
    hint: 'Borgne — Bramois, mesure OFEV',
  },
  decorators: [
    (story) => ({
      components: { story },
      template: `<div style="max-width: 320px;"><story /></div>`,
    }),
  ],
} satisfies Meta<typeof MStatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Discharge: Story = {
  name: 'Discharge (signal icon)',
  args: {
    icon: 'signal',
    label: 'Débit moyen du bassin',
    value: '12.4 m³/s',
    hint: 'Moyenne des 7 stations LINDAS',
  },
};

export const StationCount: Story = {
  name: 'Station count (station icon)',
  args: {
    icon: 'station',
    label: 'Stations suivies',
    value: '7',
    hint: '4 OFEV live · 3 réseau de recherche',
  },
};

export const LastRefresh: Story = {
  name: 'Last refresh (clock icon)',
  args: {
    icon: 'clock',
    label: 'Dernière ingestion',
    value: '3 min',
    hint: 'Cron LINDAS toutes les 10 min',
  },
};

export const TrendChart: Story = {
  name: 'Trend chart (chart icon)',
  args: {
    icon: 'chart',
    label: 'Variation 24 h',
    value: '+ 4.2 %',
    hint: 'Comparé à la même heure hier',
  },
};
