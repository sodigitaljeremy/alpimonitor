import { useStationsStore } from '@/stores/stations';

import OMapSection from './OMapSection.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

/**
 * Stories cover the Loading and Error states of OMapSection.
 *
 * The "Ready" state (map rendered with markers) is intentionally NOT
 * storyised: OStationMap — the child component that renders the actual
 * Leaflet map — is excluded from Storybook per ADR-009 (Leaflet + store
 * + ResizeObserver coupling). Covering the frame states (Loading /
 * Error) is what this story documents: section header + legend chrome
 * around the placeholder grid.
 *
 * The store is seeded so that `showMap` stays false on both stories:
 *   - Loading: hasLoadedOnce = false
 *   - Error:   hasLoadedOnce = true + error set
 * fetchStations is replaced with a no-op so the onMounted call does
 * not overwrite the seeded state with a real network failure.
 */
type StationsPatch = Parameters<ReturnType<typeof useStationsStore>['$patch']>[0];

function seedStations(patch: StationsPatch) {
  return (story: unknown) => ({
    components: { story },
    setup() {
      const store = useStationsStore();
      store.$patch(patch);
      store.fetchStations = async () => {
        /* no-op — Storybook has no backend */
      };
      return {};
    },
    template: '<story />',
  });
}

const meta = {
  title: 'Organisms/OMapSection',
  component: OMapSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof OMapSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: 'Loading (first fetch pending)',
  decorators: [
    seedStations({
      hasLoadedOnce: false,
      error: null,
    }),
  ],
};

export const Error: Story = {
  name: 'Error (network failure)',
  decorators: [
    seedStations({
      hasLoadedOnce: true,
      error: globalThis.Error
        ? new globalThis.Error('Simulated network failure')
        : ({ message: 'Simulated network failure' } as unknown as Error),
    }),
  ],
};
