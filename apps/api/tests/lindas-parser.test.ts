import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  type SparqlBinding,
  type SparqlResults,
  asNumberOr,
  buildStation,
  classifyNarrativeRole,
  decodeWaterBody,
  parseWkt,
} from '../src/ingestion/lindas-parser.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(here, '__fixtures__/lindas-hydro.json');

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as SparqlResults;

// Pinned reference date: the fixture was captured 2026-04-20, so we freeze
// the clock just after the latest expected measurement for age math.
const NOW = new Date('2026-04-20T22:00:00Z');

function bindingsForCode(code: string): Record<string, SparqlBinding> | undefined {
  return fixture.results.bindings.find((b) => b.code?.value === code);
}

describe('parseWkt', () => {
  it('returns lon-first coordinates from a POINT literal', () => {
    expect(parseWkt('POINT(7.358 46.219)')).toEqual({ lat: 46.219, lon: 7.358 });
  });

  it('accepts negative longitudes and extra whitespace', () => {
    expect(parseWkt('POINT(  -7.5   46.1  )')).toEqual({ lat: 46.1, lon: -7.5 });
  });

  it('returns null on non-POINT literals', () => {
    expect(parseWkt('LINESTRING(7 46, 8 47)')).toBeNull();
  });

  it('returns null on malformed numbers', () => {
    expect(parseWkt('POINT(abc def)')).toBeNull();
  });
});

describe('asNumberOr', () => {
  it('parses numeric literal bindings', () => {
    expect(asNumberOr({ type: 'literal', value: '1.23' }, null)).toBe(1.23);
  });

  it('returns fallback when binding is absent', () => {
    expect(asNumberOr(undefined, null)).toBeNull();
    expect(asNumberOr(undefined, 0)).toBe(0);
  });

  it('returns fallback on non-numeric literal', () => {
    expect(asNumberOr({ type: 'literal', value: 'not-a-number' }, null)).toBeNull();
  });
});

describe('decodeWaterBody', () => {
  it('decodes URL-encoded tail', () => {
    expect(decodeWaterBody('https://ex.org/waterbody/Rh%C3%B4ne')).toBe('Rhône');
  });

  it('returns null for undefined', () => {
    expect(decodeWaterBody(undefined)).toBeNull();
  });

  it('returns null for URI with empty tail', () => {
    expect(decodeWaterBody('https://ex.org/waterbody/')).toBeNull();
  });
});

describe('classifyNarrativeRole', () => {
  it('tags Porte du Scex as outlet', () => {
    expect(classifyNarrativeRole({ name: 'Porte du Scex', water: 'Rhône', lat: 46.35 })).toBe(
      'outlet'
    );
  });

  it('tags Brig as upstream', () => {
    expect(classifyNarrativeRole({ name: 'Brig', water: 'Rhône', lat: 46.317 })).toBe('upstream');
  });

  it('tags Sion as confluence', () => {
    expect(classifyNarrativeRole({ name: 'Sion', water: 'Rhône', lat: 46.22 })).toBe('confluence');
  });

  it('falls back on latitude heuristic for unknown names', () => {
    expect(classifyNarrativeRole({ name: 'Anonymous', water: null, lat: 46.5 })).toBe('upstream');
    expect(classifyNarrativeRole({ name: 'Anonymous', water: null, lat: 46.0 })).toBe('outlet');
    expect(classifyNarrativeRole({ name: 'Anonymous', water: null, lat: 46.3 })).toBe('unknown');
  });
});

describe('buildStation (from real LINDAS fixture)', () => {
  it('parses Sion/Rhône (2011) into a ParsedStation', () => {
    const binding = bindingsForCode('2011');
    expect(binding).toBeDefined();
    const s = buildStation(binding!, NOW);
    expect(s).not.toBeNull();
    expect(s).toMatchObject({
      ofevCode: '2011',
      name: 'Sion',
      waterBody: 'Rhône',
      narrativeRole: 'confluence',
    });
    expect(s!.latitude).toBeCloseTo(46.22, 1);
    expect(s!.longitude).toBeCloseTo(7.36, 1);
    expect(s!.dischargeMeasured).toBeGreaterThan(0);
  });

  it('parses Brig/Rhône (2346) as upstream', () => {
    const s = buildStation(bindingsForCode('2346')!, NOW);
    expect(s?.narrativeRole).toBe('upstream');
    expect(s?.waterBody).toBe('Rhône');
  });

  it('parses Porte du Scex (2009) as outlet', () => {
    const s = buildStation(bindingsForCode('2009')!, NOW);
    expect(s?.narrativeRole).toBe('outlet');
  });

  it('returns null when a required binding is missing', () => {
    expect(buildStation({}, NOW)).toBeNull();
    expect(
      buildStation(
        { code: { type: 'literal', value: '9999' } } as Record<string, SparqlBinding>,
        NOW
      )
    ).toBeNull();
  });

  it('returns null on invalid WKT', () => {
    const bad: Record<string, SparqlBinding> = {
      code: { type: 'literal', value: '9999' },
      name: { type: 'literal', value: 'Bad' },
      wkt: { type: 'literal', value: 'POINT(foo bar)' },
      measuredAt: { type: 'literal', value: '2026-04-20T20:00:00Z' },
    };
    expect(buildStation(bad, NOW)).toBeNull();
  });

  it('returns null on invalid timestamp', () => {
    const bad: Record<string, SparqlBinding> = {
      code: { type: 'literal', value: '9999' },
      name: { type: 'literal', value: 'Bad' },
      wkt: { type: 'literal', value: 'POINT(7.3 46.2)' },
      measuredAt: { type: 'literal', value: 'not-a-date' },
    };
    expect(buildStation(bad, NOW)).toBeNull();
  });

  it('computes age in hours relative to the provided clock', () => {
    const fake: Record<string, SparqlBinding> = {
      code: { type: 'literal', value: '0000' },
      name: { type: 'literal', value: 'Fake' },
      wkt: { type: 'literal', value: 'POINT(7.3 46.2)' },
      measuredAt: { type: 'literal', value: '2026-04-20T20:00:00Z' },
    };
    const s = buildStation(fake, NOW);
    expect(s?.lastMeasurementAgeHours).toBe(2);
  });
});

describe('fixture integrity', () => {
  it('contains all four priority BAFU stations', () => {
    for (const code of ['2346', '2011', '2630', '2009']) {
      expect(bindingsForCode(code), `priority code ${code} missing`).toBeDefined();
    }
  });

  it('parses into at least 200 valid stations (federal hydro network size)', () => {
    const parsed = fixture.results.bindings
      .map((b) => buildStation(b, NOW))
      .filter((s): s is NonNullable<typeof s> => s !== null);
    expect(parsed.length).toBeGreaterThanOrEqual(200);
  });
});
