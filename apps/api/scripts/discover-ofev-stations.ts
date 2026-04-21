// LINDAS hydro station discovery — standalone, no DB side effects.
//
// Queries the federal LINDAS SPARQL endpoint (graph foen/hydro), persists
// the raw JSON response (reused as test fixture), and emits a JSON report
// listing stations relevant to AlpiMonitor: Valais-central bbox + name
// fallback + freshness filter + narrative role tag. Rerunnable safely.
//
// Background: the legacy hydroweb.xml feed was retired — see ADR-007.
//
// Run: pnpm --filter @alpimonitor/api exec tsx scripts/discover-ofev-stations.ts

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type ParsedStation,
  type SparqlBinding,
  type SparqlResults,
  buildStation,
} from '../src/ingestion/lindas-parser.js';

const LINDAS_ENDPOINT = 'https://lindas.admin.ch/query';
const HYDRO_GRAPH = 'https://lindas.admin.ch/foen/hydro';

// Valais central bbox — Borgne basin (Val d'Hérens), Dixence, Rhône
// Sierre → Martigny. Kept generous for discovery; manual review narrows
// the shortlist.
const BBOX = {
  minLat: 45.95,
  maxLat: 46.35,
  minLon: 7.2,
  maxLon: 7.75,
};

// Name fallback — catches stations outside the bbox but relevant to
// the Valais story (Brig, Porte du Scex, Vispa etc.).
const NAME_PATTERN =
  /(borgne|dixence|rh[oô]ne|sion|sierre|brig|porte du scex|visp|vispa|branson|martigny|hauderes|haudères|evol[eè]ne|bramois|arolla|ferp[eè]cle|mont[- ]min[eé]|dix\b)/i;

const FRESHNESS_HOURS = 24;

// Ordered priority targets — the 4 LIVE stations anchoring the narrative.
const PRIORITY_CODES = ['2346', '2011', '2630', '2009'];

const SPARQL_QUERY = `
PREFIX ex: <http://example.com/>
PREFIX schema: <http://schema.org/>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX cube: <https://cube.link/>
PREFIX hydro: <https://environment.ld.admin.ch/foen/hydro/dimension/>

SELECT ?code ?name ?water ?wkt ?discharge ?waterLevel ?danger ?measuredAt
WHERE {
  GRAPH <${HYDRO_GRAPH}> {
    ?station a ex:HydroMeasuringStation ;
             schema:identifier ?code ;
             schema:name ?name ;
             geo:hasGeometry/geo:asWKT ?wkt .
    OPTIONAL { ?station schema:containedInPlace ?water }
    ?obs a cube:Observation ;
         hydro:station ?station ;
         hydro:measurementTime ?measuredAt ;
         hydro:dangerLevel ?danger .
    OPTIONAL { ?obs hydro:discharge ?discharge }
    OPTIONAL { ?obs hydro:waterLevel ?waterLevel }
  }
}
`;

// --- Discovery output ----------------------------------------------------

interface DiscoveredStation extends ParsedStation {
  isFresh: boolean;
  matchedByBbox: boolean;
  matchedByName: boolean;
  isPriorityTarget: boolean;
}

interface DiscoveryReport {
  discoveredAt: string;
  sourceEndpoint: string;
  graph: string;
  payloadBytes: number;
  totalStationsInFeed: number;
  shortlist: DiscoveredStation[];
  skippedStale: DiscoveredStation[];
  priorityTargetStatus: Array<{ code: string; status: 'fresh' | 'stale' | 'missing' }>;
  warnings: string[];
}

// --- Fetch ---------------------------------------------------------------

async function fetchSparql(query: string): Promise<{ body: string; bytes: number }> {
  const res = await fetch(LINDAS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
      'User-Agent':
        'AlpiMonitor-Discovery/0.1 (+https://alpimonitor.fr; contact: sorianojeremyba@gmail.com)',
    },
    body: new URLSearchParams({ query }).toString(),
  });
  if (!res.ok) {
    throw new Error(`LINDAS SPARQL failed: HTTP ${res.status} ${res.statusText}`);
  }
  const body = await res.text();
  return { body, bytes: body.length };
}

// --- Transform -----------------------------------------------------------

