import { z } from 'zod';

import { PARAMETER_VALUES } from './stations.js';

// GET /api/v1/stations/:id/narrative
// Per-parameter narration (parameter is required, unlike the measurements
// endpoint where it is an optional filter). Language is parameterised, FR default.
export const stationNarrativeQuerySchema = z
  .object({
    parameter: z.enum(PARAMETER_VALUES),
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    lang: z
      .string()
      .min(2)
      .max(5)
      .optional()
      .transform((v) => v ?? 'fr'),
  })
  .refine((q) => new Date(q.from).getTime() < new Date(q.to).getTime(), {
    message: 'from must be strictly before to',
    path: ['from'],
  });

export type StationNarrativeQuery = z.infer<typeof stationNarrativeQuerySchema>;
