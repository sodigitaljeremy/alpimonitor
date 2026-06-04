import fp from 'fastify-plugin';

import { createMistralClient, type LlmClient } from '../ai/llm-client.js';
import { createObservingLlmClient, createPrismaLlmCallStore } from '../ai/observing-llm-client.js';

declare module 'fastify' {
  interface FastifyInstance {
    llm: LlmClient;
  }
}

// AI layer (ADR-012). Exposes a singleton, observed LLM client.
//
// Inner client (extension A): Mistral, called directly. If LITELLM_BASE_URL is
// set, the SAME OpenAI-compatible client points at a LiteLLM proxy instead —
// transparent swap, no service change. NOTE (D): the LiteLLM proxy is NOT
// deployed; this is a ready-to-wire extension point, like the Snowflake/cloud
// bridges. The observability itself (LlmCallRun, cost, /ai/status) is REAL and
// runs around whichever inner client is active.
//
// Outer wrapper (extension D): ObservingLlmClient records one LlmCallRun per
// call (success or failure) with tokens, estimated cost and latency.
//
// Keys are read lazily at call time, so a missing key degrades to a typed
// 'config' error rather than crashing boot.
export const llmPlugin = fp(
  async (app) => {
    const model = process.env.MISTRAL_MODEL ?? 'mistral-small-latest';
    const liteLlmBaseUrl = process.env.LITELLM_BASE_URL;

    const inner = liteLlmBaseUrl
      ? createMistralClient({
          provider: 'litellm',
          endpoint: `${liteLlmBaseUrl.replace(/\/$/, '')}/chat/completions`,
          apiKey: process.env.LITELLM_API_KEY,
          model,
        })
      : createMistralClient({ model });

    const store = createPrismaLlmCallStore(app.prisma);
    const llm = createObservingLlmClient(inner, store, { operation: 'narration' });

    app.decorate('llm', llm);
  },
  { name: 'llm', dependencies: ['prisma'] }
);
