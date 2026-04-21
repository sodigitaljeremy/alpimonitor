import Fastify, { type FastifyInstance } from 'fastify';

import { ingestionPlugin } from './plugins/ingestion.js';
import { prismaPlugin } from './plugins/prisma.js';
import { uptimePlugin } from './plugins/uptime.js';
import { healthRoutes } from './routes/health.js';
import { statusRoutes } from './routes/status.js';

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  await server.register(uptimePlugin);
  await server.register(prismaPlugin);
  await server.register(ingestionPlugin);
  await server.register(healthRoutes, { prefix: '/api/v1' });
  await server.register(statusRoutes, { prefix: '/api/v1' });

  return server;
}
