import type { FastifyPluginAsync } from 'fastify';

// Default threshold: an ingestion is considered healthy if a SUCCESS run
// occurred in the last 30 minutes. The cron ticks every 10 min, so this
// leaves room for two consecutive misses before the frontend badge turns red.
const DEFAULT_HEALTHY_THRESHOLD_MINUTES = 30;

const LAST_RUN_SELECT = {
  source: true,
  status: true,
  startedAt: true,
  completedAt: true,
  stationsSeenCount: true,
  measurementsCreatedCount: true,
  durationMs: true,
} as const;

type DbStatus = 'ok' | 'error';

interface TodayStats {
  runsCount: number;
  measurementsCreatedSum: number;
  // null when no run has happened yet today — avoids showing a misleading
  // "0% success rate" the morning after a quiet night.
  successRate: number | null;
}

interface StatusResponse {
  api: { status: 'ok'; uptimeSeconds: number };
  database: { status: DbStatus };
  ingestion: {
    lastRun: {
      source: string;
      status: string;
      startedAt: string;
      completedAt: string | null;
      stationsSeenCount: number;
      measurementsCreatedCount: number;
      durationMs: number | null;
    } | null;
    lastSuccessAt: string | null;
    healthyThresholdMinutes: number;
    today: TodayStats;
  };
}

function startOfUtcDay(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export const statusRoutes: FastifyPluginAsync = async (app) => {
  const healthyThresholdMinutes = Number(
    process.env.INGESTION_HEALTHY_THRESHOLD_MINUTES ?? DEFAULT_HEALTHY_THRESHOLD_MINUTES
  );

  app.get('/status', async (_req, reply) => {
    const uptimeSeconds = Math.round((Date.now() - app.startedAt.getTime()) / 1000);

    let databaseStatus: DbStatus = 'ok';
    let lastRun: StatusResponse['ingestion']['lastRun'] = null;
    let lastSuccessAt: string | null = null;
    let today: TodayStats = { runsCount: 0, measurementsCreatedSum: 0, successRate: null };

    try {
      const since = startOfUtcDay(new Date());

      const [latest, latestSuccess, todayAgg, todaySuccessCount] = await Promise.all([
        app.prisma.ingestionRun.findFirst({
          orderBy: { startedAt: 'desc' },
          select: LAST_RUN_SELECT,
        }),
        app.prisma.ingestionRun.findFirst({
          where: { status: 'SUCCESS' },
          orderBy: { startedAt: 'desc' },
          select: { completedAt: true },
        }),
        app.prisma.ingestionRun.aggregate({
          where: { startedAt: { gte: since } },
          _count: { _all: true },
          _sum: { measurementsCreatedCount: true },
        }),
        app.prisma.ingestionRun.count({
          where: { startedAt: { gte: since }, status: 'SUCCESS' },
        }),
      ]);

      if (latest) {
        lastRun = {
          source: latest.source,
          status: latest.status,
          startedAt: latest.startedAt.toISOString(),
          completedAt: latest.completedAt ? latest.completedAt.toISOString() : null,
          stationsSeenCount: latest.stationsSeenCount,
          measurementsCreatedCount: latest.measurementsCreatedCount,
          durationMs: latest.durationMs,
        };
      }

      if (latestSuccess?.completedAt) {
        lastSuccessAt = latestSuccess.completedAt.toISOString();
      }

      const runsCount = todayAgg._count._all;
      today = {
        runsCount,
        measurementsCreatedSum: todayAgg._sum.measurementsCreatedCount ?? 0,
        successRate: runsCount > 0 ? todaySuccessCount / runsCount : null,
      };
    } catch (err) {
      app.log.error({ err }, 'status: database probe failed');
      databaseStatus = 'error';
    }

    const body: StatusResponse = {
      api: { status: 'ok', uptimeSeconds },
      database: { status: databaseStatus },
      ingestion: {
        lastRun,
        lastSuccessAt,
        healthyThresholdMinutes,
        today,
      },
    };

    // 503 when the DB is down so curl exit codes / uptime monitors still
    // pick this up; payload is the same shape so the UI always parses.
    if (databaseStatus === 'error') {
      return reply.code(503).send(body);
    }
    return body;
  });
};
