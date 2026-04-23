import ABadge from './ABadge.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

/**
 * `label` is a synthetic Storybook arg: the component itself exposes the
 * label through a default slot, not a prop. Declaring the args shape as a
 * plain interface (instead of `typeof ABadge & { label: string }`) lets
 * CSF3 derive `argTypes` / `args` / `Story['args']` from this interface —
 * the intersection form was silently ignored by the `ComponentPropsAndSlots`
 * inference in Storybook 10, surfacing as TS2353 on every occurrence of
 * `label`.
 */
interface ABadgeStoryArgs {
  variant?: 'live' | 'research' | 'neutral';
  label: string;
}

const meta: Meta<ABadgeStoryArgs> = {
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
};

export default meta;
type Story = StoryObj<ABadgeStoryArgs>;

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
