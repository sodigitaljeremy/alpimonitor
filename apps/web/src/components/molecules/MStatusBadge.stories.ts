import MStatusBadge from './MStatusBadge.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/MStatusBadge',
  component: MStatusBadge,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['live', 'stale', 'offline', 'loading'],
      description: 'Reflects the ingestion health read from GET /api/v1/status.',
    },
    label: { control: 'text' },
  },
  args: {
    status: 'live',
    label: 'Données à jour',
  },
} satisfies Meta<typeof MStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {
  args: { status: 'live', label: 'Données à jour · 3 min' },
};

export const Stale: Story = {
  args: { status: 'stale', label: 'Retard LINDAS · 22 min' },
};

export const Offline: Story = {
  args: { status: 'offline', label: 'Ingestion interrompue' },
};

export const Loading: Story = {
  args: { status: 'loading', label: 'Chargement…' },
};
