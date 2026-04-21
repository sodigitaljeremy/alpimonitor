// AlpiMonitor — seed of context entities for the Valais / Borgne demo.
//
// Seeded: catchment, stations (LIVE Rhône from LINDAS + RESEARCH Borgne
// placeholders), sensors, thresholds, glaciers + station-glacier links,
// Grande Dixence withdrawals. Measurements are NOT seeded here — they come
// from the LINDAS ingestion cron (US-2.1). Running this script on an empty
// DB or a seeded DB is safe: every upsert keys on a unique column.
//
// Station selection reflects ADR-007:
//   LIVE     = ingested from LINDAS (BAFU open data on Rhône)
//   RESEARCH = CREALP / Grande Dixence network on the Borgne, not public;
//              code stays TBD-* until the research feed is integrated.
//
// Run: pnpm --filter @alpimonitor/api exec prisma db seed

import { PrismaClient, DataSource, Direction, FlowType, Parameter } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCatchment() {
  return prisma.catchment.upsert({
    where: { name: 'Bassin de la Borgne' },
    update: {},
    create: {
      name: 'Bassin de la Borgne',
      description:
        'Bassin versant alpin rive gauche du Rhône, alimenté par les glaciers de Ferpècle, Mont Miné et Arolla. Impacté par les captages Grande Dixence en tête de vallée.',
      areaKm2: 383,
    },
  });
}

type StationSeed = {
  ofevCode: string;
  name: string;
  riverName: string;
  latitude: number;
  longitude: number;
  altitudeM: number;
  flowType: FlowType;
  operatorName: string;
  dataSource: DataSource;
};

// Coordinates for LIVE stations come from LINDAS discovery
// (apps/api/scripts/discover-ofev-stations.ts, 2026-04-20). Altitudes
// are BAFU-published station elevations. The Borgne RESEARCH stations
// keep human-placed coords for the Val d'Hérens villages — close enough
// for the map narrative, to be refined when the CREALP feed lands.
const STATIONS: StationSeed[] = [
  // --- LIVE BAFU (ingested from LINDAS) ---
  {
    ofevCode: '2346',
    name: 'Brig',
    riverName: 'Rhône',
    latitude: 46.3169,
    longitude: 7.9751,
    altitudeM: 677,
    flowType: FlowType.NATURAL,
    operatorName: 'OFEV',
    dataSource: DataSource.LIVE,
  },
  {
    ofevCode: '2011',
    name: 'Sion',
    riverName: 'Rhône',
    latitude: 46.2191,
    longitude: 7.3579,
    altitudeM: 483,
    flowType: FlowType.NATURAL,
    operatorName: 'OFEV',
    dataSource: DataSource.LIVE,
  },
  {
    ofevCode: '2630',
    name: 'Sion',
    riverName: 'Sionne',
    latitude: 46.2305,
    longitude: 7.366,
    altitudeM: 510,
    flowType: FlowType.NATURAL,
    operatorName: 'OFEV',
    dataSource: DataSource.LIVE,
  },
  {
    ofevCode: '2009',
    name: 'Porte du Scex',
    riverName: 'Rhône',
    latitude: 46.35,
    longitude: 6.889,
    altitudeM: 377,
    flowType: FlowType.NATURAL,
    operatorName: 'OFEV',
    dataSource: DataSource.LIVE,
  },
  // --- RESEARCH (CREALP / Grande Dixence, not publicly ingestable) ---
  {
    ofevCode: 'TBD-BRAMOIS',
    name: 'Borgne — Bramois',
    riverName: 'La Borgne',
    latitude: 46.2333,
    longitude: 7.3833,
    altitudeM: 490,
    flowType: FlowType.NATURAL,
    operatorName: 'CREALP',
    dataSource: DataSource.RESEARCH,
  },
  {
    ofevCode: 'TBD-HAUDERES',
    name: 'Borgne — Les Haudères',
    riverName: 'La Borgne',
    latitude: 46.0833,
    longitude: 7.5167,
    altitudeM: 1450,
    flowType: FlowType.RESIDUAL,
    operatorName: 'CREALP',
    dataSource: DataSource.RESEARCH,
  },
  {
    ofevCode: 'TBD-EVOLENE',
    name: 'Borgne — Evolène',
    riverName: 'La Borgne',
    latitude: 46.1167,
    longitude: 7.4983,
    altitudeM: 1370,
    flowType: FlowType.RESIDUAL,
    operatorName: 'CREALP',
    dataSource: DataSource.RESEARCH,
  },
];

async function seedStations(catchmentId: string) {
  const out = [];
  for (const s of STATIONS) {
    const station = await prisma.station.upsert({
      where: { ofevCode: s.ofevCode },
      update: {
        name: s.name,
        riverName: s.riverName,
        latitude: s.latitude,
        longitude: s.longitude,
        altitudeM: s.altitudeM,
        flowType: s.flowType,
        operatorName: s.operatorName,
        dataSource: s.dataSource,
      },
      create: { ...s, catchmentId },
    });
    out.push(station);
  }
  return out;
}

