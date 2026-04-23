import { useStatusStore } from '@/stores/status';

import OHeroSection from './OHeroSection.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

/**
 * OHeroSection reads the status store + polls GET /api/v1/status every
 * 60s. Storybook has no backend, so each story:
 *   1. Patches the store state for the scenario.
 *   2. Replaces fetchStatus() with a no-op so the polling loop never
 *      issues a real request (it would overwrite the seeded state with
 *      a network error otherwise).
 */
type StatusPatch = Parameters<ReturnType<typeof useStatusStore>['$patch']>[0];

function seedStatus(patch: StatusPatch) {
  return (story: unknown) => ({
    components: { story },
    setup() {
      const store = useStatusStore();
      store.$patch(patch);
      store.fetchStatus = async () => {
        /* no-op — Storybook has no backend */
      };
      return {};
    },
    template: '<story />',
  });
}

const now = Date.now();

const meta = {
  title: 'Organisms/OHeroSection',
  component: OHeroSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof OHeroSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {
  name: 'Live (3 min ago, healthy)',
  decorators: [
    seedStatus({
      hasLoadedOnce: true,
      error: null,
      lastSuccessAt: new Date(now - 3 * 60_000),
      healthyThresholdMinutes: 30,
    }),
  ],
};

export const Stale: Story = {
  name: 'Stale (45 min ago, over threshold)',
  decorators: [
    seedStatus({
      hasLoadedOnce: true,
      error: null,
      lastSuccessAt: new Date(now - 45 * 60_000),
      healthyThresholdMinutes: 30,
    }),
  ],
};

export const Offline: Story = {
  name: 'Offline (fetch error)',
  decorators: [
    seedStatus({
      hasLoadedOnce: true,
      error: new Error('Simulated network failure'),
      lastSuccessAt: null,
    }),
  ],
};

export const Loading: Story = {
  name: 'Loading (first fetch pending)',
  decorators: [
    seedStatus({
      hasLoadedOnce: false,
      error: null,
      lastSuccessAt: null,
    }),
  ],
};
