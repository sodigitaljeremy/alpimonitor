import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import fr from '@/locales/fr.json';

import ASourcingBadge from './ASourcingBadge.vue';

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr } });

function mountBadge(status: 'CONFIRMED' | 'ILLUSTRATIVE') {
  return mount(ASourcingBadge, {
    props: { status },
    global: { plugins: [i18n] },
  });
}

describe('ASourcingBadge', () => {
  it('renders CONFIRMED with the official source label and check icon', () => {
    const wrapper = mountBadge('CONFIRMED');

    expect(wrapper.classes()).toContain('a-sourcing-badge--confirmed');
    expect(wrapper.text()).toContain(fr.sourcing.confirmed.label);
    // Icon class carries the name modifier, so we can assert it without
    // digging into the SVG paths.
    expect(wrapper.find('.a-icon--check').exists()).toBe(true);
  });

  it('renders ILLUSTRATIVE with the representative label and info icon', () => {
    const wrapper = mountBadge('ILLUSTRATIVE');

    expect(wrapper.classes()).toContain('a-sourcing-badge--illustrative');
    expect(wrapper.text()).toContain(fr.sourcing.illustrative.label);
    expect(wrapper.find('.a-icon--info').exists()).toBe(true);
  });

  it('exposes the tooltip via role=tooltip + aria-describedby link', () => {
    const wrapper = mountBadge('CONFIRMED');

    const describedBy = wrapper.attributes('aria-describedby');
    expect(describedBy).toBeTruthy();

    const tooltip = wrapper.find(`#${describedBy}`);
    expect(tooltip.exists()).toBe(true);
    expect(tooltip.attributes('role')).toBe('tooltip');
    expect(tooltip.text()).toBe(fr.sourcing.confirmed.tooltip);
  });

  it('is keyboard-focusable (tabindex=0) for tooltip reveal via focus', () => {
    const wrapper = mountBadge('ILLUSTRATIVE');
    expect(wrapper.attributes('tabindex')).toBe('0');
  });
});
