import fastifyCors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

import { ingestionPlugin } from './plugins/ingestion.js';
import { prismaPlugin } from './plugins/prisma.js';
import { uptimePlugin } from './plugins/uptime.js';
import { healthRoutes } from './routes/health.js';
import { stationsRoutes } from './routes/stations.js';
import { statusRoutes } from './routes/status.js';

// Dev fallback mirrors the Vite dev server port. Prod is driven by
// CORS_ORIGINS (comma-separated) injected by Coolify.
const DEFAULT_DEV_ORIGIN = 'http://localhost:5173';

export function parseCorsOrigins(raw: string | undefined): string[] {
  const source = raw && raw.trim() !== '' ? raw : DEFAULT_DEV_ORIGIN;
  return source
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  await server.register(fastifyCors, {
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
  });

  await server.register(uptimePlugin);
  await server.register(prismaPlugin);
  await server.register(ingestionPlugin);
  await server.register(healthRoutes, { prefix: '/api/v1' });
  await server.register(statusRoutes, { prefix: '/api/v1' });
  await server.register(stationsRoutes, { prefix: '/api/v1' });

  return server;
}
