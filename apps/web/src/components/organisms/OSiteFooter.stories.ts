import OSiteFooter from './OSiteFooter.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Organisms/OSiteFooter',
  component: OSiteFooter,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof OSiteFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
