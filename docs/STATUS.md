# AlpiMonitor — Statut en 30 secondes

> Ce document est un **snapshot projet**. Il est destiné à quelqu'un qui ouvre ce repo pour la première fois — typiquement un recruteur technique CREALP — et veut comprendre où on en est sans parcourir l'historique Git.
> Dernière mise à jour : 2026-04-22 (après-midi).

## Objectif

Tableau de bord hydrologique du bassin de la Borgne (Valais, Suisse). Carte + fiche station + série temporelle 24 h sur les débits, alimentées en quasi temps-réel par les données fédérales suisses.

Développé en 13 jours comme **démonstration technique** pour une candidature au poste **Développeur·se Front-End CREALP** (Centre de recherche sur l'environnement alpin, Sion). Deadline 2026-04-30.

## Stack

- **Frontend** : Vue 3 + Vite + TypeScript strict + Tailwind (convention ABEM)
- **State / data** : Pinia (setup syntax), fetch natif via composable `useApi`, vue-i18n (FR)
- **Cartographie** : Leaflet 1.9 + tuiles OpenStreetMap
- **Charts** : D3 modules (scale, shape, axis, time-format) — pas de lib wrapper
- **Backend** : Fastify 5 + Prisma 5 + PostgreSQL 16
- **Validation** : Zod partagé front/back via `packages/shared/`
- **Ingestion** : LINDAS SPARQL (données hydro BAFU officielles), cron interne 10 min
- **Tests** : Vitest + @vue/test-utils — 70 tests API + 60 tests web = **130 tests verts** au 2026-04-22
- **CI / CD** : GitHub Actions (lint + typecheck + test + build) + Coolify auto-deploy sur push `main`
- **Hosting** : VPS Hetzner derrière Traefik + Let's Encrypt

Mono-stack TypeScript, monolithe Fastify, YAGNI assumé. Décisions structurantes documentées dans `docs/architecture/adr/001-007`.

## URLs live

- SPA : https://alpimonitor.fr
- API : https://api.alpimonitor.fr
- Observabilité : https://api.alpimonitor.fr/api/v1/status
- Health : https://api.alpimonitor.fr/api/v1/health

## Scope candidature (2026-04-30)

Ce qui doit fonctionner pour l'évaluation CREALP, et ce qui reste volontairement hors livraison.

### Ce qui fonctionne aujourd'hui

- Carte Leaflet du Rhône valaisan + Val d'Hérens avec **7 stations** : 4 BAFU LIVE (Rhône, données fédérales) + 3 RESEARCH Borgne (CREALP, non exposées publiquement — angle narratif assumé).
- Drawer latéral au clic sur une station LIVE : métadonnées (nom, ofevCode, rivière, coordonnées) + **graphique D3 de débit sur 24 h** avec tooltip hover.
- Hero section avec **badge de statut live** câblé sur `/api/v1/status` : affiche "En direct" + dernière synchronisation en minutes.
- Ingestion LINDAS automatique toutes les **10 minutes**, idempotente, tracée via un modèle `IngestionRun` persisté à chaque tick.
- Sections narratives : "Pourquoi LINDAS" (pivot technique ADR-007) et "Zones de recherche Borgne" (différenciation vs réseau fédéral).
- **Responsive 375 px → 1440 px** validé (drawer full-screen sous 768 px, 450 px au-dessus).
- **CI vert** sur chaque push main + PR. **Production auto-déployée**.
- **Lighthouse prod** : Desktop 96/100/100/100 · Mobile 90/100/96/100 (performance / a11y / best practices / SEO).
- **SEO** : `robots.txt` + `sitemap.xml` servis par nginx, meta description + Open Graph + Twitter Card.
- **Sécurité web** : 6 headers servis par nginx (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Cross-Origin-Opener-Policy).
- **Contraste WCAG AA** validé sur sections sombres (tokens SPARQL URI + badge research theme-dark).
- **Transparence du sourcing des stations** (ADR-008, session du 2026-04-22 après-midi) : champ `sourcingStatus` (`CONFIRMED` / `ILLUSTRATIVE`) exposé du Prisma schema au badge UI sur chaque carte research. Audit factuel documenté dans `docs/context/crealp-stations-sourcing.md`.
- **3 post-mortems incidents** documentés en runbooks (perte DB 2026-04-21, 504 Traefik multihoming 2026-04-22, archive EACCES silencieux 2026-04-22).

### Ce qui est hors scope candidature

Volontairement non-livré — absence assumée, pas un oubli :

- **Multi-pages** : pas de `/stations/:id`, `/compare`, `/alerts`. Single-page scrollable.
- **Admin / auth** : pas de login, pas de CRUD seuils, tout est read-only public.
- **Alertes et détection d'anomalies** : le modèle existe en DB, aucune UI ni logique d'évaluation.
- **Export CSV**, **brush/zoom D3**, **sélecteur 7 j / 30 j / 90 j** : reportés v2.
- **E2E Playwright** et **audit axe-core formel** : audit informel seulement (Lighthouse live a été mesuré, cf. scores ci-dessus).
- **Multi-langue** (FR uniquement), **Python/ML**, **module 3D** (territoire 3DGEOWEB).
- **Helmet + rate limiting côté API** : défauts Fastify acceptés pour la démo (les 6 headers sécurité web sont servis côté nginx SPA, cf. ci-dessus).

Détail complet + justification : `docs/product/prd.md` section "État du périmètre".

## Historique récent (J13-J14)

- **2026-04-22 (matin — Bloc 4 polish final)** : 5 commits — Open Graph + Twitter Card meta, screenshots README via Puppeteer versionné, STATUS + PRD + CLAUDE reconcilés avec l'état shipped, **tag `v1.0.0-crealp`** posé et poussé. Production stable 90s post-swap, validation OG meta + 6 headers sécurité en prod.
- **2026-04-22 (après-midi — Session Option A : transparence sourcing)** : 4 commits — champ `Station.sourcingStatus` + migration Prisma + seed reclassifié (5 CONFIRMED / 2 ILLUSTRATIVE), exposition DTO API verbatim, atom `ASourcingBadge` + intégration `MStationCard` avec tooltip a11y + tests (71 API + 68 web = 139 tests verts), **[ADR-008](architecture/adr/008-station-sourcing-transparency.md)** + [audit factuel `crealp-stations-sourcing.md`](context/crealp-stations-sourcing.md).

## Prochaines étapes (avant 2026-04-30)

Tous les blocs techniques du livrable candidature sont **shipped en prod**.

- **Push + validation prod** des 4 commits session Option A (non pushés au moment de cette mise à jour).
- **Backlog post-2026-04-30** : optimisation image API prod (406 Mo → ~200 Mo via `binaryTargets` Prisma), cleanup volumes/networks Docker orphelins, éventuelle Helmet + rate limiting côté API, E2E Playwright, recherche identifiants réels des stations `ILLUSTRATIVE` via portail Web Hydro CREALP (cf. ADR-008).

## Références rapides

- **Pitch + quickstart** : `README.md` (à la racine)
- **Instructions Claude Code** : `CLAUDE.md` (à la racine) — point d'entrée pour toute session IA
- **Vision produit** : `docs/product/brief.md`
- **Exigences annotées livré/deferred/cancelled** : `docs/product/prd.md`
- **Décisions techniques (8 ADR)** : `docs/architecture/adr/` (7 initiales + ADR-008 sourcing transparency)
- **Audit factuel du sourcing des stations** : `docs/context/crealp-stations-sourcing.md`
- **Design system** : `docs/ui/design-system.md`
- **Conventions code** : `docs/workflow/conventions.md`
- **Post-mortems incidents** :
  - `docs/runbooks/incident-2026-04-21.md` — perte de données prod, entrypoint défensif
  - `docs/runbooks/incident-2026-04-22-traefik-multihoming.md` — 504 post-rebuild, réseau custom supprimé
  - `docs/runbooks/incident-2026-04-22-archive-eacces.md` — archive LINDAS silencieusement bloquée (EACCES)
- **Contrats API** : `docs/architecture/api-contracts.md`
- **Modèle de données** : `docs/architecture/data-model.md`
