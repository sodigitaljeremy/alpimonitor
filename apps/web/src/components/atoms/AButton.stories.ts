import AButton from './AButton.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

/**
 * `label` is a synthetic Storybook arg: the component itself exposes the
 * label through a default slot, not a prop. See ABadge.stories.ts for the
 * same pattern — declaring the args shape as a plain interface lets CSF3
 * derive `argTypes` / `args` / `Story['args']` from it directly.
 */
interface AButtonStoryArgs {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  label: string;
  onClick?: (event: MouseEvent) => void;
}

const meta: Meta<AButtonStoryArgs> = {
  title: 'Atoms/AButton',
  component: AButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    type: {
      control: 'select',
      options: ['button', 'submit'],
    },
    label: {
      control: 'text',
      description: 'Slot content of the button.',
    },
    onClick: { action: 'click' },
  },
  args: {
    variant: 'primary',
    size: 'md',
    type: 'button',
    label: 'Action',
  },
  render: (args) => ({
    components: { AButton },
    setup() {
      return { args };
    },
    template: `<AButton :variant="args.variant" :size="args.size" :type="args.type" @click="args.onClick">{{ args.label }}</AButton>`,
  }),
};

export default meta;
type Story = StoryObj<AButtonStoryArgs>;

export const Primary: Story = {
  args: { variant: 'primary', label: 'Voir les stations' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', label: 'En savoir plus' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', label: 'Ignorer' },
};

export const Sizes: Story = {
  name: 'Sizes (sm / md / lg)',
  parameters: {
    controls: { disable: true },
  },
  render: () => ({
    components: { AButton },
    template: `
      <div class="flex items-center gap-4">
        <AButton size="sm">Small</AButton>
        <AButton size="md">Medium</AButton>
        <AButton size="lg">Large</AButton>
      </div>
    `,
  }),
};
