// Pure parsers for LINDAS SPARQL hydro responses. No I/O, no DB.
// Imported by scripts/discover-ofev-stations.ts and (upcoming) the
// ingestion cron. Kept free of side effects so it unit-tests on fixtures.
//
// Response shape: SPARQL 1.1 Query Results JSON Format.
// See ADR-007 and docs/context/data-sources.md.

export interface SparqlBinding {
  type: 'uri' | 'literal' | 'bnode';
  value: string;
  datatype?: string;
}

export interface SparqlResults {
  head: { vars: string[] };
  results: { bindings: Array<Record<string, SparqlBinding>> };
}

export type NarrativeRole = 'upstream' | 'confluence' | 'outlet' | 'unknown';

export interface ParsedStation {
  ofevCode: string;
  name: string;
  waterBody: string | null;
  latitude: number;
  longitude: number;
  dischargeMeasured: number | null;
  waterLevelMeasured: number | null;
  dangerLevel: number | null;
  lastMeasurementAt: string;
  lastMeasurementAgeHours: number;
  narrativeRole: NarrativeRole;
}

// LINDAS WKT is `POINT(lon lat)` — lon first. Axis order matters.
export function parseWkt(wkt: string): { lat: number; lon: number } | null {
  const m = /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i.exec(wkt);
  if (!m) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export function asNumberOr(b: SparqlBinding | undefined, fallback: number | null): number | null {
  if (!b) return fallback;
  const n = Number(b.value);
  return Number.isFinite(n) ? n : fallback;
}

// LINDAS encodes water-body URIs like .../waterbody/Rh%C3%B4ne — we surface
// the decoded tail so the UI can render "Rhône" without a second fetch.
export function decodeWaterBody(uri: string | undefined): string | null {
  if (!uri) return null;
  try {
    const tail = uri.split('/').pop() ?? '';
    return decodeURIComponent(tail) || null;
  } catch {
    return null;
  }
}

export function classifyNarrativeRole(input: {
  name: string;
  water: string | null;
  lat: number;
}): NarrativeRole {
  const hay = `${input.name} ${input.water ?? ''}`.toLowerCase();
  if (/porte du scex|léman|leman/.test(hay)) return 'outlet';
  if (/brig|oberwald|gletsch|reckingen|obergoms/.test(hay)) return 'upstream';
  if (/sion|sierre|martigny|branson/.test(hay)) return 'confluence';
  if (input.lat < 46.2) return 'outlet';
  if (input.lat > 46.35) return 'upstream';
  return 'unknown';
}

// Shape a single SPARQL binding row into our domain type. Returns null if
// the row is missing a required field — caller counts skipped rows into
// IngestionRun.measurementsSkippedCount.
export function buildStation(
  b: Record<string, SparqlBinding>,
  now: Date = new Date()
): ParsedStation | null {
  const code = b.code?.value;
  const name = b.name?.value;
  const wkt = b.wkt?.value;
  const measuredAt = b.measuredAt?.value;
  if (!code || !name || !wkt || !measuredAt) return null;

  const coords = parseWkt(wkt);
  if (!coords) return null;

  const measuredDate = new Date(measuredAt);
  if (Number.isNaN(measuredDate.getTime())) return null;

  const water = decodeWaterBody(b.water?.value);
  const ageHours = (now.getTime() - measuredDate.getTime()) / 3_600_000;

  return {
    ofevCode: code,
    name,
    waterBody: water,
    latitude: coords.lat,
    longitude: coords.lon,
    dischargeMeasured: asNumberOr(b.discharge, null),
    waterLevelMeasured: asNumberOr(b.waterLevel, null),
    dangerLevel: asNumberOr(b.danger, null),
    lastMeasurementAt: measuredDate.toISOString(),
    lastMeasurementAgeHours: Math.round(ageHours * 10) / 10,
    narrativeRole: classifyNarrativeRole({ name, water, lat: coords.lat }),
  };
}
