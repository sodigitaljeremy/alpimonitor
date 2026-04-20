import Fastify, { type FastifyInstance } from 'fastify';

import { healthRoutes } from './routes/health.js';

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  await server.register(healthRoutes, { prefix: '/api/v1' });

  return server;
}
