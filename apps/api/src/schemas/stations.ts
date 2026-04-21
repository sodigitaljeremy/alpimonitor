import { z } from 'zod';

export const PARAMETER_VALUES = ['DISCHARGE', 'WATER_LEVEL', 'TEMPERATURE', 'TURBIDITY'] as const;
export const AGGREGATE_VALUES = ['raw', 'hourly', 'daily'] as const;

// GET /api/v1/stations
export const listStationsQuerySchema = z.object({
  catchmentId: z.string().min(1).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? true : v === 'true')),
});

export type ListStationsQuery = z.infer<typeof listStationsQuerySchema>;

// GET /api/v1/stations/:id/measurements
export const stationMeasurementsQuerySchema = z
  .object({
    parameter: z.enum(PARAMETER_VALUES).optional(),
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    aggregate: z.enum(AGGREGATE_VALUES).optional(),
  })
  .refine((q) => new Date(q.from).getTime() < new Date(q.to).getTime(), {
    message: 'from must be strictly before to',
    path: ['from'],
  });

export type StationMeasurementsQuery = z.infer<typeof stationMeasurementsQuerySchema>;
