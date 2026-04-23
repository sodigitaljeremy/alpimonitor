import MSectionHeader from './MSectionHeader.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Molecules/MSectionHeader',
  component: MSectionHeader,
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: ['light', 'dark'],
      description: 'Light tone targets white/glacier hosts; dark tone targets graphite hero.',
    },
    headingId: {
      control: 'text',
      description: 'Required — wires to aria-labelledby on the section wrapper.',
    },
    eyebrow: { control: 'text' },
    title: { control: 'text' },
    subtitle: { control: 'text' },
  },
  args: {
    headingId: 'sb-section-header',
    title: 'Le bassin de la Borgne en temps réel',
    tone: 'light',
  },
} satisfies Meta<typeof MSectionHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};

export const WithEyebrow: Story = {
  args: {
    eyebrow: 'Monitoring hydrologique',
    title: 'Sept stations, une vallée',
  },
};

export const Full: Story = {
  name: 'Full (eyebrow + title + subtitle)',
  args: {
    eyebrow: 'Val d’Hérens',
    title: 'Le bassin de la Borgne en temps réel',
    subtitle:
      'Données publiques OFEV rafraîchies toutes les 10 minutes, complétées par le réseau de recherche CREALP sur les affluents alpins.',
  },
};

export const Dark: Story = {
  name: 'Dark tone (hero background)',
  globals: {
    backgrounds: { value: 'graphite' },
  },
  decorators: [
    (story) => ({
      components: { story },
      template: `<div style="padding: 32px;"><story /></div>`,
    }),
  ],
  args: {
    tone: 'dark',
    eyebrow: 'Val d’Hérens',
    title: 'Le bassin de la Borgne en temps réel',
    subtitle:
      'Données publiques OFEV rafraîchies toutes les 10 minutes, complétées par le réseau de recherche CREALP sur les affluents alpins.',
  },
};
