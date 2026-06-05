import { afterAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '@prisma/client';

import { PrismaQueryAdapter } from '../src/ai/chat/prisma-query-adapter.js';

// AI layer — extension C1 (ADR-012). Integration coverage of the ONLY Prisma-aware
// QueryPort implementation, against the dev database. Unlike the rest of the API
// suite (which mocks @prisma/client), this file talks to a real Postgres so the
// raw aggregation SQL and the service delegation are exercised end to end.
//
// It SKIPS cleanly when no dev DB is reachable (e.g. CI, which runs no Postgres) —
// the gate stays green without it. To run it locally, bring the dev DB up:
//   docker compose up -d postgres
// DATABASE_URL defaults to the dev compose credentials over localhost.

const DEV_DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://alpimonitor:alpimonitor_dev@localhost:5432/alpimonitor';

const prisma = new PrismaClient({ datasources: { db: { url: DEV_DB_URL } } });

// Probe connectivity at module-eval time (the suite already uses top-level await
// elsewhere) so describe.skipIf can decide before any test registers.
let dbAvailable = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  await prisma.$disconnect().catch(() => undefined);
}

const adapter = new PrismaQueryAdapter(prisma);

afterAll(async () => {
  if (dbAvailable) await prisma.$disconnect();
});

describe.skipIf(!dbAvailable)('PrismaQueryAdapter — integration (dev DB)', () => {
  it('find_stations returns identities WITHOUT any measured value', async () => {
    const stations = await adapter.findStations({});
    expect(stations.length).toBeGreaterThan(0);
    for (const s of stations) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.name).toBe('string');
      expect(typeof s.riverName).toBe('string');
      expect(Array.isArray(s.parameters)).toBe(true);
      // The identity leaks no values: only these five keys, ever.
      expect(Object.keys(s).sort()).toEqual(
        ['dataSource', 'id', 'name', 'parameters', 'riverName'].sort()
      );
    }
  });

  it('find_stations resolves a name fragment to a subset', async () => {
    const all = await adapter.findStations({});
    const sample = all[0]!;
    const fragment = sample.name.slice(0, 3).toLowerCase();
    const matched = await adapter.findStations({ search: fragment });
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.length).toBeLessThanOrEqual(all.length);
    expect(matched.some((s) => s.id === sample.id)).toBe(true);
  });

  it('get_latest_measurements returns values for a station that has data', async () => {
    const stations = await adapter.findStations({});
    const withData = stations.find((s) => s.parameters.length > 0);
    expect(withData, 'dev DB should have at least one station with measurements').toBeDefined();

    const latest = await adapter.getLatestMeasurements({ stationId: withData!.id });
    expect(latest.length).toBeGreaterThan(0);
    for (const m of latest) {
      expect(typeof m.value).toBe('number');
      expect(typeof m.unit).toBe('string');
      expect(typeof m.recordedAt).toBe('string');
      expect(['NORMAL', 'VIGILANCE', 'ALERT', 'OFFLINE']).toContain(m.status);
    }
  });

  it('get_latest_measurements returns [] for an unknown station id', async () => {
    expect(await adapter.getLatestMeasurements({ stationId: 'does-not-exist' })).toEqual([]);
  });

  it('get_measurement_stats computes a coherent windowed aggregate', async () => {
    const stations = await adapter.findStations({});
    const target = stations.find((s) => s.parameters.length > 0)!;
    const parameter = target.parameters[0]!;

    // Wide window covering the dev DB's imported series.
    const stats = await adapter.getMeasurementStats({
      stationId: target.id,
      parameter,
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(stats).not.toBeNull();
    expect(stats!.sampleSize).toBeGreaterThan(0);
    expect(stats!.min).toBeLessThanOrEqual(stats!.avg);
    expect(stats!.avg).toBeLessThanOrEqual(stats!.max);
    // Derived deltas are internally consistent.
    expect(stats!.deltaAbs).toBeCloseTo(stats!.last - stats!.first, 6);
    const expectedPct =
      stats!.first === 0 ? 0 : ((stats!.last - stats!.first) / stats!.first) * 100;
    expect(stats!.deltaPct).toBeCloseTo(expectedPct, 6);
  });

  it('get_measurement_stats returns null for an empty window', async () => {
    const stations = await adapter.findStations({});
    const target = stations.find((s) => s.parameters.length > 0)!;
    const stats = await adapter.getMeasurementStats({
      stationId: target.id,
      parameter: target.parameters[0]!,
      // Far-future window guaranteed to hold no measurement.
      from: new Date('2099-01-01T00:00:00.000Z'),
      to: new Date('2099-01-02T00:00:00.000Z'),
    });
    expect(stats).toBeNull();
  });

  it('list_alerts delegates and returns AlertDTO-shaped rows', async () => {
    const alerts = await adapter.listAlerts({ status: 'all' });
    expect(Array.isArray(alerts)).toBe(true);
    for (const a of alerts) {
      expect(typeof a.id).toBe('string');
      expect(typeof a.stationId).toBe('string');
      expect(['THRESHOLD_EXCEEDED', 'STATISTICAL_ANOMALY', 'STATION_OFFLINE']).toContain(a.type);
      expect(typeof a.openedAt).toBe('string');
    }
  });
});
