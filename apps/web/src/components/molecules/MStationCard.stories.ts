import MStationCard from './MStationCard.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

/**
 * MStationCard is the most ADR-heavy molecule in the app: it composes the
 * ABadge (kind semantics) with the ASourcingBadge (sourcing transparency
 * per ADR-008). Stories cover the four rendering combinations actually
 * used in production.
 */
const meta = {
  title: 'Molecules/MStationCard',
  component: MStationCard,
  tags: ['autodocs'],
  argTypes: {
    kind: {
      control: 'select',
      options: ['federal', 'research'],
      description: 'federal = BAFU live LINDAS feed; research = CREALP monitoring network.',
    },
    theme: {
      control: 'select',
      options: ['light', 'dark'],
    },
    sourcingStatus: {
      control: 'select',
      options: ['CONFIRMED', 'ILLUSTRATIVE', undefined],
      description:
        'Only rendered on research cards (ADR-008). Federal cards never show this badge.',
    },
    name: { control: 'text' },
    river: { control: 'text' },
    context: { control: 'text' },
  },
  decorators: [
    (story) => ({
      components: { story },
      template: `<div style="max-width: 360px; padding: 96px 24px 24px;"><story /></div>`,
    }),
  ],
  args: {
    kind: 'federal',
    theme: 'light',
    name: 'Borgne — Bramois',
    river: 'Borgne',
    context: 'Altitude 487 m · Bassin versant 392 km²',
  },
} satisfies Meta<typeof MStationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FederalLight: Story = {
  name: 'Federal · light (BAFU live)',
  args: {
    kind: 'federal',
    theme: 'light',
    name: 'Borgne — Bramois',
    river: 'Borgne',
    context: 'Station OFEV · mesure 10 min · altitude 487 m',
  },
};

export const ResearchLight: Story = {
  name: 'Research · light (no sourcing prop)',
  args: {
    kind: 'research',
    theme: 'light',
    name: 'Dixence — Val des Dix',
    river: 'Dixence',
    context: 'Captage hydroélectrique · mesure journalière',
  },
};

export const ResearchDarkConfirmed: Story = {
  name: 'Research · dark · CONFIRMED (Bramois)',
  globals: {
    backgrounds: { value: 'graphite' },
  },
  args: {
    kind: 'research',
    theme: 'dark',
    sourcingStatus: 'CONFIRMED',
    name: 'Borgne — Bramois',
    river: 'Borgne',
    context: 'Station documentée CREALP · confluence Rhône · altitude 487 m',
  },
};

export const ResearchDarkIllustrative: Story = {
  name: 'Research · dark · ILLUSTRATIVE (Les Haudères)',
  globals: {
    backgrounds: { value: 'graphite' },
  },
  args: {
    kind: 'research',
    theme: 'dark',
    sourcingStatus: 'ILLUSTRATIVE',
    name: 'Borgne — Les Haudères',
    river: 'Borgne de Ferpècle',
    context: 'Emplacement plausible · maillage hypothétique démo',
  },
};
