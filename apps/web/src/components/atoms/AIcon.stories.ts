import AIcon from './AIcon.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const ICON_NAMES = [
  'station',
  'clock',
  'chart',
  'signal',
  'arrow-down',
  'external',
  'github',
  'linkedin',
  'close',
  'check',
  'info',
] as const;

const meta = {
  title: 'Atoms/AIcon',
  component: AIcon,
  tags: ['autodocs'],
  argTypes: {
    name: {
      control: 'select',
      options: ICON_NAMES,
      description:
        'Icon identifier. Each name maps to a hand-drawn SVG path embedded in the component.',
    },
    size: {
      control: { type: 'number', min: 12, max: 96, step: 4 },
      description: 'Pixel size (width = height). Defaults to 24.',
    },
  },
  args: {
    name: 'station',
    size: 24,
  },
  render: (args) => ({
    components: { AIcon },
    setup() {
      return { args };
    },
    template: `<AIcon :name="args.name" :size="args.size" class="text-primary" />`,
  }),
} satisfies Meta<typeof AIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Gallery: Story = {
  name: 'Gallery (all icons)',
  parameters: {
    controls: { disable: true },
  },
  render: () => ({
    components: { AIcon },
    setup() {
      return { icons: ICON_NAMES };
    },
    template: `
      <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        <div
          v-for="name in icons"
          :key="name"
          class="flex flex-col items-center gap-2 rounded-md border border-slate-alpi/20 bg-glacier/40 p-4 text-primary"
        >
          <AIcon :name="name" :size="32" />
          <code class="font-mono text-[11px] text-slate-alpi">{{ name }}</code>
        </div>
      </div>
    `,
  }),
};

export const Sizes: Story = {
  name: 'Sizes (16 / 24 / 32 / 48)',
  parameters: {
    controls: { disable: true },
  },
  render: () => ({
    components: { AIcon },
    template: `
      <div class="flex items-end gap-6 text-primary">
        <div class="flex flex-col items-center gap-1"><AIcon name="station" :size="16" /><code class="font-mono text-[11px] text-slate-alpi">16</code></div>
        <div class="flex flex-col items-center gap-1"><AIcon name="station" :size="24" /><code class="font-mono text-[11px] text-slate-alpi">24</code></div>
        <div class="flex flex-col items-center gap-1"><AIcon name="station" :size="32" /><code class="font-mono text-[11px] text-slate-alpi">32</code></div>
        <div class="flex flex-col items-center gap-1"><AIcon name="station" :size="48" /><code class="font-mono text-[11px] text-slate-alpi">48</code></div>
      </div>
    `,
  }),
};
