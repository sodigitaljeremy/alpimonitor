import type { AskResponseDTO } from '@alpimonitor/shared';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import { api } from '@/lib/api-client';
import fr from '@/locales/fr.json';

import OChatPanel from './OChatPanel.vue';

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr } });

function dto(overrides: Partial<AskResponseDTO> = {}): AskResponseDTO {
  return {
    answer: 'Le débit à Sion est de 42,5 m³/s.',
    used: [
      { tool: 'find_stations', args: '{"search":"sion"}', resultSummary: '1 résultat(s)' },
      {
        tool: 'get_latest_measurements',
        args: '{"stationId":"s1"}',
        resultSummary: '1 résultat(s)',
      },
    ],
    language: 'fr',
    generatedAt: '2026-06-05T00:00:00.000Z',
    ...overrides,
  };
}

function mountPanel(): VueWrapper {
  return mount(OChatPanel, { global: { plugins: [i18n] } });
}

async function askQuestion(wrapper: VueWrapper, question: string): Promise<void> {
  await wrapper.find('.o-chat-panel__input').setValue(question);
  await wrapper.find('.o-chat-panel__form').trigger('submit.prevent');
  await flushPromises();
}

describe('OChatPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the intro and a permanent disclaimer before any question', () => {
    const wrapper = mountPanel();

    expect(wrapper.find('.o-chat-panel__intro').exists()).toBe(true);
    expect(wrapper.text()).toContain(fr.chat.disclaimer);
  });

  it('renders the question and answer bubbles after a successful ask', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue({ success: true, data: dto() });
    const wrapper = mountPanel();

    await askQuestion(wrapper, 'Quel est le débit à Sion ?');

    expect(wrapper.find('.o-chat-panel__bubble--user').text()).toContain(
      'Quel est le débit à Sion ?'
    );
    expect(wrapper.find('.o-chat-panel__bubble--assistant').text()).toContain(
      'Le débit à Sion est de 42,5 m³/s.'
    );
    // The input is cleared after sending.
    expect((wrapper.find('.o-chat-panel__input').element as HTMLInputElement).value).toBe('');
  });

  it('surfaces the queried tools (used) for transparency', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue({ success: true, data: dto() });
    const wrapper = mountPanel();

    await askQuestion(wrapper, 'débit à Sion ?');

    const used = wrapper.find('.o-chat-panel__used');
    expect(used.exists()).toBe(true);
    expect(used.text()).toContain(fr.chat.tool.find_stations);
    expect(used.text()).toContain(fr.chat.tool.get_latest_measurements);
  });

  it('renders the model refusal as a normal assistant answer (grounding)', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue({
      success: true,
      data: dto({ answer: 'Je ne peux pas répondre à cette question.', used: [] }),
    });
    const wrapper = mountPanel();

    await askQuestion(wrapper, 'Quel temps fera-t-il demain ?');

    expect(wrapper.find('.o-chat-panel__bubble--assistant').text()).toContain(
      'Je ne peux pas répondre à cette question.'
    );
    // No tool was called → no used trace.
    expect(wrapper.find('.o-chat-panel__used').exists()).toBe(false);
  });

  it('shows an honest error state on a 429 refusal', async () => {
    vi.spyOn(api, 'ask').mockResolvedValue({
      success: false,
      error: { kind: 'http', status: 429, statusText: 'Too Many Requests', path: '/ask' },
    });
    const wrapper = mountPanel();

    await askQuestion(wrapper, 'trop souvent');

    const err = wrapper.find('.o-chat-panel__status--error');
    expect(err.exists()).toBe(true);
    expect(err.text()).toBe(fr.chat.error.rate_limited);
  });

  it('does not call the api for an empty question', async () => {
    const spy = vi.spyOn(api, 'ask');
    const wrapper = mountPanel();

    await askQuestion(wrapper, '   ');

    expect(spy).not.toHaveBeenCalled();
  });
});
