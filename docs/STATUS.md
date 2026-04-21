# AlpiMonitor — Statut en 30 secondes

> Ce document est un **snapshot projet**. Il est destiné à quelqu'un qui ouvre ce repo pour la première fois — typiquement un recruteur technique CREALP — et veut comprendre où on en est sans parcourir l'historique Git.
> Dernière mise à jour : 2026-04-21.

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
- **Tests** : Vitest + @vue/test-utils — 70 tests API + 49 tests web au 2026-04-21
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
- **Incident post-mortem** 2026-04-21 (perte de données prod, résolue par entrypoint défensif) documenté.

### Ce qui est hors scope candidature

Volontairement non-livré — absence assumée, pas un oubli :

- **Multi-pages** : pas de `/stations/:id`, `/compare`, `/alerts`. Single-page scrollable.
- **Admin / auth** : pas de login, pas de CRUD seuils, tout est read-only public.
- **Alertes et détection d'anomalies** : le modèle existe en DB, aucune UI ni logique d'évaluation.
- **Export CSV**, **brush/zoom D3**, **sélecteur 7 j / 30 j / 90 j** : reportés v2.
- **E2E Playwright**, **Lighthouse formel**, **audit axe-core** : audit informel seulement.
- **Multi-langue** (FR uniquement), **Python/ML**, **module 3D** (territoire 3DGEOWEB).
- **Helmet + rate limiting** côté API : défauts Fastify acceptés pour la démo.

Détail complet + justification : `docs/product/prd.md` section "État du périmètre".

## Prochaines étapes (avant 2026-04-30)

- **Temps 2 — C5** : câbler KeyMetrics sur données live (`/status`, compteurs `/stations`) + polish responsive.
- **Temps 3** : revue cross-sections, état loading/error uniforme, micro-animations d'entrée, contrôle des états vides.
- **Temps 4** : audit Lighthouse + axe-core, README final avec diagrammes, OG image, screenshots pour la lettre.

## Références rapides

- **Pitch + quickstart** : `README.md` (à la racine)
- **Instructions Claude Code** : `CLAUDE.md` (à la racine) — point d'entrée pour toute session IA
- **Vision produit** : `docs/product/brief.md`
- **Exigences annotées livré/deferred/cancelled** : `docs/product/prd.md`
- **Décisions techniques (7 ADR)** : `docs/architecture/adr/`
- **Design system** : `docs/ui/design-system.md`
- **Conventions code** : `docs/workflow/conventions.md`
- **Post-mortem incident 2026-04-21** : `docs/runbooks/incident-2026-04-21.md`
- **Contrats API** : `docs/architecture/api-contracts.md`
- **Modèle de données** : `docs/architecture/data-model.md`
