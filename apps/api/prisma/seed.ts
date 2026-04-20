// AlpiMonitor — seed of context entities for the Borgne basin demo.
//
// Seeded: catchment, stations (with OFEV codes where known), sensors,
// thresholds, glaciers + station-glacier links, Grande Dixence withdrawals.
// Measurements are NOT seeded here — they come from the OFEV ingestion
// (US-2.1). Running this script on an empty DB or a seeded DB is safe:
// every upsert keys on a unique column.
//
// Run: pnpm --filter @alpimonitor/api exec prisma db seed

import { PrismaClient, Direction, FlowType, Parameter } from '@prisma/client';

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
};

// OFEV codes: Bramois = "2011" (confirmé dans l'exemple XML de
// docs/context/data-sources.md). Les autres stations sont marquées
// TBD-<slug> en attendant la discovery US-2.1 (script qui lit le flux
// OFEV réel et réconcilie les codes). Le upsert sur ofevCode permettra
// de remplacer les placeholders proprement.
const STATIONS: StationSeed[] = [
  {
    ofevCode: '2011',
    name: 'Borgne — Bramois',
    riverName: 'La Borgne',
    latitude: 46.2333,
    longitude: 7.3833,
    altitudeM: 490,
    flowType: FlowType.NATURAL,
  },
  {
    ofevCode: 'TBD-LES-HAUDERES',
    name: 'Borgne — Les Haudères',
    riverName: 'La Borgne',
    latitude: 46.0833,
    longitude: 7.5167,
    altitudeM: 1450,
    flowType: FlowType.RESIDUAL,
  },
  {
    ofevCode: 'TBD-EVOLENE',
    name: 'Borgne — Evolène',
    riverName: 'La Borgne',
    latitude: 46.1167,
    longitude: 7.4983,
    altitudeM: 1370,
    flowType: FlowType.RESIDUAL,
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
      },
      create: { ...s, catchmentId, operatorName: 'OFEV' },
    });
    out.push(station);
  }
  return out;
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

// Seuils de démonstration pour régime nival-glaciaire de tête de bassin.
// Les valeurs réelles seront calibrées par les hydrologues CREALP sur
// historique long (hors scope v1).
const THRESHOLDS: Array<{
  parameter: Parameter;
  vigilanceValue: number;
  alertValue: number;
  direction: Direction;
}> = [
  {
    parameter: Parameter.DISCHARGE,
    vigilanceValue: 50,
    alertValue: 100,
    direction: Direction.ABOVE,
  },
  {
    parameter: Parameter.WATER_LEVEL,
    vigilanceValue: 150,
    alertValue: 200,
    direction: Direction.ABOVE,
  },
];

async function seedThresholds(stationIds: string[]) {
  for (const stationId of stationIds) {
    for (const t of THRESHOLDS) {
      await prisma.threshold.upsert({
        where: {
          stationId_parameter: { stationId, parameter: t.parameter },
        },
        update: {
          vigilanceValue: t.vigilanceValue,
          alertValue: t.alertValue,
          direction: t.direction,
        },
        create: { stationId, ...t },
      });
    }
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

async function seedStationGlaciers(stationIds: string[], glacierIds: string[]) {
  // Chaque station du Val d'Hérens draine Ferpècle et Mont Miné (amont commun).
  for (const stationId of stationIds) {
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
  const stationsByName = new Map(stations.map((s) => [s.name, s.id]));

  console.log('→ Sensors');
  await seedSensors(stationIds);

  console.log('→ Thresholds');
  await seedThresholds(stationIds);

  console.log('→ Glaciers');
  const glaciers = await seedGlaciers();

  console.log('→ StationGlacier links');
  await seedStationGlaciers(
    stationIds,
    glaciers.map((g) => g.id)
  );

  console.log('→ Withdrawals');
  await seedWithdrawals(stationsByName);

  const counts = {
    catchments: await prisma.catchment.count(),
    stations: await prisma.station.count(),
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
