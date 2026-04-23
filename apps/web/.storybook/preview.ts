import { setup } from '@storybook/vue3-vite';
import { createPinia } from 'pinia';

import { i18n } from '../src/i18n';

import type { Preview } from '@storybook/vue3-vite';

import '../src/assets/main.css';

setup((app) => {
  app.use(createPinia());
  app.use(i18n);
});

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        light: { name: 'Light', value: '#FFFFFF' },
        glacier: { name: 'Glacier soft', value: '#F4F8FB' },
        graphite: { name: 'Graphite dark', value: '#1C242C' },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      toc: true,
    },
    a11y: {
      test: 'todo',
    },
  },
  initialGlobals: {
    backgrounds: { value: 'light' },
  },
};

export default preview;
