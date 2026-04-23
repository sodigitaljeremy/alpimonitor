import OWhyLindasSection from './OWhyLindasSection.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Organisms/OWhyLindasSection',
  component: OWhyLindasSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof OWhyLindasSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
