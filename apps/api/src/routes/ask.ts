import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { ZodError } from 'zod';

import type { AskResponseDTO } from '@alpimonitor/shared';

import { createChatService } from '../ai/chat/chat-service.js';
import { PrismaQueryAdapter } from '../ai/chat/prisma-query-adapter.js';
import { createRateGuard, type RateGuardRefusalReason } from '../ai/chat/rate-guard.js';
import { LlmError } from '../ai/llm-client.js';
import { askRequestSchema } from '../schemas/ask.js';

// AI layer — extension C5 (ADR-012 §« Cadrage détaillé extension C »). The public,
// LLM-backed chat endpoint — the single most sensitive surface in the AI layer, so
// every guard from C1–C4 converges here, in order:
//
//   1. Rate-guard (C4) on the caller IP — refusal short-circuits to 429 BEFORE any
//      body parsing or LLM call (the daily cost cap is checked here too, read-only).
//   2. Zod body validation — a malformed request is a real 400.
//   3. Chat service (C3) over the QueryPort (C1) and the observed LLM client (D) —
//      200 with the grounded answer + tool trace.
//   4. An LlmError degrades GRACEFULLY to a clean 503 ("service IA indisponible"),
//      never a raw 500 — same discipline as the narration endpoint (A).
//
// The rate-guard is instantiated ONCE per plugin registration so its per-IP windows
// are shared across requests; the chat service and adapter are likewise built once.

function validationError(reply: FastifyReply, err: ZodError): FastifyReply {
  return reply.code(400).send({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: err.issues,
    },
  });
}

function startOfUtcDay(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Today's TOTAL LLM cost (narration A + chat C), read from the SAME observability
// source as GET /ai/status (extension D). Read-only: the cost cap consumes nothing.
async function getCostUsdToday(prisma: PrismaClient): Promise<number> {
  const agg = await prisma.llmCallRun.aggregate({
    where: { createdAt: { gte: startOfUtcDay(new Date()) } },
    _sum: { costUsd: true },
  });
  return agg._sum.costUsd ?? 0;
}

const REFUSAL_MESSAGES: Record<RateGuardRefusalReason, string> = {
  cost_cap: 'Le budget quotidien du service IA est atteint. Réessayez demain.',
  rate_minute: 'Trop de requêtes. Patientez quelques instants avant de réessayer.',
  rate_day: 'Quota quotidien de requêtes atteint pour votre adresse.',
};

export const askRoutes: FastifyPluginAsync = async (app) => {
  // Instantiated once: shared per-IP state, single QueryPort/chat service.
  const rateGuard = createRateGuard({
    now: () => new Date(),
    getCostUsdToday: () => getCostUsdToday(app.prisma),
  });
  const queryPort = new PrismaQueryAdapter(app.prisma);
  const chatService = createChatService({ llm: app.llm, queryPort });

  app.post('/ask', async (req, reply) => {
    // 1. Rate + cost guard on the caller IP, before anything is parsed or spent.
    const decision = await rateGuard.check(req.ip);
    if (!decision.ok) {
      reply.header('Retry-After', String(decision.retryAfterSec));
      return reply.code(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: REFUSAL_MESSAGES[decision.reason],
          reason: decision.reason,
          retryAfterSec: decision.retryAfterSec,
        },
      });
    }

    // 2. Body validation.
    const parsed = askRequestSchema.safeParse(req.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    // 3. Grounded chat. 4. LlmError → graceful 503.
    try {
      const result = await chatService.ask(parsed.data.question, {
        language: parsed.data.language,
      });
      return {
        answer: result.answer,
        used: result.used,
        language: parsed.data.language ?? 'fr',
        generatedAt: new Date().toISOString(),
      } satisfies AskResponseDTO;
    } catch (err) {
      if (err instanceof LlmError) {
        app.log.warn({ err }, 'ask: AI layer unavailable');
        return reply.code(503).send({
          error: {
            code: 'AI_UNAVAILABLE',
            message: 'Le service IA est momentanément indisponible.',
          },
        });
      }
      throw err;
    }
  });
};
