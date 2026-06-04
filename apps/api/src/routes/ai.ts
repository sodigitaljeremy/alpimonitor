import type { FastifyPluginAsync } from 'fastify';

import type { AiStatusResponse } from '@alpimonitor/shared';

// AI layer — extension D (ADR-012). GET /api/v1/ai/status — observability of the
// LLM layer, aggregated from today's LlmCallRun rows. Non-authenticated, read-only.
// Mirrors /status: same DB-down → 503 behaviour, same parseable shape.

function startOfUtcDay(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export const aiRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ai/status', async (_req, reply) => {
    let ai: AiStatusResponse['ai'] = {
      callsToday: 0,
      errorRate: null,
      costUsdToday: 0,
      avgLatencyMs: null,
      lastCallAt: null,
    };

    try {
      const since = startOfUtcDay(new Date());

      const [agg, errorCount, latest] = await Promise.all([
        app.prisma.llmCallRun.aggregate({
          where: { createdAt: { gte: since } },
          _count: { _all: true },
          _sum: { costUsd: true },
          _avg: { latencyMs: true },
        }),
        app.prisma.llmCallRun.count({
          where: { createdAt: { gte: since }, status: 'ERROR' },
        }),
        app.prisma.llmCallRun.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      const callsToday = agg._count._all;
      ai = {
        callsToday,
        errorRate: callsToday > 0 ? errorCount / callsToday : null,
        costUsdToday: Math.round((agg._sum.costUsd ?? 0) * 1_000_000) / 1_000_000,
        avgLatencyMs: agg._avg.latencyMs !== null ? Math.round(agg._avg.latencyMs) : null,
        lastCallAt: latest?.createdAt ? latest.createdAt.toISOString() : null,
      };
    } catch (err) {
      app.log.error({ err }, 'ai/status: database probe failed');
      return reply.code(503).send({ ai });
    }

    return { ai } satisfies AiStatusResponse;
  });
};
