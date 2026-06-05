import { describe, expect, it } from 'vitest';

import { CHAT_PROMPT_VERSION, buildChatSystemPrompt } from '../src/ai/chat/chat-prompt.js';

describe('buildChatSystemPrompt', () => {
  it('exposes the bumped prompt version (traced per chat run)', () => {
    expect(CHAT_PROMPT_VERSION).toBe('chat-v2');
  });

  it('embeds the requested language code', () => {
    expect(buildChatSystemPrompt('en')).toContain('"en"');
    expect(buildChatSystemPrompt()).toContain('"fr"');
  });

  it('requires complete, self-contained sentences (chat-v2 hardening)', () => {
    const p = buildChatSystemPrompt();
    expect(p).toContain('PHRASE COMPLÈTE');
    // The dry-answer failure mode is named explicitly so the model avoids it.
    expect(p).toContain('« Non. »');
  });

  it('keeps the strict grounding contract intact', () => {
    const p = buildChatSystemPrompt();
    expect(p).toContain('UNIQUEMENT à partir des résultats renvoyés par ces fonctions');
    expect(p).toContain('Je ne peux pas répondre à cette question.');
  });
});
