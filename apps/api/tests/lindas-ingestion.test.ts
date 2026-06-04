import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { ArchiveWriter } from '../src/ingestion/archive.js';
import {
  type IngestionPrismaClient,
  runLindasIngestion,
} from '../src/ingestion/lindas-ingestion.js';
import type { SparqlFetcher } from '../src/ingestion/lindas-client.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(resolve(here, '__fixtures__/lindas-hydro.json'), 'utf-8');

// Silence fastify logger usage in tests.
const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {},
  child: () => noopLogger,
  level: 'silent',
} as unknown as Parameters<typeof runLindasIngestion>[0]['logger'];

function makeArchive(): ArchiveWriter & { writes: number; pruned: number } {
  let writes = 0;
  let pruned = 0;
  return {
    async write() {
      writes++;
      return '/tmp/fake-archive.json.gz';
    },
    async prune() {
      pruned++;
      return 0;
    },
    get writes() {
      return writes;
    },
    get pruned() {
      return pruned;
    },
  };
}

interface CapturedRun {
  source: string;
  status: string;
  stationsSeenCount: number;
  measurementsCreatedCount: number;
  measurementsUnchangedCount: number;
  measurementsSkippedCount: number;
  errorMessage?: string | null;
  httpStatus?: number | null;
  payloadBytes?: number | null;
  payloadHash?: string | null;
  durationMs: number;
}

function makePrisma(options: {
  liveCodes: string[];
  // 'throw' simulates a bulk-insert DB failure; `duplicates` simulates rows
  // skipped by skipDuplicates (already present → unchanged, not created).
  createManyBehavior?: 'ok' | 'throw';
  duplicates?: number;
}): {
  client: IngestionPrismaClient;
  captured: CapturedRun[];
  sensorUpserts: number;
  rowsInserted: number;
} {
  const captured: CapturedRun[] = [];
  let sensorCalls = 0;
  let rowsInserted = 0;

  const client: IngestionPrismaClient = {
    station: {
      async findMany({ where }) {
        return options.liveCodes
          .filter((c) => where.ofevCode.in.includes(c))
          .map((c) => ({ id: `station-${c}`, ofevCode: c }));
      },
    },
    sensor: {
      async upsert({ where }) {
        sensorCalls++;
        return {
          id: `sensor-${where.stationId_parameter.stationId}-${where.stationId_parameter.parameter}`,
        };
      },
    },
    measurement: {
      async createMany({ data }) {
        if (options.createManyBehavior === 'throw') {
          throw new Error('simulated bulk insert failure');
        }
        const dup = options.duplicates ?? 0;
        const count = Math.max(0, data.length - dup);
        rowsInserted += count;
        return { count };
      },
    },
    ingestionRun: {
      async create({ data }) {
        captured.push(data as CapturedRun);
        return { id: `run-${captured.length}` };
      },
    },
  };

  return {
    client,
    captured,
    get sensorUpserts() {
      return sensorCalls;
    },
    get rowsInserted() {
      return rowsInserted;
    },
  };
}

