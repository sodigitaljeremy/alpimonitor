import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { ZodError } from 'zod';

import { listStationsQuerySchema, stationMeasurementsQuerySchema } from '../schemas/stations.js';
import {
  getStationMeasurements,
  listStations,
  StationNotFoundError,
} from '../services/stations-service.js';

// Matches the error envelope in api-contracts.md §2. Kept local until a
// global error handler is wired (US post-auth).
function validationError(reply: FastifyReply, err: ZodError): FastifyReply {
  return reply.code(400).send({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: err.issues,
    },
  });
}

export const stationsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/stations', async (req, reply) => {
    const parsed = listStationsQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const data = await listStations(app.prisma, parsed.data);
    return { data };
  });

  app.get<{ Params: { id: string } }>('/stations/:id/measurements', async (req, reply) => {
    const parsed = stationMeasurementsQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    try {
      const data = await getStationMeasurements(app.prisma, {
        stationId: req.params.id,
        parameter: parsed.data.parameter,
        from: new Date(parsed.data.from),
        to: new Date(parsed.data.to),
        aggregate: parsed.data.aggregate,
      });
      return { data };
    } catch (err) {
      if (err instanceof StationNotFoundError) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: `Station ${req.params.id} not found` },
        });
      }
      throw err;
    }
  });
};
