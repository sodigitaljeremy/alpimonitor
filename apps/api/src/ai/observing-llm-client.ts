import type { PrismaClient } from '@prisma/client';

import {
  LlmError,
  type LlmClient,
  type LlmCompletion,
  type LlmCompletionRequest,
} from './llm-client.js';
import { computeCostUsd } from './llm-pricing.js';

// AI layer — extension D (ADR-012). Observability decorator.
//
// Wraps ANY LlmClient (Mistral direct today; a LiteLLM-backed client tomorrow,
// behind the same interface) and records one LlmCallRun per call — success or
// failure — with provider/model, tokens, estimated cost, latency. The wrapped
// client and the narration service are untouched: observability is additive.

export interface LlmCallRecord {
  provider: string;
  model: string;
  operation: string;
  status: 'SUCCESS' | 'ERROR';
  errorKind: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
}

export interface LlmCallStore {
  record(call: LlmCallRecord): Promise<void>;
}

export function createPrismaLlmCallStore(prisma: PrismaClient): LlmCallStore {
  return {
    async record(call) {
      await prisma.llmCallRun.create({ data: call });
    },
  };
}

export interface ObservingLlmOptions {
  operation: string; // e.g. 'narration'
  now?: () => number; // injectable clock for deterministic tests
}

export function createObservingLlmClient(
  inner: LlmClient,
  store: LlmCallStore,
  opts: ObservingLlmOptions
): LlmClient {
  const clock = opts.now ?? Date.now;

  // Recording must never break the feature: a failed insert is swallowed.
  async function safeRecord(call: LlmCallRecord): Promise<void> {
    try {
      await store.record(call);
    } catch {
      // observability is best-effort; the LLM result/erreur still flows
    }
  }

  return {
    provider: inner.provider,
    model: inner.model,
    async complete(req: LlmCompletionRequest): Promise<LlmCompletion> {
      const startedAt = clock();
      try {
        const completion = await inner.complete(req);
        const latencyMs = Math.max(0, Math.round(clock() - startedAt));
        const costUsd = computeCostUsd(
          inner.model,
          completion.promptTokens,
          completion.completionTokens
        );
        await safeRecord({
          provider: inner.provider,
          model: inner.model,
          operation: opts.operation,
          status: 'SUCCESS',
          errorKind: null,
          promptTokens: completion.promptTokens,
          completionTokens: completion.completionTokens,
          costUsd,
          latencyMs,
        });
        return { ...completion, costUsd };
      } catch (err) {
        const latencyMs = Math.max(0, Math.round(clock() - startedAt));
        await safeRecord({
          provider: inner.provider,
          model: inner.model,
          operation: opts.operation,
          status: 'ERROR',
          errorKind: err instanceof LlmError ? err.kind : null,
          promptTokens: null,
          completionTokens: null,
          costUsd: null,
          latencyMs,
        });
        throw err; // preserve the typed error for the narration service
      }
    },
  };
}