describe('runLindasIngestion', () => {
  it('returns SUCCESS and records an IngestionRun with matching counts', async () => {
    const fetcher: SparqlFetcher = async () => ({
      body: FIXTURE,
      bytes: FIXTURE.length,
      httpStatus: 200,
    });
    const prisma = makePrisma({ liveCodes: ['2346', '2011', '2630', '2009'] });
    const archive = makeArchive();

    const result = await runLindasIngestion({
      prisma: prisma.client,
      fetcher,
      archive,
      logger: noopLogger,
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.stationsSeenCount).toBe(4);
    // 4 stations × (discharge + waterLevel) = 8, minus any row without the
    // optional binding. All 4 priority stations expose both in the fixture.
    expect(result.measurementsCreatedCount).toBe(8);
    expect(result.measurementsUnchangedCount).toBe(0);
    expect(result.measurementsSkippedCount).toBe(0);
    expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/);

    expect(prisma.captured).toHaveLength(1);
    expect(prisma.captured[0]!).toMatchObject({
      source: 'LINDAS_HYDRO',
      status: 'SUCCESS',
      stationsSeenCount: 4,
      measurementsCreatedCount: 8,
      measurementsUnchangedCount: 0,
      measurementsSkippedCount: 0,
      httpStatus: 200,
    });
    expect(prisma.captured[0]!.payloadBytes).toBe(FIXTURE.length);

    expect(archive.writes).toBe(1);
    expect(prisma.sensorUpserts).toBe(8);
    expect(prisma.rowsInserted).toBe(8);
  });

  it('counts idempotent re-seen rows as unchanged, not created', async () => {
    const fetcher: SparqlFetcher = async () => ({
      body: FIXTURE,
      bytes: FIXTURE.length,
      httpStatus: 200,
    });
    // All 8 rows already exist → skipDuplicates skips them all.
    const prisma = makePrisma({ liveCodes: ['2346', '2011', '2630', '2009'], duplicates: 8 });
    const archive = makeArchive();

    const result = await runLindasIngestion({
      prisma: prisma.client,
      fetcher,
      archive,
      logger: noopLogger,
    });

    expect(result.status).toBe('SUCCESS'); // no skips → still SUCCESS
    expect(result.measurementsCreatedCount).toBe(0);
    expect(result.measurementsUnchangedCount).toBe(8);
    expect(result.measurementsSkippedCount).toBe(0);
  });

  it('skips stations whose ofevCode is not marked LIVE', async () => {
    const fetcher: SparqlFetcher = async () => ({
      body: FIXTURE,
      bytes: FIXTURE.length,
      httpStatus: 200,
    });
    const prisma = makePrisma({ liveCodes: ['2011'] });
    const archive = makeArchive();

    const result = await runLindasIngestion({
      prisma: prisma.client,
      fetcher,
      archive,
      logger: noopLogger,
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.stationsSeenCount).toBe(1);
    expect(result.measurementsCreatedCount).toBe(2); // discharge + waterLevel
  });

  it('records PARTIAL when the bulk insert fails', async () => {
    const fetcher: SparqlFetcher = async () => ({
      body: FIXTURE,
      bytes: FIXTURE.length,
      httpStatus: 200,
    });
    const prisma = makePrisma({
      liveCodes: ['2346', '2011', '2630', '2009'],
      createManyBehavior: 'throw',
    });
    const archive = makeArchive();

    const result = await runLindasIngestion({
      prisma: prisma.client,
      fetcher,
      archive,
      logger: noopLogger,
    });

    expect(result.status).toBe('PARTIAL');
    expect(result.measurementsCreatedCount).toBe(0);
    expect(result.measurementsSkippedCount).toBe(8); // whole batch skipped
    expect(prisma.captured[0]!.status).toBe('PARTIAL');
  });

  it('records FAILURE with errorMessage when LINDAS fetch throws', async () => {
    const failingFetcher: SparqlFetcher = async () => {
      const err = new Error('LINDAS SPARQL failed: HTTP 503 Service Unavailable') as Error & {
        httpStatus: number;
      };
      err.httpStatus = 503;
      throw err;
    };
    const prisma = makePrisma({ liveCodes: ['2011'] });
    const archive = makeArchive();

    const result = await runLindasIngestion({
      prisma: prisma.client,
      fetcher: failingFetcher,
      archive,
      logger: noopLogger,
    });

    expect(result.status).toBe('FAILURE');
    expect(result.errorMessage).toContain('503');
    expect(prisma.captured[0]!).toMatchObject({
      source: 'LINDAS_HYDRO',
      status: 'FAILURE',
      httpStatus: 503,
      stationsSeenCount: 0,
      measurementsCreatedCount: 0,
    });
    // No archive write on failure.
    expect(archive.writes).toBe(0);
  });

  it('records FAILURE when the response is not valid JSON', async () => {
    const fetcher: SparqlFetcher = async () => ({
      body: '<html>oops</html>',
      bytes: 17,
      httpStatus: 200,
    });
    const prisma = makePrisma({ liveCodes: ['2011'] });
    const archive = makeArchive();

    const result = await runLindasIngestion({
      prisma: prisma.client,
      fetcher,
      archive,
      logger: noopLogger,
    });

    expect(result.status).toBe('FAILURE');
    expect(result.errorMessage).toContain('not JSON');
    expect(prisma.captured[0]!.status).toBe('FAILURE');
    // Archive is written before parsing, so the raw body is captured for debug.
    expect(archive.writes).toBe(1);
  });

  it('still records an IngestionRun even if archive write fails', async () => {
    const fetcher: SparqlFetcher = async () => ({
      body: FIXTURE,
      bytes: FIXTURE.length,
      httpStatus: 200,
    });
    const prisma = makePrisma({ liveCodes: ['2011'] });
    const flakyArchive: ArchiveWriter = {
      write: vi.fn().mockRejectedValue(new Error('disk full')),
      prune: vi.fn().mockResolvedValue(0),
    };

    const result = await runLindasIngestion({
      prisma: prisma.client,
      fetcher,
      archive: flakyArchive,
      logger: noopLogger,
    });

    expect(result.status).toBe('SUCCESS');
    expect(prisma.captured).toHaveLength(1);
    expect(flakyArchive.write).toHaveBeenCalledTimes(1);
  });
});
