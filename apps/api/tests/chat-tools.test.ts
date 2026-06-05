import { describe, expect, it } from 'vitest';

import type { AlertDTO, StationLatestMeasurement } from '@alpimonitor/shared';

import { CHAT_TOOLS, createToolDispatcher, type ToolResult } from '../src/ai/chat/tools.js';
import type {
  FindStationsQuery,
  LatestMeasurementsQuery,
  ListAlertsQuery,
  MeasurementStats,
  MeasurementStatsQuery,
  QueryPort,
  StationIdentity,
} from '../src/ai/chat/query-port.js';

// AI layer — extension C3a (ADR-012 D6). The dispatcher routes each whitelisted
// tool name to the right QueryPort method, validates arguments, and turns bad
// model output into a STRUCTURED error (never a crash). Tested against the same
// in-memory QueryPort substitutability proof as C1 — no Prisma in sight.

interface FakeStation {
  identity: StationIdentity;
  latest: StationLatestMeasurement[];
  stats: Record<string, MeasurementStats>;
}

// Records the last query each method received so we can assert the dispatcher
// mapped arguments correctly (e.g. resolved periodHours → from/to window).
class RecordingQueryPort implements QueryPort {
  lastFind?: FindStationsQuery;
  lastLatest?: LatestMeasurementsQuery;
  lastStats?: MeasurementStatsQuery;
  lastAlerts?: ListAlertsQuery;

  constructor(
    private readonly stations: FakeStation[],
    private readonly alerts: AlertDTO[]
  ) {}

  async findStations(query: FindStationsQuery): Promise<StationIdentity[]> {
    this.lastFind = query;
    const needle = query.search?.trim().toLowerCase();
    const all = this.stations.map((s) => s.identity);
    if (!needle) return all;
    return all.filter(
      (s) => s.name.toLowerCase().includes(needle) || s.riverName.toLowerCase().includes(needle)
    );
  }

  async getLatestMeasurements(query: LatestMeasurementsQuery): Promise<StationLatestMeasurement[]> {
    this.lastLatest = query;
    return this.stations.find((s) => s.identity.id === query.stationId)?.latest ?? [];
  }

  async getMeasurementStats(query: MeasurementStatsQuery): Promise<MeasurementStats | null> {
    this.lastStats = query;
    return (
      this.stations.find((s) => s.identity.id === query.stationId)?.stats[query.parameter] ?? null
    );
  }

  async listAlerts(query: ListAlertsQuery): Promise<AlertDTO[]> {
    this.lastAlerts = query;
    return this.alerts.filter((a) => {
      if (query.stationId && a.stationId !== query.stationId) return false;
      if (query.status === 'open') return a.closedAt === null;
      if (query.status === 'closed') return a.closedAt !== null;
      return true;
    });
  }
}

const SION: FakeStation = {
  identity: {
    id: 'stn-sion',
    name: 'Sion',
    riverName: 'Rhône',
    dataSource: 'LIVE',
    parameters: ['DISCHARGE', 'WATER_LEVEL'],
  },
  latest: [
    {
      parameter: 'DISCHARGE',
      unit: 'm³/s',
      value: 42.5,
      recordedAt: '2026-06-04T21:00:00.000Z',
      status: 'NORMAL',
    },
  ],
  stats: {
    DISCHARGE: {
      stationId: 'stn-sion',
      parameter: 'DISCHARGE',
      unit: 'm³/s',
      from: '2026-06-04T00:00:00.000Z',
      to: '2026-06-05T00:00:00.000Z',
      first: 30,
      last: 42.5,
      min: 28,
      max: 50,
      avg: 39,
      deltaAbs: 12.5,
      deltaPct: 41.67,
      sampleSize: 1390,
    },
  },
};

const OPEN_ALERT: AlertDTO = {
  id: 'al-open',
  stationId: 'stn-sion',
  type: 'STATISTICAL_ANOMALY',
  level: 'VIGILANCE',
  parameter: 'DISCHARGE',
  triggerValue: 60,
  thresholdValue: 50,
  openedAt: '2026-06-04T12:00:00.000Z',
  closedAt: null,
  metadata: null,
};

// Fixed clock so windowed stats resolve to a deterministic [from, to).
const NOW = new Date('2026-06-05T00:00:00.000Z');

function buildDispatcher() {
  const port = new RecordingQueryPort([SION], [OPEN_ALERT]);
  const dispatcher = createToolDispatcher({ queryPort: port, now: () => NOW });
  return { port, dispatcher };
}

// Narrow a ToolResult to its success branch in assertions.
function expectOk(result: ToolResult): { ok: true; data: unknown } {
  expect(result.ok).toBe(true);
  return result as { ok: true; data: unknown };
}

