// Thin HTTP layer for the LINDAS SPARQL endpoint. Kept small so it can be
// swapped out in tests with a mock fetch.

// Env override is honoured so outage drills and staging can target a bad URL
// without code changes. Default: the real federal endpoint.
export const LINDAS_ENDPOINT = process.env.LINDAS_ENDPOINT ?? 'https://lindas.admin.ch/query';
export const HYDRO_GRAPH = 'https://lindas.admin.ch/foen/hydro';

export const HYDRO_SPARQL_QUERY = `
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

export interface SparqlFetchResult {
  body: string;
  bytes: number;
  httpStatus: number;
}

export type SparqlFetcher = (query: string) => Promise<SparqlFetchResult>;

export const fetchLindasSparql: SparqlFetcher = async (query) => {
  const res = await fetch(LINDAS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
      'User-Agent': 'AlpiMonitor/0.1 (+https://alpimonitor.fr; contact: sorianojeremyba@gmail.com)',
    },
    body: new URLSearchParams({ query }).toString(),
  });
  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`LINDAS SPARQL failed: HTTP ${res.status} ${res.statusText}`) as Error & {
      httpStatus: number;
    };
    err.httpStatus = res.status;
    throw err;
  }
  return { body, bytes: body.length, httpStatus: res.status };
};
