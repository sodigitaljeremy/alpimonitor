import fp from 'fastify-plugin';

import { createMistralClient, type LlmClient } from '../ai/llm-client.js';

declare module 'fastify' {
  interface FastifyInstance {
    llm: LlmClient;
  }
}

// AI layer — extension A (ADR-012). Exposes a singleton LLM client.
// Today it is Mistral, called directly; D will swap a LiteLLM-backed client
// here without touching the narration service (same LlmClient interface).
// The API key is read lazily inside the client at call time, so a missing key
// degrades to a typed 'config' error rather than crashing boot.
export const llmPlugin = fp(
  async (app) => {
    const llm = createMistralClient({
      model: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
    });
    app.decorate('llm', llm);
  },
  { name: 'llm' }
);