describe('CHAT_TOOLS specs', () => {
  it('exposes exactly the four whitelisted functions (D6)', () => {
    expect(CHAT_TOOLS.map((t) => t.function.name)).toEqual([
      'find_stations',
      'get_latest_measurements',
      'get_measurement_stats',
      'list_alerts',
    ]);
    expect(CHAT_TOOLS.every((t) => t.type === 'function')).toBe(true);
  });

  it('marks stationId required on the value-returning tools', () => {
    const byName = Object.fromEntries(
      CHAT_TOOLS.map((t) => [t.function.name, t.function.parameters])
    );
    expect((byName.get_latest_measurements as { required?: string[] }).required).toContain(
      'stationId'
    );
    expect((byName.get_measurement_stats as { required?: string[] }).required).toEqual(
      expect.arrayContaining(['stationId', 'parameter'])
    );
    // Identity resolver and alert list need no required argument.
    expect((byName.find_stations as { required?: string[] }).required).toBeUndefined();
    expect((byName.list_alerts as { required?: string[] }).required).toBeUndefined();
  });
});

describe('tool dispatcher — routing to QueryPort (D6)', () => {
  it('routes find_stations and forwards the search fragment', async () => {
    const { port, dispatcher } = buildDispatcher();
    const result = expectOk(
      await dispatcher.dispatch({ name: 'find_stations', arguments: '{"search":"sio"}' })
    );
    expect(port.lastFind).toEqual({ search: 'sio' });
    expect((result.data as StationIdentity[]).map((s) => s.id)).toEqual(['stn-sion']);
  });

  it('treats empty arguments as a no-arg call (find_stations → all)', async () => {
    const { dispatcher } = buildDispatcher();
    const result = expectOk(await dispatcher.dispatch({ name: 'find_stations', arguments: '' }));
    expect((result.data as StationIdentity[]).map((s) => s.id)).toEqual(['stn-sion']);
  });

  it('routes get_latest_measurements by stationId', async () => {
    const { port, dispatcher } = buildDispatcher();
    const result = expectOk(
      await dispatcher.dispatch({
        name: 'get_latest_measurements',
        arguments: '{"stationId":"stn-sion"}',
      })
    );
    expect(port.lastLatest).toEqual({ stationId: 'stn-sion' });
    expect((result.data as StationLatestMeasurement[])[0]).toMatchObject({ value: 42.5 });
  });

  it('routes get_measurement_stats and resolves periodHours → absolute window', async () => {
    const { port, dispatcher } = buildDispatcher();
    const result = expectOk(
      await dispatcher.dispatch({
        name: 'get_measurement_stats',
        arguments: '{"stationId":"stn-sion","parameter":"DISCHARGE","periodHours":24}',
      })
    );
    // [NOW - 24h, NOW) — the chat layer owns relative→absolute time, not the port.
    expect(port.lastStats).toMatchObject({
      stationId: 'stn-sion',
      parameter: 'DISCHARGE',
      from: new Date('2026-06-04T00:00:00.000Z'),
      to: NOW,
    });
    expect((result.data as MeasurementStats).sampleSize).toBe(1390);
  });

  it('defaults periodHours to 24h when the model omits it', async () => {
    const { port, dispatcher } = buildDispatcher();
    await dispatcher.dispatch({
      name: 'get_measurement_stats',
      arguments: '{"stationId":"stn-sion","parameter":"DISCHARGE"}',
    });
    const windowMs = port.lastStats!.to.getTime() - port.lastStats!.from.getTime();
    expect(windowMs).toBe(24 * 3_600_000);
  });

  it('returns null data (honest absence) when the window holds no stats', async () => {
    const { dispatcher } = buildDispatcher();
    const result = expectOk(
      await dispatcher.dispatch({
        name: 'get_measurement_stats',
        arguments: '{"stationId":"stn-sion","parameter":"TEMPERATURE"}',
      })
    );
    expect(result.data).toBeNull();
  });

  it('routes list_alerts and defaults status to open', async () => {
    const { port, dispatcher } = buildDispatcher();
    const result = expectOk(await dispatcher.dispatch({ name: 'list_alerts', arguments: '{}' }));
    expect(port.lastAlerts).toEqual({ status: 'open' });
    expect((result.data as AlertDTO[]).map((a) => a.id)).toEqual(['al-open']);
  });
});

describe('tool dispatcher — structured errors (self-correctable, never a crash)', () => {
  it('reports invalid JSON arguments without throwing', async () => {
    const { dispatcher } = buildDispatcher();
    const result = await dispatcher.dispatch({ name: 'find_stations', arguments: '{not json' });
    expect(result).toMatchObject({ ok: false, error: 'invalid_json' });
  });

  it('reports a missing required argument (stationId) as invalid_arguments', async () => {
    const { dispatcher } = buildDispatcher();
    const result = await dispatcher.dispatch({ name: 'get_latest_measurements', arguments: '{}' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid_arguments');
      expect(result.message).toContain('stationId');
    }
  });

  it('rejects an unknown parameter enum value', async () => {
    const { dispatcher } = buildDispatcher();
    const result = await dispatcher.dispatch({
      name: 'get_measurement_stats',
      arguments: '{"stationId":"stn-sion","parameter":"RAINFALL"}',
    });
    expect(result).toMatchObject({ ok: false, error: 'invalid_arguments' });
  });

  it('rejects a tool name outside the whitelist', async () => {
    const { dispatcher } = buildDispatcher();
    const result = await dispatcher.dispatch({ name: 'run_sql', arguments: '{}' });
    expect(result).toMatchObject({ ok: false, error: 'unknown_tool' });
  });
});