// Remove stations whose ofevCode is no longer in the current seed list.
// This converges any DB (dev or prod) across seed-level renames — e.g.
// TBD-LES-HAUDERES → TBD-HAUDERES (2026-04-20, ADR-007). Dependent rows
// are cleared in FK-safe order. The Measurement table is touched because
// future ingestion will have populated it between seed runs.
async function pruneStaleStations(currentOfevCodes: string[]) {
  const stale = await prisma.station.findMany({
    where: { ofevCode: { notIn: currentOfevCodes } },
    select: { id: true, ofevCode: true, name: true },
  });
  if (stale.length === 0) return;
  const staleIds = stale.map((s) => s.id);

  const sensors = await prisma.sensor.findMany({
    where: { stationId: { in: staleIds } },
    select: { id: true },
  });
  const sensorIds = sensors.map((s) => s.id);

  await prisma.measurement.deleteMany({ where: { sensorId: { in: sensorIds } } });
  await prisma.alert.deleteMany({ where: { stationId: { in: staleIds } } });
  await prisma.thresholdAudit.deleteMany({ where: { stationId: { in: staleIds } } });
  await prisma.threshold.deleteMany({ where: { stationId: { in: staleIds } } });
  await prisma.sensor.deleteMany({ where: { stationId: { in: staleIds } } });
  await prisma.withdrawal.updateMany({
    where: { stationId: { in: staleIds } },
    data: { stationId: null },
  });
  await prisma.stationGlacier.deleteMany({ where: { stationId: { in: staleIds } } });
  await prisma.station.deleteMany({ where: { id: { in: staleIds } } });

  console.log(
    `  pruned ${stale.length} stale station(s): ${stale.map((s) => `${s.ofevCode}/${s.name}`).join(', ')}`
  );
}

const SENSORS: Array<{ parameter: Parameter; unit: string }> = [
  { parameter: Parameter.DISCHARGE, unit: 'm3/s' },
  { parameter: Parameter.WATER_LEVEL, unit: 'cm' },
];

async function seedSensors(stationIds: string[]) {
  for (const stationId of stationIds) {
    for (const sensor of SENSORS) {
      await prisma.sensor.upsert({
        where: {
          stationId_parameter: { stationId, parameter: sensor.parameter },
        },
        update: { unit: sensor.unit },
        create: { stationId, ...sensor },
      });
    }
  }
}

// Per-station DISCHARGE thresholds (m³/s, ABOVE direction = crue).
// Values are rough orders of magnitude: significantly above the typical
// mean flow, so the demo doesn't generate false alerts on routine data.
// Real calibration would use BAFU's historical return periods (Q10, Q100)
// and is out of scope for v1.
//
// BAFU also publishes its own 5-level dangerLevel per observation —
// treated as the authoritative signal downstream; these thresholds are
// the operator-configurable layer on top.
//
// WATER_LEVEL is deliberately skipped here: BAFU exposes it as metres
// above sea level (altitude-referenced), not cm above bed, so a single
// generic threshold would be meaningless. v2 will add per-station
// bed-referenced thresholds once we have the local zero offsets.
const DISCHARGE_THRESHOLDS_BY_CODE: Record<string, { vigilanceValue: number; alertValue: number }> =
  {
    '2346': { vigilanceValue: 200, alertValue: 400 }, // Brig / Rhône
    '2011': { vigilanceValue: 500, alertValue: 800 }, // Sion / Rhône
    '2630': { vigilanceValue: 5, alertValue: 15 }, // Sion / Sionne (small urban tributary)
    '2009': { vigilanceValue: 600, alertValue: 1000 }, // Porte du Scex / Rhône
    'TBD-BRAMOIS': { vigilanceValue: 50, alertValue: 100 },
    'TBD-HAUDERES': { vigilanceValue: 20, alertValue: 40 },
    'TBD-EVOLENE': { vigilanceValue: 25, alertValue: 50 },
  };

async function seedThresholds(stations: Array<{ id: string; ofevCode: string }>) {
  // Drop dimensions we no longer seed (v2 will reintroduce bed-referenced
  // WATER_LEVEL thresholds once the zero offsets per station are known).
  await prisma.threshold.deleteMany({
    where: { parameter: { notIn: [Parameter.DISCHARGE] } },
  });

  for (const station of stations) {
    const t = DISCHARGE_THRESHOLDS_BY_CODE[station.ofevCode];
    if (!t) continue;
    await prisma.threshold.upsert({
      where: {
        stationId_parameter: { stationId: station.id, parameter: Parameter.DISCHARGE },
      },
      update: {
        vigilanceValue: t.vigilanceValue,
        alertValue: t.alertValue,
        direction: Direction.ABOVE,
      },
      create: {
        stationId: station.id,
        parameter: Parameter.DISCHARGE,
        vigilanceValue: t.vigilanceValue,
        alertValue: t.alertValue,
        direction: Direction.ABOVE,
      },
    });
  }
}

