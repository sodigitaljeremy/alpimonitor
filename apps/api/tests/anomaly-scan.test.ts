import { beforeEach, describe, expect, it } from 'vitest';

import { runAnomalyScan } from '../src/anomaly/anomaly-scan.js';

// In-memory Prisma fake — just enough surface for runAnomalyScan + alerts-service.
// It lets us assert the real episodic invariant end-to-end: ONE open Alert row
// per (station, parameter), updated in place while the anomaly persists, closed
// on return to normal. No real DB, no migration.

interface AlertRow {
  id: string;
  stationId: string;
  parameter: string;
  type: string;
  level: string;
  triggerValue: number;
  thresholdValue: number | null;
  openedAt: Date;
  closedAt: Date | null;
  metadata: unknown;
}

interface MeasurementRow {
  value: number;
  recordedAt: Date;
}

const NOW = new Date('2026-06-08T00:00:00.000Z');
const NOW_MS = NOW.getTime();
const TEN_MIN = 10 * 60_000;
const DENSE = 1000; // fills the 7-day window at 10-min cadence (clears the guards)

// Dense baseline at `baseValue` (±1 ripple), then the candidate at NOW. Baseline
// timestamps (NOW − i·10min, i≥1) are all strictly before the candidate, so the
// detector's reference window holds the full DENSE baseline and excludes nothing.
function series(baseValue: number, candidateValue: number): MeasurementRow[] {
  const rows: MeasurementRow[] = [];
  for (let i = DENSE; i >= 1; i--) {
    rows.push({
      value: baseValue + (i % 2 === 0 ? 1 : -1),
      recordedAt: new Date(NOW_MS - i * TEN_MIN),
    });
  }
  rows.push({ value: candidateValue, recordedAt: NOW });
  return rows;
}

class FakePrisma {
  alerts: AlertRow[] = [];
  createCalls = 0;
  private seq = 0;
  // single LIVE station with one DISCHARGE sensor
  private measurementsBySensor: Record<string, MeasurementRow[]> = {};

  setSensorSeries(sensorId: string, rows: MeasurementRow[]): void {
    this.measurementsBySensor[sensorId] = rows;
  }

  station = {
    findMany: async (): Promise<
      Array<{ id: string; sensors: Array<{ id: string; parameter: string }> }>
    > => [{ id: 'stn-1', sensors: [{ id: 'sen-1', parameter: 'DISCHARGE' }] }],
  };

  measurement = {
    findMany: async (args: {
      where: { sensorId: string; recordedAt: { gte: Date } };
    }): Promise<MeasurementRow[]> => {
      const all = this.measurementsBySensor[args.where.sensorId] ?? [];
      return all.filter((r) => r.recordedAt >= args.where.recordedAt.gte);
    },
  };

  alert = {
    findFirst: async (args: {
      where: { stationId: string; parameter: string; closedAt: null };
    }): Promise<{ id: string; level: string } | null> => {
      const found = this.alerts.find(
        (a) =>
          a.stationId === args.where.stationId &&
          a.parameter === args.where.parameter &&
          a.closedAt === null
      );
      return found ? { id: found.id, level: found.level } : null;
    },
    create: async (args: {
      data: {
        stationId: string;
        parameter: string;
        type: string;
        level: string;
        triggerValue: number;
        thresholdValue: number | null;
        metadata: unknown;
      };
    }): Promise<{ id: string }> => {
      this.createCalls += 1;
      const row: AlertRow = {
        id: `al-${++this.seq}`,
        openedAt: NOW,
        closedAt: null,
        ...args.data,
      };
      this.alerts.push(row);
      return { id: row.id };
    },
    update: async (args: {
      where: { id: string };
      data: Partial<AlertRow>;
    }): Promise<{ id: string }> => {
      const row = this.alerts.find((a) => a.id === args.where.id);
      if (!row) throw new Error(`alert ${args.where.id} not found`);
      Object.assign(row, args.data);
      return { id: row.id };
    },
  };
}

function scan(prisma: FakePrisma) {
  // referenceWindowMs left at the 7-day default; fixed `now` keeps it deterministic.
  return runAnomalyScan({
    prisma: prisma as never,
    now: () => NOW,
  });
}

describe('runAnomalyScan (episodic persistence)', () => {
  let prisma: FakePrisma;

  beforeEach(() => {
    prisma = new FakePrisma();
  });

  it('opens exactly one Alert when a fresh anomaly appears', async () => {
    prisma.setSensorSeries('sen-1', series(10, 40)); // candidate 40 ≫ baseline 10
    const res = await scan(prisma);

    expect(res).toMatchObject({ evaluated: 1, opened: 1, updated: 0, closed: 0 });
    expect(prisma.alerts).toHaveLength(1);
    const alert = prisma.alerts[0]!;
    expect(alert.type).toBe('STATISTICAL_ANOMALY');
    expect(alert.level).toBe('ALERT');
    expect(alert.parameter).toBe('DISCHARGE');
    expect(alert.triggerValue).toBe(40);
    expect(alert.closedAt).toBeNull();
    expect(alert.metadata).toMatchObject({ sampleSize: DENSE });
    expect(alert.metadata).toHaveProperty('mean');
    expect(alert.metadata).toHaveProperty('z');
    expect(alert.metadata).toHaveProperty('windowFrom');
  });

  it('updates the same row on a persistent anomaly (one episode = one row)', async () => {
    prisma.setSensorSeries('sen-1', series(10, 40));
    await scan(prisma);
    // re-scan with the anomaly still present (candidate raised again)
    prisma.setSensorSeries('sen-1', series(10, 45));
    const res = await scan(prisma);

    expect(res).toMatchObject({ opened: 0, updated: 1, closed: 0 });
    expect(prisma.alerts).toHaveLength(1);
    expect(prisma.createCalls).toBe(1); // never created a second alert
    expect(prisma.alerts[0]!.triggerValue).toBe(45); // metadata/value refreshed
    expect(prisma.alerts[0]!.closedAt).toBeNull();
  });

  it('closes the open Alert when the value returns to normal', async () => {
    prisma.setSensorSeries('sen-1', series(10, 40));
    await scan(prisma);
    // candidate back inside the noise band → verdict null → episode closes
    prisma.setSensorSeries('sen-1', series(10, 10));
    const res = await scan(prisma);

    expect(res).toMatchObject({ opened: 0, updated: 0, closed: 1 });
    expect(prisma.alerts).toHaveLength(1);
    expect(prisma.alerts[0]!.closedAt).toEqual(NOW);
  });

  it('does nothing when there is no anomaly and no open episode', async () => {
    prisma.setSensorSeries('sen-1', series(10, 10));
    const res = await scan(prisma);

    expect(res).toMatchObject({ evaluated: 1, opened: 0, updated: 0, closed: 0 });
    expect(prisma.alerts).toHaveLength(0);
  });

  it('skips a sensor with no measurements (not evaluated)', async () => {
    // no series set for sen-1 → empty → skipped
    const res = await scan(prisma);
    expect(res).toMatchObject({ evaluated: 0, opened: 0 });
    expect(prisma.alerts).toHaveLength(0);
  });
});
