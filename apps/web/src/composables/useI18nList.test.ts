import { mount } from '@vue/test-utils';
import { defineComponent, h, type ComputedRef } from 'vue';
import { createI18n } from 'vue-i18n';
import { describe, expect, it } from 'vitest';

import { useI18nList } from './useI18nList';

type Station = { name: string; river: string };

function captureList<T>(key: string, messages: Record<string, unknown>): T[] {
  const i18n = createI18n({
    legacy: false,
    locale: 'fr',
    messages: { fr: messages },
  });

  let captured: ComputedRef<T[]> | undefined;

  const Probe = defineComponent({
    setup() {
      captured = useI18nList<T>(key);
      return () => h('div');
    },
  });

  mount(Probe, { global: { plugins: [i18n] } });

  if (!captured) {
    throw new Error('useI18nList did not return a value');
  }
  return captured.value;
}

describe('useI18nList', () => {
  it('returns a typed list when the key resolves to an array of strings', () => {
    const result = captureList<string>('paragraphs', {
      paragraphs: ['one', 'two', 'three'],
    });

    expect(result).toEqual(['one', 'two', 'three']);
  });

  it('returns a typed list when the key resolves to an array of objects', () => {
    const result = captureList<Station>('stations', {
      stations: [
        { name: 'Borgne — Bramois', river: 'Exutoire' },
        { name: 'Borgne — Evolène', river: 'Milieu' },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('Borgne — Bramois');
    expect(result[1]?.river).toBe('Milieu');
  });

  it('returns an empty array when the key is missing', () => {
    const result = captureList('missing.key', { other: 'value' });

    expect(result).toEqual([]);
  });

  it('returns an empty array when the value is not an array', () => {
    const result = captureList('greeting', { greeting: 'hello' });

    expect(result).toEqual([]);
  });
});
