import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    const timestamp = new Date().toISOString();

    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', timestamp, database: 'ok' };
    } catch (err) {
      app.log.error({ err }, 'health: database check failed');
      return reply.code(503).send({ status: 'degraded', timestamp, database: 'error' });
    }
  });
};
