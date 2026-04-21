# OFEV discovery findings — 2026-04-20

Script: `apps/api/scripts/discover-ofev-stations.ts` (fetches the legacy XML).
Result: **legacy XML endpoint is dead**. BAFU has migrated public open-data to **LINDAS** (Linked Data Service, SPARQL).

## What the legacy URL returns

- Documented: `https://www.hydrodaten.admin.ch/lhg/az/xml/hydroweb.xml`
- Status: `HTTP 404` (all legacy `/lhg/az/xml/*` and `/graphs/*.xml` paths 404).
- The `hydrodaten.admin.ch` host now serves a Vue-like SPA. Raw XML is no longer public.

## Public open-data path today

`https://lindas.admin.ch/query` (SPARQL 1.1 endpoint).

Named graph: `<https://lindas.admin.ch/foen/hydro>` — 6402 triples.

Contents:

- 233 `HydroMeasuringStation` — federal BAFU stations on rivers and lakes
- 233 `cube:Observation` — **latest measurement only per station, updated ~hourly**
- 162 `schema:BodyOfWater` — rivers/lakes
- River observation fields: `waterLevel` (m, altitude-referenced), `discharge` (m³/s), `dangerLevel` (1–5), `measurementTime`, `station`
- Lake observation fields: `waterLevel`, `dangerLevel` (no discharge)
- **No temperature/turbidity in this graph** — separate graphs likely exist; to explore if needed
- **No historical time series** in LINDAS open endpoint — historical data requires BAFU subscription contract (SMS/FTP)

## Valais-central bbox result (lat 45.95–46.35, lon 7.20–7.75)

| OFEV code | Name   | Waterbody        | Lat, Lon          |
|-----------|--------|------------------|-------------------|
| 2011      | Sion   | Rhône            | 46.219, 7.358     |
| 2630      | Sion   | Sionne           | 46.231, 7.366     |
| 2117      | Le Châble, Villette | Drance de Bagnes | 46.081, 7.213 |

## Wider-Valais result (lat 45.80–46.45, lon 6.80–8.10)

Adds: Branson (Rhône), Porte du Scex (Rhône), Brig (Rhône + Saltina), Visp (Vispa),
Blatten (Lonza), Blatten/Naters (Massa), Klusmatten (Krummbach), Aigle, Chillon,
Oberried/Lenk (Simme), Simplonpass (Bisse kalte Wasser).

## Critical finding for AlpiMonitor

**There is no public BAFU station on La Borgne, Dixence, Ferpècle or any Val d'Hérens tributary.**

Likely cause: these water bodies are instrumented by:

- **Grande Dixence SA** (private operator data on captages)
- **Canton du Valais / CREALP** themselves (research-owned monitoring, not on the federal BAFU network)

Implication: the seed's `ofevCode: '2011' → 'Borgne — Bramois'` is **incorrect**. Station 2011 is Sion / Rhône. The example in `docs/context/data-sources.md` is misleading and needs a correction.

## Strategic options (to discuss)

### A. Pivot narrative to "Rhône alpin / Valais central"

Use real BAFU data on the Rhône + near-Borgne tributaries. The Borgne basin becomes a **contextual seed** (glaciers, captages) without live measurements.

- Pros: 100% real data, robust ingestion pipeline, clean story
- Cons: Loses the "bassin de la Borgne" identity that aligns with CREALP's Val d'Hérens research focus

### B. Keep Borgne scope, hybrid data

- Real live BAFU data on Rhône at Sion + neighboring Valais stations (proves pipeline)
- Seeded / historical fixtures for Borgne stations (clear UI disclaimer: "Données de démonstration — les données hydrologiques de la Borgne sont opérées par CREALP et ne sont pas publiques")
- Pitches awareness of CREALP's unique data position — honest framing for the interview

### C. Find alternative Borgne sources

- Scrape `3dgeoweb.crealp.ch` (the existing CREALP product) — risk of stepping on their toes
- Canton Valais open data portal — to probe
- Prolong the discovery phase by ~half a day

## Recommendation

**Option B**. It keeps the Borgne narrative, proves the ingestion works on live data, and turns the constraint into a selling point for the interview (understanding of what CREALP uniquely brings vs public open data).

## Artifacts produced

- `apps/api/tests/__fixtures__/ofev-hydroweb.xml` — NOT produced (fetch failed)
- `apps/api/scripts/output/` — this file, discovery-findings-2026-04-20.md
