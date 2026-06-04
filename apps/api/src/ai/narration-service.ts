import { createHash } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import type { Parameter } from '@alpimonitor/shared';

import type { NarrationFeatures } from './narration-features.js';
import type { LlmClient } from './llm-client.js';
import { LlmError } from './llm-client.js';
import { PROMPT_VERSION, buildNarrationPrompt } from './narration-prompt.js';

// AI layer — extension A3 (ADR-012). Narration orchestration with an
// idempotent Insight cache. The LLM is called at most once per unique
// (station, parameter, window, language, grounding+prompt) — a cache hit
// never calls it again. Any LLM failure becomes a typed outcome, never a crash.

// A narrow store interface (not the full PrismaClient) so the service is
// trivially testable with an in-memory fake and foreshadows the port/adapter
// boundary that extension C will generalise.
export interface InsightKey {
  stationId: string;
  parameter: Parameter;
  windowFrom: Date;
  windowTo: Date;
  language: string;
  inputHash: string;
}

export interface InsightRecord extends InsightKey {
  id: string;
  text: string;
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  generatedAt: Date;
}

export type InsightWrite = Omit<InsightRecord, 'id' | 'generatedAt'>;

export interface InsightStore {
  find(key: InsightKey): Promise<InsightRecord | null>;
  save(data: InsightWrite): Promise<InsightRecord>;
}

// Prisma-backed adapter. Uses the compound unique as the cache key, and an
// idempotent upsert so two concurrent requests can't create duplicates.
export function createPrismaInsightStore(prisma: PrismaClient): InsightStore {
  const whereKey = (key: InsightKey) => ({
    stationId_parameter_windowFrom_windowTo_language_inputHash: {
      stationId: key.stationId,
      parameter: key.parameter,
      windowFrom: key.windowFrom,
      windowTo: key.windowTo,
      language: key.language,
      inputHash: key.inputHash,
    },
  });

  return {
    async find(key) {
      return prisma.insight.findUnique({ where: whereKey(key) });
    },
    async save(data) {
      return prisma.insight.upsert({
        where: whereKey(data),
        update: {}, // idempotent: first writer wins, replays are no-ops
        create: { ...data },
      });
    },
  };
}

export interface GenerateNarrationParams {
  stationId: string;
  features: NarrationFeatures;
  language?: string; // default 'fr'
}

export interface NarrationDeps {
  store: InsightStore;
  llm: LlmClient;
}

export interface NarrationError {
  kind: 'config' | 'llm';
  message: string;
  cause?: string; // the underlying LlmErrorKind, when known
}

export type NarrationOutcome =
  | { status: 'cached'; insight: InsightRecord }
  | { status: 'generated'; insight: InsightRecord }
  | { status: 'error'; error: NarrationError };

// SHA-256 over the exact inputs that determine the narrative. Same features +
// prompt version + language + model ⇒ same hash ⇒ cache hit. Bumping
// PROMPT_VERSION (or changing the model) changes the hash on purpose.
export function computeInputHash(args: {
  features: NarrationFeatures;
  language: string;
  model: string;
  promptVersion: string;
}): string {
  const canonical = JSON.stringify({
    promptVersion: args.promptVersion,
    language: args.language,
    model: args.model,
    features: args.features,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export async function generateNarration(
  deps: NarrationDeps,
  params: GenerateNarrationParams
): Promise<NarrationOutcome> {
  const language = params.language ?? 'fr';
  const { features, stationId } = params;
  const windowFrom = new Date(features.window.from);
  const windowTo = new Date(features.window.to);

  const inputHash = computeInputHash({
    features,
    language,
    model: deps.llm.model,
    promptVersion: PROMPT_VERSION,
  });

  const key: InsightKey = {
    stationId,
    parameter: features.parameter,
    windowFrom,
    windowTo,
    language,
    inputHash,
  };

  const cached = await deps.store.find(key);
  if (cached) return { status: 'cached', insight: cached };

  const prompt = buildNarrationPrompt(features, language);

  let completion;
  try {
    completion = await deps.llm.complete({ system: prompt.system, user: prompt.user });
  } catch (err) {
    if (err instanceof LlmError) {
      return {
        status: 'error',
        error: {
          kind: err.kind === 'config' ? 'config' : 'llm',
          message: err.message,
          cause: err.kind,
        },
      };
    }
    return { status: 'error', error: { kind: 'llm', message: 'unexpected LLM failure' } };
  }

  const insight = await deps.store.save({
    ...key,
    text: completion.text,
    provider: deps.llm.provider,
    model: deps.llm.model,
    promptTokens: completion.promptTokens,
    completionTokens: completion.completionTokens,
    costUsd: completion.costUsd, // filled by the ObservingLlmClient decorator (D)
    latencyMs: completion.latencyMs,
  });

  return { status: 'generated', insight };
}
