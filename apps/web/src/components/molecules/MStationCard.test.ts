import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import fr from '@/locales/fr.json';

import MStationCard from './MStationCard.vue';

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr } });

function mountCard(
  props: Partial<{
    kind: 'federal' | 'research';
    sourcingStatus: 'CONFIRMED' | 'ILLUSTRATIVE';
  }>
) {
  return mount(MStationCard, {
    props: {
      name: 'Borgne — Test',
      river: 'Test river',
      context: 'Test context',
      theme: 'dark',
      ...props,
    },
    global: { plugins: [i18n] },
  });
}

describe('MStationCard', () => {
  it('shows the sourcing badge on a research card with CONFIRMED status', () => {
    const wrapper = mountCard({ kind: 'research', sourcingStatus: 'CONFIRMED' });

    expect(wrapper.find('.a-sourcing-badge--confirmed').exists()).toBe(true);
    expect(wrapper.text()).toContain(fr.sourcing.confirmed.label);
  });

  it('shows the sourcing badge on a research card with ILLUSTRATIVE status', () => {
    const wrapper = mountCard({ kind: 'research', sourcingStatus: 'ILLUSTRATIVE' });

    expect(wrapper.find('.a-sourcing-badge--illustrative').exists()).toBe(true);
    expect(wrapper.text()).toContain(fr.sourcing.illustrative.label);
  });

  it('does NOT show the sourcing badge on a federal card — BAFU stations are implicitly confirmed', () => {
    const wrapper = mountCard({ kind: 'federal', sourcingStatus: 'CONFIRMED' });

    expect(wrapper.find('.a-sourcing-badge').exists()).toBe(false);
  });

  it('does NOT show the sourcing badge when sourcingStatus prop is omitted', () => {
    const wrapper = mountCard({ kind: 'research' });

    expect(wrapper.find('.a-sourcing-badge').exists()).toBe(false);
  });
});
