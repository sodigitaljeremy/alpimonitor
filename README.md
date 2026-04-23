# AlpiMonitor

[![CI](https://github.com/sodigitaljeremy/alpimonitor/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sodigitaljeremy/alpimonitor/actions/workflows/ci.yml)

Tableau de bord hydrologique du bassin de la Borgne (Valais, Suisse) — projet de démonstration technique pour une candidature Front-End au [CREALP](https://www.crealp.ch).

Consomme les données ouvertes de l'Office fédéral de l'environnement (OFEV/BAFU) via LINDAS SPARQL (cf. [ADR-007](./docs/architecture/adr/007-lindas-sparql-data-source.md)) et les met en scène pour une lecture rapide par les acteurs du territoire alpin.

## 🌐 Démo live

- Application : <https://alpimonitor.fr>
- API : <https://api.alpimonitor.fr/api/v1/health>
- Observabilité : <https://api.alpimonitor.fr/api/v1/status>
- Design system : <https://storybook.alpimonitor.fr> — 46 stories + 5 MDX (Atomic Design catalogue, cf. [ADR-009](./docs/architecture/adr/009-storybook-scope.md))

L'application est déployée en continu via Coolify sur push `main`. Les données affichées sont temps réel — le cron LINDAS agrège les débits du Rhône valaisan toutes les 10 minutes.

## 📸 Aperçu

### Vue d'ensemble (Hero)

![Hero AlpiMonitor — badge LIVE et chiffres clés du Rhône valaisan](./docs/screenshots/01-hero.png)

### Carte interactive des stations

![Carte Leaflet centrée sur le Valais avec les 7 stations hydrologiques (4 LIVE BAFU + 3 RESEARCH CREALP)](./docs/screenshots/02-map.png)

_Captures générées automatiquement via [`scripts/screenshots.mjs`](./scripts/screenshots.mjs) — relançables avec `node scripts/screenshots.mjs`._

## 📊 Faits marquants

- 13 jours de développement pour une candidature CREALP (deadline 30 avril 2026)
- 173 tests automatisés verts en CI (71 backend + 102 frontend)
- 10 ADR documentées dont 2 avec drifts d'implémentation assumés
- Pivot technique majeur en cours de projet : XML OFEV → LINDAS SPARQL ([ADR-007](./docs/architecture/adr/007-lindas-sparql-data-source.md))
- Production stable depuis 2026-04-20, ingestion 24/7 sans incident
- Architecture claire : monorepo pnpm, Atomic Design ABEM, hexagonal API, Docker multi-stage

## 🛠 Stack

- **Frontend** : Vue 3 + Vite + TypeScript strict + Tailwind v3.4 (convention ABEM) · Pinia · vue-i18n · Leaflet (tuiles OSM) · D3 (charts vanilla)
- **Backend** : Fastify 5 + Prisma 5 + PostgreSQL 16 · Zod (validation) · Pino (logs structurés) · cron interne (ingestion LINDAS)
- **Infra** : Docker multi-stage · pnpm workspaces · Coolify v4 sur Hetzner · Traefik + Let's Encrypt · GitHub Actions (lint + typecheck + tests + build)

## Quickstart (dev)

Prérequis : Docker + Docker Compose v2.

```bash
git clone git@github.com:sodigitaljeremy/alpimonitor.git && cd alpimonitor
cp .env.example .env
cp apps/web/.env.example apps/web/.env
docker compose up
```

Variables clés :

- `.env` (racine) — DB + API (`DATABASE_URL`, `CORS_ORIGINS`, `SEED_ON_BOOT`)
- `apps/web/.env` — front (`VITE_API_BASE_URL`), inliné dans le bundle au build

Services :

- Web (Vite dev server) — <http://localhost:5173>
- API (Fastify) — <http://localhost:3000/api/v1/health>
- PostgreSQL — `localhost:5432` (user/pass/db dans `.env`)

Les sources `apps/*/src` et `packages/shared/src` sont bind-mountées — le hot-reload fonctionne sans rebuild.

### Seed de démo

Données de contexte (bassin Borgne, 3 stations, capteurs, seuils, glaciers Ferpècle/Mont Miné, captages Grande Dixence) — idempotent, ré-exécutable à volonté :

```bash
pnpm --filter @alpimonitor/api exec prisma db seed
```

Les mesures hydrologiques arrivent via le cron LINDAS (toutes les 10 min).

## Déploiement (production)

Cible : Coolify v4 sur VPS Hetzner, Postgres containerisé, Traefik géré par Coolify pour le routage et TLS Let's Encrypt.

Fichiers concernés :

- `apps/api/Dockerfile` — image runtime multi-stage (tini PID 1, user non-root, `prisma migrate deploy` au démarrage)
- `apps/web/Dockerfile` + `apps/web/nginx.conf` — build Vite puis service statique via nginx alpine (SPA fallback, cache assets, gzip)
- `docker-compose.prod.yml` — une seule ressource Coolify regroupant `postgres` + `api` + `web`
- `.env.production.example` — variables à renseigner dans le panneau Coolify (`DATABASE_URL`, `CORS_ORIGINS`, `VITE_API_BASE_URL`, secrets Postgres)

Smoke test en local (images prod sans bind-mount) :

```bash
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up --build
```

Les domaines `alpimonitor.fr`, `www.alpimonitor.fr` et `api.alpimonitor.fr` sont mappés dans l'UI Coolify vers les services `web` (port 80) et `api` (port 3000).

## 🧠 Choix techniques notables

Quelques décisions assumées et documentées :

- **LINDAS SPARQL plutôt que XML OFEV** ([ADR-007](./docs/architecture/adr/007-lindas-sparql-data-source.md)) — le flux XML `hydroweb.xml` renvoie 404 depuis la migration BAFU vers la plateforme LINDAS. Pivot en cours de projet.
- **Single-page scrollable plutôt que multi-pages** ([PRD §3.2](./docs/product/prd.md)) — densité d'impression recruteur en moins de 30 secondes.
- **Tuiles OSM plutôt que swisstopo WMTS** ([ADR-005 drift](./docs/architecture/adr/005-leaflet-for-mapping.md)) — stabilité et zero-cost attribution pour la démo.
- **Atomic Design ABEM strict** ([ADR-002](./docs/architecture/adr/002-abem-methodology.md)) — préfixes `a-` / `m-` / `o-` / `t-` / `p-` sur 100% des composants Vue.
- **Transparence du sourcing des stations research** ([ADR-008](./docs/architecture/adr/008-station-sourcing-transparency.md)) — champ `sourcingStatus` orthogonal à `dataSource` distingue `CONFIRMED` (crealp.ch documenté) de `ILLUSTRATIVE` (placement plausible démo).
- **Storybook exhaustif, exclusions assumées** ([ADR-009](./docs/architecture/adr/009-storybook-scope.md)) — 15 composants présentationnels storyisés ; 3 organisms Pinia + Leaflet + router volontairement exclus pour éviter de mocker l'infra.
- **Façades feature-grouped + `lib/` domain-scoped** ([ADR-010](./docs/architecture/adr/010-post-refactor-architecture.md)) — pattern post-refactor : `composables/stations/` expose 3 façades read-only, aucun consumer prod n'importe `useStationsStore` directement (règle vérifiée par grep).
- **Lecture seule, pas d'auth** — l'épopée admin (alertes, seuils, JWT) est volontairement hors scope candidature.

## 📚 Documentation

Pour un aperçu rapide du projet : [`docs/STATUS.md`](./docs/STATUS.md) (snapshot une page).

Pour aller plus loin :

- [`docs/context/`](./docs/context/) — contexte métier, CREALP, sources de données
- [`docs/product/`](./docs/product/) — brief, PRD annoté avec statuts d'implémentation
- [`docs/architecture/`](./docs/architecture/) — overview C4, schéma Prisma, contrats API, 10 ADR
- [`docs/ui/`](./docs/ui/) — design system tokens et composants
- [`docs/runbooks/`](./docs/runbooks/) — post-mortems incidents prod
- [`docs/workflow/`](./docs/workflow/) — conventions Git, code, commits

Le point d'entrée pour toute session Claude Code est [`CLAUDE.md`](./CLAUDE.md).

## Versioning

Les tags git marquent les phases livrées, à lire dans l'ordre :

- [`v1.0.0-crealp`](https://github.com/sodigitaljeremy/alpimonitor/releases/tag/v1.0.0-crealp) — Livrable candidature initial : landing live, ingestion LINDAS temps réel, 7 stations cartographiées, Lighthouse Desktop 96/100/100/100.
- [`v1.1.0-refactor`](https://github.com/sodigitaljeremy/alpimonitor/releases/tag/v1.1.0-refactor) — Design system + architecture : Storybook exhaustif (46 stories, cf. [ADR-009](./docs/architecture/adr/009-storybook-scope.md)) et refactor architecture (façades feature-grouped, `lib/` domain-scoped, règle « aucun consumer prod hors façades » enforced, cf. [ADR-010](./docs/architecture/adr/010-post-refactor-architecture.md)).

## Licence et attributions

Données hydrologiques : [OFEV/BAFU via LINDAS](https://lindas.admin.ch) · Fond cartographique : © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
