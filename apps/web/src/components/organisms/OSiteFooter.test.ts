import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import fr from '@/locales/fr.json';

import OSiteFooter from './OSiteFooter.vue';

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr } });

describe('OSiteFooter', () => {
  it('renders the LinkedIn link with href, safe target/rel, and explicit aria-label', () => {
    const wrapper = mount(OSiteFooter, { global: { plugins: [i18n] } });

    const linkedin = wrapper.get('a[href="https://www.linkedin.com/in/sojeremy/"]');

    expect(linkedin.attributes('target')).toBe('_blank');
    // rel must include both tokens — noopener prevents window.opener leakage,
    // noreferrer prevents leaking the source URL to LinkedIn.
    expect(linkedin.attributes('rel')).toContain('noopener');
    expect(linkedin.attributes('rel')).toContain('noreferrer');
    expect(linkedin.attributes('aria-label')).toBe(fr.footer.links.linkedinAriaLabel);
    expect(linkedin.text()).toContain(fr.footer.links.linkedin);
  });
});
