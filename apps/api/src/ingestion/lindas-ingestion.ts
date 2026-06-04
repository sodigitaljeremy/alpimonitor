// Orchestrates one ingestion pass:
//   fetch → parse → archive → upsert Sensor/Measurement → record IngestionRun.
//
// Pure of Fastify/HTTP server concerns: takes a prisma client, a fetcher
// and an archive writer as dependencies, so it runs under Vitest with
// fully in-memory stubs.

import { createHash } from 'node:crypto';

import type { FastifyBaseLogger } from 'fastify';

import {
  HYDRO_SPARQL_QUERY,
  LINDAS_ENDPOINT,
  type SparqlFetcher,
  fetchLindasSparql,
} from './lindas-client.js';
import { buildStation, type ParsedStation, type SparqlResults } from './lindas-parser.js';
import type { ArchiveWriter } from './archive.js';

// Prisma types are pulled structurally so the module unit-tests without a
// real @prisma/client in scope.
export interface IngestionPrismaClient {
  station: {
    findMany(args: {
      where: { ofevCode: { in: string[] }; dataSource: 'LIVE' };
      select: { id: true; ofevCode: true };
    }): Promise<Array<{ id: string; ofevCode: string }>>;
  };
  sensor: {
    upsert(args: {
      where: { stationId_parameter: { stationId: string; parameter: 'DISCHARGE' | 'WATER_LEVEL' } };
      create: {
        stationId: string;
        parameter: 'DISCHARGE' | 'WATER_LEVEL';
        unit: string;
      };
      update: Record<string, never>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  measurement: {
    // Bulk insert with skipDuplicates: the `count` returned is the number of
    // rows ACTUALLY inserted (idempotent re-seen rows are skipped, not counted).
    // This is what makes measurementsCreatedCount honest.
    createMany(args: {
      data: Array<{ sensorId: string; recordedAt: Date; value: number }>;
      skipDuplicates: boolean;
    }): Promise<{ count: number }>;
  };
  ingestionRun: {
    create(args: {
      data: {
        source: 'LINDAS_HYDRO';
        startedAt: Date;
        completedAt: Date;
        status: 'SUCCESS' | 'PARTIAL' | 'FAILURE';
        stationsSeenCount: number;
        measurementsCreatedCount: number;
        measurementsUnchangedCount: number;
        measurementsSkippedCount: number;
        errorMessage?: string | null;
        httpStatus?: number | null;
        payloadBytes?: number | null;
        payloadHash?: string | null;
        durationMs: number;
      };
    }): Promise<{ id: string }>;
  };
}

export interface IngestionDeps {
  prisma: IngestionPrismaClient;
  fetcher?: SparqlFetcher;
  archive: ArchiveWriter;
  logger: FastifyBaseLogger;
  now?: () => Date;
}

export interface IngestionResult {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILURE';
  stationsSeenCount: number;
  measurementsCreatedCount: number;
  measurementsUnchangedCount: number;
  measurementsSkippedCount: number;
  durationMs: number;
  payloadHash: string | null;
  errorMessage: string | null;
}

const PARAMS_FROM_OBSERVATION: Array<{
  parameter: 'DISCHARGE' | 'WATER_LEVEL';
  unit: string;
  pick: (s: ParsedStation) => number | null;
}> = [
  { parameter: 'DISCHARGE', unit: 'm3/s', pick: (s) => s.dischargeMeasured },
  { parameter: 'WATER_LEVEL', unit: 'm', pick: (s) => s.waterLevelMeasured },
];

export async function runLindasIngestion(deps: IngestionDeps): Promise<IngestionResult> {
  const fetcher = deps.fetcher ?? fetchLindasSparql;
  const now = deps.now ?? (() => new Date());
  const startedAt = now();
  const log = deps.logger;

  let httpStatus: number | null = null;
  let payloadBytes: number | null = null;
  let payloadHash: string | null = null;
  let stationsSeenCount = 0;
  let measurementsCreatedCount = 0;
  let measurementsUnchangedCount = 0;
  let measurementsSkippedCount = 0;

  try {
    const fetched = await fetcher(HYDRO_SPARQL_QUERY);
    httpStatus = fetched.httpStatus;
    payloadBytes = fetched.bytes;
    payloadHash = createHash('sha256').update(fetched.body).digest('hex');

    // Archive on disk. A write failure is logged but does not fail the run —
    // the DB side still converges.
    try {
      await deps.archive.write(fetched.body, payloadHash, startedAt);
    } catch (err) {
      log.warn({ err }, 'lindas-ingestion: archive write failed (non-fatal)');
    }

    let parsed: SparqlResults;
    try {
      parsed = JSON.parse(fetched.body) as SparqlResults;
    } catch (err) {
      throw new Error(`LINDAS response was not JSON: ${(err as Error).message}`);
    }

    const allStations: ParsedStation[] = [];
    for (const row of parsed.results.bindings) {
      const s = buildStation(row, startedAt);
      if (s) allStations.push(s);
      else measurementsSkippedCount++;
    }

    // Only reconcile stations we actually know as LIVE. RESEARCH and SEED
    // stations stay untouched — their sensors/measurements are out of scope
    // for this source.
    const codes = Array.from(new Set(allStations.map((s) => s.ofevCode)));
    const liveStations = await deps.prisma.station.findMany({
      where: { ofevCode: { in: codes }, dataSource: 'LIVE' },
      select: { id: true, ofevCode: true },
    });
    const byCode = new Map(liveStations.map((s) => [s.ofevCode, s.id]));
    stationsSeenCount = liveStations.length;

    // Phase 1 — resolve sensors and collect the rows to insert. Sensor upserts
    // are few (≤ 2 per LIVE station) and idempotent; a failure here skips just
    // that row.
    const rows: Array<{ sensorId: string; recordedAt: Date; value: number }> = [];
    for (const parsedStation of allStations) {
      const stationId = byCode.get(parsedStation.ofevCode);
      if (!stationId) continue;
      const recordedAt = new Date(parsedStation.lastMeasurementAt);

      for (const spec of PARAMS_FROM_OBSERVATION) {
        const value = spec.pick(parsedStation);
        if (value === null) continue;
        try {
          const sensor = await deps.prisma.sensor.upsert({
            where: {
              stationId_parameter: { stationId, parameter: spec.parameter },
            },
            create: { stationId, parameter: spec.parameter, unit: spec.unit },
            update: {},
            select: { id: true },
          });
          rows.push({ sensorId: sensor.id, recordedAt, value });
        } catch (err) {
          measurementsSkippedCount++;
          log.warn(
            { err, ofevCode: parsedStation.ofevCode, parameter: spec.parameter },
            'lindas-ingestion: sensor upsert failed (row skipped)'
          );
        }
      }
    }

    // Phase 2 — one bulk insert. `count` is the number truly inserted; the rest
    // were idempotent re-seen rows (same {sensorId, recordedAt}) → "unchanged".
    if (rows.length > 0) {
      try {
        const { count } = await deps.prisma.measurement.createMany({
          data: rows,
          skipDuplicates: true,
        });
        measurementsCreatedCount = count;
        measurementsUnchangedCount = rows.length - count;
      } catch (err) {
        measurementsSkippedCount += rows.length;
        log.warn({ err }, 'lindas-ingestion: measurement bulk insert failed (rows skipped)');
      }
    }

    const completedAt = now();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const status: IngestionResult['status'] = measurementsSkippedCount > 0 ? 'PARTIAL' : 'SUCCESS';

    await deps.prisma.ingestionRun.create({
      data: {
        source: 'LINDAS_HYDRO',
        startedAt,
        completedAt,
        status,
        stationsSeenCount,
        measurementsCreatedCount,
        measurementsUnchangedCount,
        measurementsSkippedCount,
        httpStatus,
        payloadBytes,
        payloadHash,
        durationMs,
      },
    });

    const logPayload = {
      source: 'LINDAS_HYDRO',
      status,
      stationsSeenCount,
      measurementsCreatedCount,
      measurementsUnchangedCount,
      measurementsSkippedCount,
      durationMs,
      endpoint: LINDAS_ENDPOINT,
    };
    if (status === 'SUCCESS') log.info(logPayload, 'lindas-ingestion: success');
    else log.warn(logPayload, 'lindas-ingestion: partial');

    return {
      status,
      stationsSeenCount,
      measurementsCreatedCount,
      measurementsUnchangedCount,
      measurementsSkippedCount,
      durationMs,
      payloadHash,
      errorMessage: null,
    };
  } catch (err) {
    const completedAt = now();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const errorMessage = err instanceof Error ? err.message : String(err);
    const statusFromErr = (err as { httpStatus?: number }).httpStatus ?? httpStatus;

    try {
      await deps.prisma.ingestionRun.create({
        data: {
          source: 'LINDAS_HYDRO',
          startedAt,
          completedAt,
          status: 'FAILURE',
          stationsSeenCount,
          measurementsCreatedCount,
          measurementsUnchangedCount,
          measurementsSkippedCount,
          errorMessage,
          httpStatus: statusFromErr ?? null,
          payloadBytes,
          payloadHash,
          durationMs,
        },
      });
    } catch (traceErr) {
      log.error({ err: traceErr }, 'lindas-ingestion: could not persist FAILURE trace');
    }

    log.error({ err, durationMs, endpoint: LINDAS_ENDPOINT }, 'lindas-ingestion: failure');

    return {
      status: 'FAILURE',
      stationsSeenCount,
      measurementsCreatedCount,
      measurementsUnchangedCount,
      measurementsSkippedCount,
      durationMs,
      payloadHash,
      errorMessage,
    };
  }
}
