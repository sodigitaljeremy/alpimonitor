import { useStatusStore } from '@/stores/status';

import OHeroSection from './OHeroSection.vue';

import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';

/**
 * OHeroSection reads the status store + polls GET /api/v1/status every
 * 60s. Storybook has no backend, so each story:
 *   1. Patches the store state for the scenario.
 *   2. Replaces fetchStatus() with a no-op so the polling loop never
 *      issues a real request (it would overwrite the seeded state with
 *      a network error otherwise).
 *
 * Typing notes:
 *   - `StatusPatch` derives from `$state` (not `$patch` params) to force
 *     the object-literal overload — `$patch` has a function-overload that
 *     TS would otherwise prefer, masking unknown keys as callback params.
 *   - `Decorator` from Storybook typed the return of `seedStatus` so the
 *     decorator function satisfies the CSF3 contract (the prior
 *     `(story: unknown) => { ... }` shape was not assignable).
 */
type StatusPatch = Partial<ReturnType<typeof useStatusStore>['$state']>;

function seedStatus(patch: StatusPatch): Decorator {
  return (story) => ({
    components: { story },
    setup() {
      const store = useStatusStore();
      // `$patch` has both object and function overloads; the object form
      // resolves `_DeepPartial<UnwrapRef<S>>` and does not reliably accept
      // `Partial<$state>` because of the ref-unwrapping layer. The
      // function form sidesteps the overload pick and is idiomatic for
      // programmatic seeding in tests/stories.
      store.$patch((state) => {
        Object.assign(state, patch);
      });
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
      error: { kind: 'network', cause: new Error('Simulated network failure') } as const,
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
