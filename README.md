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
