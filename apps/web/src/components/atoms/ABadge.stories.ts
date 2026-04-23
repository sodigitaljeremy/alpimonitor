import ABadge from './ABadge.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Atoms/ABadge',
  component: ABadge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['live', 'research', 'neutral'],
      description:
        'Provenance semantics. `live` = OFEV feed, `research` = CREALP network, `neutral` = fallback chrome.',
    },
    label: {
      control: 'text',
      description: 'Slot content rendered inside the pill.',
    },
  },
  args: {
    variant: 'neutral',
    label: 'Badge label',
  },
  render: (args) => ({
    components: { ABadge },
    setup() {
      return { args };
    },
    template: `<ABadge :variant="args.variant">{{ args.label }}</ABadge>`,
  }),
} satisfies Meta<typeof ABadge & { label: string }>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {
  args: { variant: 'live', label: 'Live OFEV' },
};

export const Research: Story = {
  args: { variant: 'research', label: 'Recherche CREALP' },
};

export const Neutral: Story = {
  args: { variant: 'neutral', label: 'Neutre' },
};

export const LongText: Story = {
  name: 'Long text (wrapping check)',
  args: {
    variant: 'research',
    label: 'Réseau hydrométrique cantonal',
  },
};
