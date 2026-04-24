# §4 — Stratégie de solution

Les décisions top-level qui cadrent l'architecture, avant la décomposition détaillée de [§5](../05-building-block-view/index.md). Chaque choix renvoie à l'ADR qui le justifie.

## 4.1 Choix technologiques top-level

- **Stack TypeScript unique** ([ADR-001](../09-architectural-decisions/adr-001.md)) — Vue 3 + Fastify + Prisma + Node 20. Un seul langage, une seule toolchain `pnpm`. Élimine la friction Python/TypeScript qu'aurait demandée un backend FastAPI.
- **Monorepo pnpm + 3 workspaces** — `apps/web` (SPA Vue), `apps/api` (API + cron), `packages/shared` (types DTO + schémas Zod partagés). Un seul `pnpm install` à la racine, types partagés sans duplication ni sync manuelle.
- **Monolithe Fastify plutôt que microservices** ([ADR-003](../09-architectural-decisions/adr-003.md)) — l'API REST et le cron d'ingestion LINDAS vivent dans le même runtime Node 20. Charge attendue faible (cron 10 min, < 10 req/s UI), YAGNI applique.
- **PostgreSQL via Prisma** ([ADR-004](../09-architectural-decisions/adr-004.md)) — schéma typé end-to-end, migrations versionnées, zéro SQL brut dans le code produit.
- **Leaflet + OSM plutôt que swisstopo WMTS** ([ADR-005](../09-architectural-decisions/adr-005.md)) — stabilité, zero-cost attribution, pas de clé API à provisionner. Drift assumé vs l'ADR initial.
- **D3 vanilla plutôt que wrapper Vue** ([ADR-006](../09-architectural-decisions/adr-006.md)) — un seul organisme chart, logique pure extraite dans `lib/charts/chart-model.ts`, ResizeObserver local. Ajoute zéro dépendance par rapport à d3 déjà présent.
- **LINDAS SPARQL plutôt que XML OFEV** ([ADR-007](../09-architectural-decisions/adr-007.md)) — pivot en J4 après découverte que `hydroweb.xml` renvoie 404 depuis la migration BAFU vers LINDAS. Décision structurante qui a invalidé toute la section ingestion du PRD initial.

## 4.2 Décomposition top-level

```
alpimonitor/
├── apps/
│   ├── web/        # SPA Vue 3 + Vite + Pinia + Leaflet + D3
│   └── api/        # API Fastify + Prisma + cron LINDAS embarqué
├── packages/
│   └── shared/     # Types TS + schémas Zod partagés web ↔ api
└── docs/           # Documentation arc42 (ce site)
```

Trois workspaces, zéro service détaché. Le cron d'ingestion est un plugin Fastify (`onReady` hook) — pas un worker séparé, pas de queue, pas de Redis.

## 4.3 Approche architecturale (data flow)

Le flux principal est **pull depuis LINDAS → push vers le client via REST JSON** :

```
[LINDAS SPARQL]
     ↓ cron 10 min, plugin Fastify
[Parser SPARQL JSON + validation Zod]
     ↓
[Upsert Prisma idempotent sur {stationId, parameter, timestamp}]
     ↓
[IngestionRun persisté (trace + compteurs)]
     ↓                    ↓
[Postgres]            [GET /status]
     ↓
[GET /stations, GET /stations/:id/measurements]
     ↓
[SPA Vue — Pinia stores via façades composables]
     ↓
[Leaflet markers + D3 chart dans drawer]
```

Pas de SSE, pas de WebSocket, pas de push temps-réel côté client — **le client pull la dernière snapshot au chargement** (onMounted), puis un polling `/status` toutes les 60 s rafraîchit le badge de fraîcheur. La donnée tourne à l'échelle de la dizaine de minutes, un polling 60 s est largement suffisant.

## 4.4 Approche qualité

- **Gates CI obligatoires avant merge `main`** : `pnpm format:check` + `pnpm lint` + `pnpm --filter @alpimonitor/web typecheck` + `pnpm --filter @alpimonitor/api typecheck` + `pnpm test` + `pnpm build`. La CI GitHub Actions tourne à chaque push et PR.
- **Règle façade enforced côté web** ([ADR-010](../09-architectural-decisions/adr-010.md)) — aucun consumer prod n'importe `useStationsStore` directement. Vérifié par `grep -rn "useStationsStore" --include="*.vue" src/` (0 résultat). Le store n'est accessible qu'à travers les 3 façades `useStationsList`, `useStationSelection`, `useStationMeasurements`.
- **Tests pyramidés** : fonctions pures (`lib/charts`, `lib/map`, `lib/hydrodaten`) → composables (`useStationDrawer`, `useStationSelection`, `useStationMeasurements`) → composants intégration (`OHydroChart`, `OStationMap`, `OStationDrawer`). 173 tests verts (71 API + 102 web).
- **Seed idempotent + seed-on-boot** — chaque restart de l'API re-seed les tables de contexte (stations, glaciers, captages). Self-healing contre pertes de données ([§7 post-mortem 2026-04-21](../07-deployment-view/post-mortems/2026-04-21.md)).
- **Observabilité minimale mais factuelle** — `/api/v1/health` (probe DB, consommé par Coolify) + `/api/v1/status` (trace `IngestionRun.lastRun`, compteurs journée, threshold fraîcheur). Pino JSON stdout pour agrégation ultérieure.
