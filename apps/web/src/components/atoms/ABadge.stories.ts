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
      description: 'Visual variant — aligns with data provenance semantics.',
    },
  },
  args: {
    variant: 'neutral',
  },
  render: (args) => ({
    components: { ABadge },
    setup() {
      return { args };
    },
    template: `<ABadge v-bind="args">Badge label</ABadge>`,
  }),
} satisfies Meta<typeof ABadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
