import OResearchZonesSection from './OResearchZonesSection.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Organisms/OResearchZonesSection',
  component: OResearchZonesSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  globals: {
    backgrounds: { value: 'graphite' },
  },
} satisfies Meta<typeof OResearchZonesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
