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
  };
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

    try {
      const [latest, latestSuccess] = await Promise.all([
        app.prisma.ingestionRun.findFirst({
          orderBy: { startedAt: 'desc' },
          select: LAST_RUN_SELECT,
        }),
        app.prisma.ingestionRun.findFirst({
          where: { status: 'SUCCESS' },
          orderBy: { startedAt: 'desc' },
          select: { completedAt: true },
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
