import { describe, expect, it } from 'vitest';

import { CHAT_PROMPT_VERSION, buildChatSystemPrompt } from '../src/ai/chat/chat-prompt.js';

describe('buildChatSystemPrompt', () => {
  it('exposes the bumped prompt version (traced per chat run)', () => {
    expect(CHAT_PROMPT_VERSION).toBe('chat-v4');
  });

  it('declares the scope as the Rhône valaisan network, aligned on the LIVE data (chat-v4)', () => {
    const p = buildChatSystemPrompt();
    expect(p).toContain('Rhône valaisan et de ses affluents');
    // The geographic refusal no longer excludes the Rhône itself — it gates on
    // the followed stations / another region / an unrelated subject.
    expect(p).not.toContain('un autre bassin');
    expect(p).toContain('sort du réseau de stations suivi');
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

  it('handles the meta-question as a scope description, not a refusal (chat-v3)', () => {
    const p = buildChatSystemPrompt();
    expect(p).toContain('Méta-question');
    expect(p).toContain('EXCEPTION au refus');
    // Real out-of-scope questions (e.g. weather) still hit strict grounding.
    expect(p).toContain('une demande de météo ou de prévision reste');
  });
});
