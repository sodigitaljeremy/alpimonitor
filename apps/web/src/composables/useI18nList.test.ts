import { mount } from '@vue/test-utils';
import { defineComponent, h, type ComputedRef } from 'vue';
import { createI18n } from 'vue-i18n';
import { describe, expect, it } from 'vitest';

import { useI18nList } from './useI18nList';

type Station = { name: string; river: string };

// Test fixture shape: the only constraint is that values are consumable by
// vue-i18n's `tm()`. We use `unknown` + a cast at the createI18n boundary
// because vue-i18n 11's `LocaleMessageDictionary` is too narrow for mixed
// string/array/object payloads we deliberately push here (incl. the "key
// resolves to a string, not an array" edge case tested below).
type TestMessages = Record<string, unknown>;

function captureList<T>(key: string, messages: TestMessages): T[] {
  const i18n = createI18n({
    legacy: false,
    locale: 'fr',
    // The cast is scoped to the test harness; the composable under test
    // still receives fully-typed translations through useI18n().
    messages: { fr: messages } as unknown as { fr: Record<string, string> },
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
