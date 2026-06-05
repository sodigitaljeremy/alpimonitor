import { z } from 'zod';

import { ALERT_STATUS_VALUES } from '../../schemas/alerts.js';
import { PARAMETER_VALUES } from '../../schemas/stations.js';
import type { LlmToolDef } from '../llm-client.js';
import type { QueryPort } from './query-port.js';

// AI layer — extension C3a (ADR-012 D6). The bridge between the LLM's
// function-calling and the QueryPort whitelist:
//   1. CHAT_TOOLS — the four tool specs (JSON Schema) handed to the model.
//   2. createToolDispatcher — routes a tool call (name + raw JSON args) to the
//      matching QueryPort method, AFTER validating the arguments with Zod.
//
// The dispatcher NEVER throws on bad model output: invalid JSON or arguments
// become a STRUCTURED error result so the LLM can read it and self-correct on the
// next round (D5). Only the four whitelisted functions exist — there is no
// text-to-SQL, no free-form query (D6, garde-fous transverses).

// --- Time resolution -------------------------------------------------------
//
// The QueryPort speaks absolute domain time (`from`/`to` as Date). The model,
// however, must never invent ISO timestamps — it expresses a window as a count
// of hours ending "now", and THIS layer resolves it to absolute dates (see the
// MeasurementStatsQuery comment in query-port.ts).
const DEFAULT_PERIOD_HOURS = 24;
const MAX_PERIOD_HOURS = 8_760; // one year — a hard cap on what the model can ask

export type ChatToolName =
  | 'find_stations'
  | 'get_latest_measurements'
  | 'get_measurement_stats'
  | 'list_alerts';

// --- Tool specs handed to the model (D6) -----------------------------------

export const CHAT_TOOLS: LlmToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'find_stations',
      description:
        "Résout un nom de station ou de rivière vers son identité (id, nom, rivière, source, paramètres disponibles), SANS aucune valeur mesurée. À appeler en premier pour obtenir l'id d'une station avant de demander ses valeurs.",
      parameters: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description:
              'Fragment de nom de station ou de rivière (insensible à la casse, sous-chaîne). Omis → toutes les stations.',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_latest_measurements',
      description:
        'Dernière valeur mesurée par paramètre pour une station (valeur, unité, statut, horodatage). Nécessite un id de station obtenu via find_stations.',
      parameters: {
        type: 'object',
        properties: {
          stationId: {
            type: 'string',
            description: 'Identifiant de station (champ id renvoyé par find_stations).',
          },
        },
        required: ['stationId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_measurement_stats',
      description:
        "Agrégat d'un paramètre sur une fenêtre récente se terminant maintenant : valeur initiale/finale, min, max, moyenne, variation absolue et en %, taille d'échantillon. Renvoie null si aucune donnée dans la fenêtre.",
      parameters: {
        type: 'object',
        properties: {
          stationId: {
            type: 'string',
            description: 'Identifiant de station (champ id renvoyé par find_stations).',
          },
          parameter: {
            type: 'string',
            enum: [...PARAMETER_VALUES],
            description: 'Paramètre hydrologique à agréger.',
          },
          periodHours: {
            type: 'integer',
            minimum: 1,
            maximum: MAX_PERIOD_HOURS,
            description: `Durée de la fenêtre en heures, se terminant maintenant (défaut ${DEFAULT_PERIOD_HOURS}).`,
          },
        },
        required: ['stationId', 'parameter'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_alerts',
      description:
        "Liste les épisodes d'anomalie statistique détectés. Filtrable par état (open|closed|all, défaut open) et par station.",
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: [...ALERT_STATUS_VALUES],
            description: "État des épisodes (défaut 'open' : seuls les épisodes en cours).",
          },
          stationId: {
            type: 'string',
            description: 'Restreint à une station (champ id renvoyé par find_stations).',
          },
        },
        additionalProperties: false,
      },
    },
  },
];

// --- Argument validation (Zod, aligned with the project's schema style) -----

const findStationsArgs = z.object({
  search: z.string().trim().min(1).optional(),
});

const latestMeasurementsArgs = z.object({
  stationId: z.string().min(1),
});

const measurementStatsArgs = z.object({
  stationId: z.string().min(1),
  parameter: z.enum(PARAMETER_VALUES),
  periodHours: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PERIOD_HOURS)
    .optional()
    .transform((v) => v ?? DEFAULT_PERIOD_HOURS),
});

const listAlertsArgs = z.object({
  status: z
    .enum(ALERT_STATUS_VALUES)
    .optional()
    .transform((v) => v ?? 'open'),
  stationId: z.string().min(1).optional(),
});

// --- Dispatch result -------------------------------------------------------
//
// Serialised verbatim into the `tool` message content (chat-service, C3b). An
// error result is data the model is meant to READ and recover from, not an
// exception — so a wrong tool call costs a round, never a crash.
export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: 'invalid_json' | 'invalid_arguments' | 'unknown_tool'; message: string };

export interface ToolDispatcherDeps {
  queryPort: QueryPort;
  // Injectable clock so windowed stats resolve deterministically in tests.
  now?: () => Date;
}

export interface ToolDispatcher {
  dispatch(call: { name: string; arguments: string }): Promise<ToolResult>;
}

function invalidArguments(error: z.ZodError): ToolResult {
  // Compact, model-readable reason — enough to self-correct, not a stack trace.
  const message = error.issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
  return { ok: false, error: 'invalid_arguments', message };
}

// Parse the raw JSON arguments string the model emitted. An empty string means
// "no arguments" (a valid call to a no-required-arg tool), not an error.
function parseRawArgs(
  raw: string
): { ok: true; value: unknown } | { ok: false; result: ToolResult } {
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '') return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return {
      ok: false,
      result: { ok: false, error: 'invalid_json', message: 'arguments were not valid JSON' },
    };
  }
}

export function createToolDispatcher(deps: ToolDispatcherDeps): ToolDispatcher {
  const { queryPort } = deps;
  const now = deps.now ?? (() => new Date());

  return {
    async dispatch(call): Promise<ToolResult> {
      const parsed = parseRawArgs(call.arguments);
      if (!parsed.ok) return parsed.result;
      const rawArgs = parsed.value;

      switch (call.name) {
        case 'find_stations': {
          const args = findStationsArgs.safeParse(rawArgs);
          if (!args.success) return invalidArguments(args.error);
          return { ok: true, data: await queryPort.findStations(args.data) };
        }

        case 'get_latest_measurements': {
          const args = latestMeasurementsArgs.safeParse(rawArgs);
          if (!args.success) return invalidArguments(args.error);
          return { ok: true, data: await queryPort.getLatestMeasurements(args.data) };
        }

        case 'get_measurement_stats': {
          const args = measurementStatsArgs.safeParse(rawArgs);
          if (!args.success) return invalidArguments(args.error);
          const to = now();
          const from = new Date(to.getTime() - args.data.periodHours * 3_600_000);
          return {
            ok: true,
            data: await queryPort.getMeasurementStats({
              stationId: args.data.stationId,
              parameter: args.data.parameter,
              from,
              to,
            }),
          };
        }

        case 'list_alerts': {
          const args = listAlertsArgs.safeParse(rawArgs);
          if (!args.success) return invalidArguments(args.error);
          return { ok: true, data: await queryPort.listAlerts(args.data) };
        }

        default:
          return {
            ok: false,
            error: 'unknown_tool',
            message: `no whitelisted function named "${call.name}"`,
          };
      }
    },
  };
}