const GLACIERS = [
  { name: 'Ferpècle', altitudeMinM: 1900, altitudeMaxM: 3700 },
  { name: 'Mont Miné', altitudeMinM: 1980, altitudeMaxM: 3500 },
];

async function seedGlaciers() {
  const out = [];
  for (const g of GLACIERS) {
    const glacier = await prisma.glacier.upsert({
      where: { name: g.name },
      update: { altitudeMinM: g.altitudeMinM, altitudeMaxM: g.altitudeMaxM },
      create: g,
    });
    out.push(glacier);
  }
  return out;
}

async function seedStationGlaciers(borgneStationIds: string[], glacierIds: string[]) {
  // Ferpècle and Mont Miné drain into La Borgne — so only Borgne stations
  // carry this relation. Rhône stations aren't fed by these glaciers
  // directly enough to warrant the edge.
  //
  // Prune first: earlier seed revisions linked every station to every
  // glacier (including the ex-Bramois/ex-2011 that is now Sion/Rhône).
  // Removing edges outside the Borgne set makes the seed idempotent
  // across station-reclassification without needing a migrate reset.
  await prisma.stationGlacier.deleteMany({
    where: { stationId: { notIn: borgneStationIds } },
  });
  for (const stationId of borgneStationIds) {
    for (const glacierId of glacierIds) {
      await prisma.stationGlacier.upsert({
        where: { stationId_glacierId: { stationId, glacierId } },
        update: {},
        create: { stationId, glacierId },
      });
    }
  }
}

type WithdrawalSeed = {
  name: string;
  altitudeM: number;
  latitude: number;
  longitude: number;
  annualVolumeM3: number | null;
  stationName: string;
};

// Captages Grande Dixence — ordres de grandeur connus publiquement.
// Rattachés à la station Les Haudères (premier point de jaugeage aval
// impacté par le régime résiduel).
const WITHDRAWALS: WithdrawalSeed[] = [
  {
    name: 'Station de pompage de Ferpècle',
    altitudeM: 1896,
    latitude: 46.05,
    longitude: 7.53,
    annualVolumeM3: null,
    stationName: 'Borgne — Les Haudères',
  },
  {
    name: "Station de pompage d'Arolla",
    altitudeM: 2009,
    latitude: 46.03,
    longitude: 7.48,
    annualVolumeM3: null,
    stationName: 'Borgne — Les Haudères',
  },
];

async function seedWithdrawals(stationsByName: Map<string, string>) {
  for (const w of WITHDRAWALS) {
    const stationId = stationsByName.get(w.stationName);
    await prisma.withdrawal.upsert({
      where: { name: w.name },
      update: {
        altitudeM: w.altitudeM,
        latitude: w.latitude,
        longitude: w.longitude,
        annualVolumeM3: w.annualVolumeM3,
        stationId,
      },
      create: {
        name: w.name,
        altitudeM: w.altitudeM,
        latitude: w.latitude,
        longitude: w.longitude,
        annualVolumeM3: w.annualVolumeM3,
        stationId,
      },
    });
  }
}

async function main() {
  console.log('→ Catchment');
  const catchment = await seedCatchment();

  console.log('→ Stations');
  const stations = await seedStations(catchment.id);
  const stationIds = stations.map((s) => s.id);
  const borgneStationIds = stations.filter((s) => s.riverName === 'La Borgne').map((s) => s.id);
  const stationsByName = new Map(stations.map((s) => [s.name, s.id]));

  console.log('→ Prune stale stations');
  await pruneStaleStations(STATIONS.map((s) => s.ofevCode));

  console.log('→ Sensors');
  await seedSensors(stationIds);

  console.log('→ Thresholds');
  await seedThresholds(stations.map((s) => ({ id: s.id, ofevCode: s.ofevCode })));

  console.log('→ Glaciers');
  const glaciers = await seedGlaciers();

  console.log('→ StationGlacier links');
  await seedStationGlaciers(
    borgneStationIds,
    glaciers.map((g) => g.id)
  );

  console.log('→ Withdrawals');
  await seedWithdrawals(stationsByName);

  const counts = {
    catchments: await prisma.catchment.count(),
    stations: await prisma.station.count(),
    stationsLive: await prisma.station.count({ where: { dataSource: 'LIVE' } }),
    stationsResearch: await prisma.station.count({ where: { dataSource: 'RESEARCH' } }),
    sensors: await prisma.sensor.count(),
    thresholds: await prisma.threshold.count(),
    glaciers: await prisma.glacier.count(),
    stationGlaciers: await prisma.stationGlacier.count(),
    withdrawals: await prisma.withdrawal.count(),
  };
  console.log('\nSeed complete:', counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
