import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { ZodError } from 'zod';

import { listAlertsQuerySchema } from '../schemas/alerts.js';
import { listAlerts } from '../services/alerts-service.js';

// AI layer — extension B3 (ADR-012). GET /api/v1/alerts — read-only list of
// statistical anomaly episodes. Same envelope and validation pattern as
// routes/stations.ts: `{ data }` on success, `{ error }` on a bad request.

function validationError(reply: FastifyReply, err: ZodError): FastifyReply {
  return reply.code(400).send({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: err.issues,
    },
  });
}

export const alertsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/alerts', async (req, reply) => {
    const parsed = listAlertsQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const data = await listAlerts(app.prisma, parsed.data);
    return { data };
  });
};
