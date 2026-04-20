# AlpiMonitor

Tableau de bord hydrologique du bassin de la Borgne (Valais, Suisse) — projet de démonstration technique pour une candidature Front-End au [CREALP](https://www.crealp.ch).

Consomme les données ouvertes de l'Office fédéral de l'environnement (OFEV) et les met en scène pour une lecture rapide par les acteurs du territoire alpin.

## Stack

Vue 3 + Vite + TypeScript + Tailwind v3.4 · Fastify + Prisma + PostgreSQL · D3 · Leaflet · Docker + Coolify.

## Quickstart (dev)

Prérequis : Docker + Docker Compose v2.

```bash
git clone git@github.com:sodigitaljeremy/alpimonitor.git && cd alpimonitor
cp .env.example .env
docker compose up
```

Services :

- Web (Vite dev server) — <http://localhost:5173>
- API (Fastify) — <http://localhost:3000/api/v1/health>
- PostgreSQL — `localhost:5432` (user/pass/db dans `.env`)

Les sources `apps/*/src` et `packages/shared/src` sont bind-mountées — le hot-reload fonctionne sans rebuild.

## Déploiement (production)

Cible : Coolify v4 sur VPS Hetzner, Postgres containerisé, Traefik géré par Coolify pour le routage et TLS Let's Encrypt.

Fichiers concernés :

- `apps/api/Dockerfile` — image runtime multi-stage (tini PID 1, user non-root, `prisma migrate deploy` au démarrage)
- `apps/web/Dockerfile` + `apps/web/nginx.conf` — build Vite puis service statique via nginx alpine (SPA fallback, cache assets, gzip)
- `docker-compose.prod.yml` — une seule ressource Coolify regroupant `postgres` + `api` + `web`
- `.env.production.example` — variables à renseigner dans le panneau Coolify (`DATABASE_URL`, `CORS_ORIGINS`, `VITE_API_URL`, secrets Postgres)

Smoke test en local (images prod sans bind-mount) :

```bash
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up --build
```

Les domaines `alpimonitor.fr`, `www.alpimonitor.fr` et `api.alpimonitor.fr` sont mappés dans l'UI Coolify vers les services `web` (port 80) et `api` (port 3000).

## Documentation

La spec complète du projet vit dans `docs/` :

- `docs/context/` — métier, CREALP, sources de données
- `docs/product/` — brief, PRD, user stories
- `docs/architecture/` — overview C4, schéma Prisma, contrats API, ADRs
- `docs/ui/` — design system
- `docs/workflow/` — conventions

Le point d'entrée pour toute session Claude Code est `CLAUDE.md`.

## Licence et attributions

Données hydrologiques : [OFEV — hydrodaten.admin.ch](https://www.hydrodaten.admin.ch) · Fond cartographique : © [swisstopo](https://www.swisstopo.admin.ch).
