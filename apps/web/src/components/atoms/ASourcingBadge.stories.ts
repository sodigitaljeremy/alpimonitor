import ASourcingBadge from './ASourcingBadge.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

/**
 * ASourcingBadge is designed to render on the graphite-dark MStationCard
 * theme. Stories use the `graphite` background + a padded wrapper so the
 * top-anchored tooltip has room to surface on hover/focus.
 */
const meta: Meta<typeof ASourcingBadge> = {
  title: 'Atoms/ASourcingBadge',
  component: ASourcingBadge,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['CONFIRMED', 'ILLUSTRATIVE'],
      description:
        'Sourcing provenance — CONFIRMED = publicly documented on crealp.ch, ILLUSTRATIVE = plausible placement (demo).',
    },
  },
  args: {
    status: 'CONFIRMED',
  },
  globals: {
    backgrounds: { value: 'graphite' },
  },
  decorators: [
    (story) => ({
      components: { story },
      template: `<div style="min-height: 160px; display: flex; justify-content: center; align-items: flex-end; padding: 96px 24px 24px;"><story /></div>`,
    }),
  ],
  render: (args) => ({
    components: { ASourcingBadge },
    setup() {
      return { args };
    },
    template: `<ASourcingBadge :status="args.status" />`,
  }),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Confirmed: Story = {
  args: { status: 'CONFIRMED' },
};

export const Illustrative: Story = {
  args: { status: 'ILLUSTRATIVE' },
};