function enrichForDiscovery(
  base: ParsedStation,
  b: Record<string, SparqlBinding>
): DiscoveredStation {
  const matchedByBbox =
    base.latitude >= BBOX.minLat &&
    base.latitude <= BBOX.maxLat &&
    base.longitude >= BBOX.minLon &&
    base.longitude <= BBOX.maxLon;

  const matchedByName = NAME_PATTERN.test(`${base.name} ${base.waterBody ?? ''}`);

  return {
    ...base,
    isFresh: base.lastMeasurementAgeHours < FRESHNESS_HOURS,
    matchedByBbox,
    matchedByName,
    isPriorityTarget: PRIORITY_CODES.includes(b.code?.value ?? ''),
  };
}

// --- Main ----------------------------------------------------------------

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const apiRoot = resolve(scriptDir, '..');
  const fixturePath = resolve(apiRoot, 'tests/__fixtures__/lindas-hydro.json');
  const outputPath = resolve(scriptDir, 'output/lindas-discovery.json');

  console.log(`→ Querying ${LINDAS_ENDPOINT} (graph ${HYDRO_GRAPH})`);
  const { body, bytes } = await fetchSparql(SPARQL_QUERY);
  console.log(`  ${bytes.toLocaleString()} bytes received`);

  await mkdir(dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, body, 'utf-8');
  console.log(`  raw JSON saved → ${fixturePath}`);

  const parsed = JSON.parse(body) as SparqlResults;
  const stations: DiscoveredStation[] = [];
  for (const row of parsed.results.bindings) {
    const s = buildStation(row);
    if (s) stations.push(enrichForDiscovery(s, row));
  }
  console.log(`  parsed ${stations.length} stations`);

  const warnings: string[] = [];
  if (stations.length === 0) {
    warnings.push('No stations parsed — SPARQL response may have changed shape');
  }

  const candidates = stations.filter((s) => s.matchedByBbox || s.matchedByName);
  const shortlist = candidates.filter((s) => s.isFresh);
  const skippedStale = candidates.filter((s) => !s.isFresh);

  const priorityTargetStatus = PRIORITY_CODES.map((code) => {
    const found = stations.find((s) => s.ofevCode === code);
    if (!found) return { code, status: 'missing' as const };
    return { code, status: (found.isFresh ? 'fresh' : 'stale') as 'fresh' | 'stale' };
  });

  for (const p of priorityTargetStatus) {
    if (p.status !== 'fresh') {
      warnings.push(`Priority target ${p.code} is ${p.status}`);
    }
  }

  const report: DiscoveryReport = {
    discoveredAt: new Date().toISOString(),
    sourceEndpoint: LINDAS_ENDPOINT,
    graph: HYDRO_GRAPH,
    payloadBytes: bytes,
    totalStationsInFeed: stations.length,
    shortlist,
    skippedStale,
    priorityTargetStatus,
    warnings,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n=== Discovery summary ===`);
  console.log(`  stations in feed          : ${report.totalStationsInFeed}`);
  console.log(`  candidates (bbox + name)  : ${candidates.length}`);
  console.log(`  fresh (<${FRESHNESS_HOURS}h)            : ${shortlist.length}`);
  console.log(`  stale (filtered out)      : ${skippedStale.length}`);
  console.log(`  priority target statuses  :`);
  for (const p of priorityTargetStatus) {
    const marker = p.status === 'fresh' ? '✓' : p.status === 'stale' ? '~' : '✗';
    console.log(`    ${marker} ${p.code} → ${p.status}`);
  }
  if (warnings.length > 0) {
    console.log(`\n  warnings:`);
    for (const w of warnings) console.log(`    - ${w}`);
  }
  console.log(`\n  full report → ${outputPath}\n`);

  if (shortlist.length > 0) {
    console.log('  SHORTLIST:');
    for (const s of shortlist.sort((a, b) => a.ofevCode.localeCompare(b.ofevCode))) {
      const star = s.isPriorityTarget ? '★' : ' ';
      const q = s.dischargeMeasured !== null ? `Q=${s.dischargeMeasured}` : '';
      const wl = s.waterLevelMeasured !== null ? `WL=${s.waterLevelMeasured}` : '';
      const vals = [q, wl].filter(Boolean).join(' ');
      console.log(
        `   ${star}[${s.ofevCode}] ${s.name.padEnd(22)} | ${(s.waterBody ?? '?').padEnd(18)} | ${s.latitude.toFixed(3)},${s.longitude.toFixed(3)} | ${s.narrativeRole.padEnd(10)} | danger=${s.dangerLevel ?? '?'} | ${vals}`
      );
    }
  }
}

main().catch((err) => {
  console.error('Discovery failed:', err);
  process.exit(1);
});
