import ANumericValue from './ANumericValue.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Atoms/ANumericValue',
  component: ANumericValue,
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
      description:
        'The measurement to display. Rendered as-is — formatting is the caller’s responsibility.',
    },
    unit: {
      control: 'text',
      description: 'Optional unit suffix, visually dimmed.',
    },
    size: {
      control: 'select',
      options: ['md', 'lg', 'xl'],
    },
  },
  args: {
    value: '12.4',
    unit: 'm³/s',
    size: 'md',
  },
} satisfies Meta<typeof ANumericValue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutUnit: Story = {
  args: { value: 7, unit: undefined, size: 'md' },
};

export const Large: Story = {
  name: 'Large (KPI card)',
  args: { value: '2 462', unit: 'm', size: 'lg' },
};

export const ExtraLarge: Story = {
  name: 'Extra-large (Hero metric)',
  args: { value: '12.4', unit: 'm³/s', size: 'xl' },
};
