import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  DataSource,
  FlowType,
  MeasurementAggregate,
  MeasurementSeries,
  Parameter,
  StationDTO,
  StationMeasurementsDTO,
} from '@alpimonitor/shared';

import { computeMeasurementStatus, type ThresholdConfig } from '../utils/station-status.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

export interface ListStationsParams {
  catchmentId?: string;
  isActive: boolean;
}

export async function listStations(
  prisma: PrismaClient,
  params: ListStationsParams,
  now: Date = new Date()
): Promise<StationDTO[]> {
  const stations = await prisma.station.findMany({
    where: {
      isActive: params.isActive,
      ...(params.catchmentId ? { catchmentId: params.catchmentId } : {}),
    },
    orderBy: { name: 'asc' },
    include: {
      sensors: {
        where: { isActive: true },
        include: {
          measurements: {
            orderBy: { recordedAt: 'desc' },
            take: 1,
            select: { value: true, recordedAt: true },
          },
        },
      },
      thresholds: {
        select: {
          parameter: true,
          vigilanceValue: true,
          alertValue: true,
          direction: true,
        },
      },
      _count: {
        select: { alerts: { where: { closedAt: null } } },
      },
    },
  });

  return stations.map((s) => {
    const thresholdByParam = new Map<Parameter, ThresholdConfig>(
      s.thresholds.map((t) => [
        t.parameter,
        {
          vigilanceValue: t.vigilanceValue,
          alertValue: t.alertValue,
          direction: t.direction,
        },
      ])
    );

    const latestMeasurements = s.sensors
      .map((sensor) => {
        const last = sensor.measurements[0];
        if (!last) return null;
        return {
          parameter: sensor.parameter as Parameter,
          unit: sensor.unit,
          value: last.value,
          recordedAt: last.recordedAt.toISOString(),
          status: computeMeasurementStatus(
            last.value,
            last.recordedAt,
            thresholdByParam.get(sensor.parameter as Parameter) ?? null,
            now
          ),
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    return {
      id: s.id,
      ofevCode: s.ofevCode,
      name: s.name,
      riverName: s.riverName,
      latitude: s.latitude,
      longitude: s.longitude,
      altitudeM: s.altitudeM,
      flowType: s.flowType as FlowType,
      operatorName: s.operatorName,
      dataSource: s.dataSource as DataSource,
      latestMeasurements,
      activeAlertsCount: s._count.alerts,
    };
  });
}

export function pickAggregate(from: Date, to: Date): MeasurementAggregate {
  const ms = to.getTime() - from.getTime();
  if (ms <= ONE_DAY_MS) return 'raw';
  if (ms <= SEVEN_DAYS_MS) return 'hourly';
  return 'daily';
}

export interface StationMeasurementsParams {
  stationId: string;
  parameter?: Parameter;
  from: Date;
  to: Date;
  aggregate?: MeasurementAggregate;
}

export class StationNotFoundError extends Error {
  constructor(public readonly stationId: string) {
    super(`Station ${stationId} not found`);
    this.name = 'StationNotFoundError';
  }
}

interface AggregatedRow {
  parameter: Parameter;
  unit: string;
  t: Date;
  v: number;
}

export async function getStationMeasurements(
  prisma: PrismaClient,
  params: StationMeasurementsParams
): Promise<StationMeasurementsDTO> {
  const station = await prisma.station.findUnique({
    where: { id: params.stationId },
    select: { id: true },
  });
  if (!station) throw new StationNotFoundError(params.stationId);

  const sensors = await prisma.sensor.findMany({
    where: {
      stationId: params.stationId,
      isActive: true,
      ...(params.parameter ? { parameter: params.parameter } : {}),
    },
    select: { id: true, parameter: true, unit: true },
  });

  const aggregate = params.aggregate ?? pickAggregate(params.from, params.to);

  // Empty sensor set: return an empty envelope rather than 404.
  // Consumers can still render "no data for this range".
  if (sensors.length === 0) {
    return {
      stationId: params.stationId,
      from: params.from.toISOString(),
      to: params.to.toISOString(),
      aggregate,
      series: [],
    };
  }

  const sensorIds = sensors.map((s) => s.id);
  const unitByParameter = new Map(sensors.map((s) => [s.parameter as Parameter, s.unit]));

  const series: MeasurementSeries[] = [];

  if (aggregate === 'raw') {
    const rows = await prisma.measurement.findMany({
      where: {
        sensorId: { in: sensorIds },
        recordedAt: { gte: params.from, lt: params.to },
      },
      orderBy: { recordedAt: 'asc' },
      include: { sensor: { select: { parameter: true } } },
    });

    const grouped = new Map<Parameter, { t: string; v: number }[]>();
    for (const row of rows) {
      const p = row.sensor.parameter as Parameter;
      const list = grouped.get(p) ?? [];
      list.push({ t: row.recordedAt.toISOString(), v: row.value });
      grouped.set(p, list);
    }
    for (const [parameter, points] of grouped) {
      series.push({ parameter, unit: unitByParameter.get(parameter) ?? '', points });
    }
  } else {
    // DATE_TRUNC wants a literal for the unit, so we branch on the two
    // allowed values rather than interpolating. All user-provided values
    // (stationId, dates, parameter) flow through Prisma.sql parameters.
    const truncUnit = aggregate === 'hourly' ? Prisma.sql`'hour'` : Prisma.sql`'day'`;
    const paramFilter = params.parameter
      ? Prisma.sql`AND s.parameter = ${params.parameter}::"Parameter"`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<AggregatedRow[]>`
      SELECT s.parameter::text AS parameter,
             s.unit AS unit,
             DATE_TRUNC(${truncUnit}, m."recordedAt") AS t,
             AVG(m.value)::float AS v
      FROM "Measurement" m
      JOIN "Sensor" s ON m."sensorId" = s.id
      WHERE s."stationId" = ${params.stationId}
        AND m."recordedAt" >= ${params.from}
        AND m."recordedAt" < ${params.to}
        ${paramFilter}
      GROUP BY s.parameter, s.unit, t
      ORDER BY s.parameter, t ASC
    `;

    const grouped = new Map<
      Parameter,
      { parameter: Parameter; unit: string; points: { t: string; v: number }[] }
    >();
    for (const row of rows) {
      const p = row.parameter;
      const entry = grouped.get(p) ?? { parameter: p, unit: row.unit, points: [] };
      entry.points.push({ t: new Date(row.t).toISOString(), v: row.v });
      grouped.set(p, entry);
    }
    for (const entry of grouped.values()) series.push(entry);
  }

  return {
    stationId: params.stationId,
    from: params.from.toISOString(),
    to: params.to.toISOString(),
    aggregate,
    series,
  };
}
