# CLAUDE.md — Instructions for Claude Code sessions

> Ce fichier est le **premier point d'entrée** de toute session Claude Code sur ce repo.
> Il est aussi utile pour tout nouveau contributeur humain.

## Identité du projet

**AlpiMonitor** est un tableau de bord hydrologique du bassin de la Borgne (Valais, Suisse), développé en 13 jours comme démonstration technique pour une candidature au poste de **Développeur·se Front-End au CREALP** (Centre de recherche sur l'environnement alpin, Sion).

Stack : Vue 3 + Vite + TypeScript + Tailwind + Fastify + Prisma + PostgreSQL + D3 + Leaflet.
Méthodologie : Atomic Design avec convention ABEM.
Déploiement : Docker + Coolify sur VPS.

## Règles d'engagement absolues

1. **Lire les docs avant d'agir.** Tout prompt de dev doit s'appuyer sur les documents listés ci-dessous. Jamais de code sans contexte.
2. **YAGNI est une règle dure.** Ne pas implémenter ce qui n'est pas demandé. Pas d'abstraction "au cas où".
3. **ABEM strictement appliqué** pour les classes CSS, voir ADR-002.
4. **Aucune dépendance ajoutée sans justification** documentée dans le commit ou un ADR.
5. **Tests avant commit.** Une tâche n'est terminée que si les tests passent.
6. **Conventional commits** en anglais.
7. **Pas de Python, pas d'IA embarquée, pas de Vue Flow** (hors scope v1 — voir `docs/context/business.md`).
8. **L'auteur humain doit pouvoir défendre chaque ligne** en interview technique. Pas de code obscur ou "magique".

## Organisation du repo

```
alpimonitor/
├── CLAUDE.md                 ← ce fichier
├── README.md                 ← pitch public
├── apps/
│   ├── web/                  ← Vue 3 SPA
│   └── api/                  ← Fastify API + ingestion
├── packages/
│   └── shared/               ← types TS + schémas Zod partagés
├── docs/
│   ├── context/              ← métier, CREALP, données
│   ├── product/              ← brief, PRD, user stories
│   ├── architecture/         ← overview, data model, API, ADRs
│   ├── ui/                   ← design system
│   └── workflow/             ← conventions
├── docker-compose.yml
└── .github/workflows/
```

## Documents de référence (ordre de lecture recommandé)

### Pour comprendre le projet
1. `docs/context/business.md` — CREALP, le poste, le pourquoi
2. `docs/context/domain.md` — hydrologie, Val d'Hérens, glossaire
3. `docs/context/data-sources.md` — OFEV, flux XML, attribution
4. `docs/context/internal-projects.md` — synthèse des rapports d'activité CREALP 2022-2024 (équipe IT, MINERVE, GUARDAVAL, WATERWISE, vocabulaire institutionnel, storytelling)
5. `docs/product/brief.md` — vision produit 1 page
6. `docs/product/prd.md` — exigences fonctionnelles et non-fonctionnelles

### Pour coder
7. `docs/architecture/overview.md` — C4 niveaux 1-2, flux
8. `docs/architecture/data-model.md` — schéma Prisma commenté
9. `docs/architecture/api-contracts.md` — endpoints et DTOs
10. `docs/architecture/adr/` — décisions techniques individuelles
11. `docs/ui/design-system.md` — tokens, composants, a11y
12. `docs/workflow/conventions.md` — nommage, Git, tests

## Références rapides

### Quand je commence à coder…

- Je référence **explicitement** les docs pertinents dans mon prompt (ex: `@docs/ui/design-system.md` section 3.1)
- Je lis le code existant autour avant d'ajouter
- Je vérifie les conventions de nommage dans `docs/workflow/conventions.md`

### Quand je veux ajouter une dépendance…

- Je vérifie qu'elle n'est pas déjà installée
- Je documente la raison dans le commit (`feat(web): add leaflet for map rendering`)
- Si c'est une décision structurante, j'ajoute un ADR

### Quand je modifie le schéma DB…

- Je mets à jour `docs/architecture/data-model.md`
- Je génère une migration Prisma (`prisma migrate dev --name ...`)
- Je mets à jour le seed si nécessaire

### Quand je crée un nouveau composant Vue…

- Je respecte ABEM (`a-`, `m-`, `o-` préfixes)
- Je vérifie les atomes/molécules disponibles avant de créer un nouveau
- Je coche la check-list a11y de `docs/ui/design-system.md` section 5
- J'ajoute un test unitaire si logique non-triviale

### Quand je crée un endpoint API…

- Je documente le contrat dans `docs/architecture/api-contracts.md` (ou je vérifie qu'il l'est déjà)
- Je définis les schémas Zod dans `packages/shared/schemas/`
- Je traverse : route → service → domain → repository (Prisma)
- Je sérialise toujours en DTO explicite (jamais d'entité Prisma brute)

## État courant du projet

> **À mettre à jour à la fin de chaque session Claude Code.**

**Date dernière mise à jour** : 2026-04-22 (après-midi, après session Option A transparence sourcing)
**Deadline candidature CREALP** : 2026-04-30
**Production live** : https://alpimonitor.fr (SPA) + https://api.alpimonitor.fr (API). Auto-deploy sur push `main` via Coolify + GitHub App `sodigitaljeremy`.

### Next session pickup

> Tu reprends après la **session Option A — transparence du sourcing des stations** (pivot stratégique candidature). Avant de bosser : lis `CLAUDE.md` (cette section + État courant), `docs/STATUS.md`, [ADR-008](docs/architecture/adr/008-station-sourcing-transparency.md), [`docs/context/crealp-stations-sourcing.md`](docs/context/crealp-stations-sourcing.md), et les 3 runbooks `docs/runbooks/incident-2026-04-21.md`, `incident-2026-04-22-traefik-multihoming.md`, `incident-2026-04-22-archive-eacces.md`. Pas besoin de relire toute l'histoire.

**État commits locaux (non pushés au dernier snapshot) :**

- `8f9ffb5` feat(api): add sourcingStatus field to Station model
- `fb94f5a` feat(api): expose sourcingStatus on /stations endpoint
- `b5af019` feat(web): add sourcing status badge on research station cards
- `<hash>` docs(context): document station sourcing transparency (ADR-008) — rédaction en cours / fin de session Option A

**Prochaine étape (point 5) :** push groupé + polling Coolify 90s + validation prod (badges visibles sur https://alpimonitor.fr, `curl /api/v1/stations | jq '.data[] | select(.dataSource=="RESEARCH") | {name, sourcingStatus}'` conforme, re-run axe-core pour confirmer pas de régression a11y).

**Sans nouveau tag** : `v1.0.0-crealp` reste sur le commit de fin Bloc 4 (`0eaaad1`). La session Option A enrichit le v1 post-tag sans cérémonie v1.0.1.

**État au dernier push (2026-04-22 matin, Bloc 4 clôturé) :** 5 commits journée, tout stable. Lighthouse prod Desktop 96/100/100/100 · Mobile 90/100/96/100. 130 tests verts. Tag `v1.0.0-crealp` posé. 2 orphans Docker à cleanup après 24h (cf. mémoire `project_orphan_cleanups_pending.md`).

### Sprints livrés

- **Sprint 1 (J1-J3, 2026-04-18 → 2026-04-20)** — Fondations + deploy + CI. Monorepo pnpm, Docker compose dev, Prisma schema + migration init, seed idempotent (7 stations, 2 glaciers, 2 captages), CI GitHub Actions (lint + typecheck + tests + build), Dockerfiles multi-stage, déploiement Coolify sur VPS Hetzner derrière Traefik + Let's Encrypt.
- **Sprint 2 (J4-J7, 2026-04-20 → 2026-04-21)** — Backend ingestion + API + incident prod. Pivot LINDAS SPARQL (ADR-007, flux XML OFEV mort découvert à la discovery). Plugin cron 10 min, parser SPARQL, upsert Prisma idempotent. Endpoints `/stations`, `/stations/:id/measurements`, `/status`, `/health`. Incident 2026-04-21 (DB prod vidée, cause undetermined) → résolution défensive via `entrypoint.sh` + seed-on-boot, post-mortem `docs/runbooks/incident-2026-04-21.md`.
- **Sprint 3 — Temps 1 (J8-J10)** — Scaffold landing page. 6 sections (Hero / Map / KeyMetrics / WhyLindas / ResearchZones / Footer) en stub, design tokens, atomes ABEM, responsive 375 px validé, i18n vue-i18n (FR only).
- **Sprint 3 — Temps 2 (J11-J12, 2026-04-21)** — Câblage données live clôturé. T2-C1 CORS + useApi composable. T2-C2 status badge wired sur `/status`. T2-C3 carte Leaflet avec 7 markers LIVE/RESEARCH. T2-C4 drawer + chart D3 24 h. T2-C5 KeyMetrics live.
- **Sprint 3 — Temps 3 (J13, 2026-04-22)** — Polish technique + 2 incidents prod résolus. Bloc 1 : LinkedIn footer (`8a3b5d8`) + README v2 (`ee6bfdd`). Incident Traefik multi-homing 504 matinal → suppression du réseau custom (`d930bce` + runbook `f8ffadd`). Side finding archive EACCES silencieux depuis 2026-04-20 → Dockerfile mkdir+chown /app/var avant `USER app`, volume renommé `-v2` (`25d2b6e` + runbook `b0127aa`). Bloc 2 Lighthouse : `robots.txt` + `sitemap.xml` (`491afc2`), contraste WCAG AA sur tokens SPARQL URI + badge research theme-dark (`72c450a`), 6 headers sécurité via snippet `nginx-security-headers.conf` inclus dans server + locations (`2c5c1d7`). Scores finaux prod : Desktop 96/100/100/100 · Mobile 90/100/96/100.
- **Sprint 3 — Temps 4 (J14, 2026-04-22 matin, Bloc 4)** — Polish final clôturé. OG + Twitter Card (`9fb7019`), screenshots README via Puppeteer versionné (`f0fac41`), STATUS J13 (`06e539e`), PRD reconcilé Bloc 1+2+3 (`adc0dc7`), CLAUDE pickup (`0eaaad1`). Tag `v1.0.0-crealp` posé + poussé. Prod stable 90s post-swap.
- **Session Option A (J14, 2026-04-22 après-midi)** — Pivot stratégique transparence sourcing. Audit factuel des 3 stations RESEARCH → Bramois `CONFIRMED` (documentée crealp.ch), Les Haudères + Evolène `ILLUSTRATIVE`. Champ `Station.sourcingStatus` traversé du Prisma (`8f9ffb5`) au DTO (`fb94f5a`) à un atom dédié `ASourcingBadge` avec tooltip a11y sur cartes research (`b5af019`). Docs : ADR-008 + `context/crealp-stations-sourcing.md` + reconcile STATUS/PRD/CLAUDE. 139 tests verts (71 API + 68 web).

### Stack concrète (état shipped)

| Couche | Techno | Notes |
|---|---|---|
| Frontend | Vue 3 (Composition API), Vite 6, TypeScript strict | SPA single-page scrollable |
| State | **Pinia** (setup syntax) | `useStatusStore`, `useStationsStore` |
| i18n | **vue-i18n** | `fr.json` uniquement |
| HTTP | **fetch natif** via `useApi` composable | pas de vue-query / axios / tanstack-query |
| Styling | Tailwind + ABEM (ADR-002) | `@apply` dans `<style scoped>` |
| Cartographie | Leaflet 1.9 + tuiles **OSM** (pas swisstopo, cf. ADR-005 drift) | ResizeObserver + cleanup `map.remove()` |
| Charts | D3 modules (scale, shape, axis, time-format) | un seul composant `OHydroChart.vue` + `chart-model.ts` pur |
| Backend | Fastify 5 | monolithe API + cron (ADR-003) |
| ORM | Prisma 5 + PostgreSQL 16 | singleton via plugin, migrations versionnées |
| Validation | Zod dans `packages/shared/schemas/` | runtime + compile-time via `z.infer` |
| Ingestion | **LINDAS SPARQL** via `undici` fetch | cron interne 10 min, idempotent upsert |
| Observabilité | `pino` JSON stdout + `/health` + `/status` | `IngestionRun` persiste chaque tick |
| CI | GitHub Actions, Node 20, pnpm 10.33.0 | lint + typecheck + test + build sur push main + PR |
| Déploiement | Coolify (auto-deploy push main) + Traefik + Let's Encrypt | VPS Hetzner `95.216.196.69` |
| Tests | Vitest + @vue/test-utils + Testing Library | 71 API + 68 web = 139 au 2026-04-22 (après-midi) |

### Historique des sessions

- **2026-04-18** : Context pack (business, domain, data-sources, brief, PRD, architecture overview, data model, API contracts, 6 ADR, design system, conventions). Ajout `internal-projects.md` (synthèse rapports CREALP 2022-2024).
- **2026-04-20** : US-1.3 Prisma + /health. US-1.6 Dockerfiles + déploiement Coolify live. US-1.4 seed idempotent. US-1.5 CI workflow + badge.
- **2026-04-20 (v2)** : Discovery LINDAS → ADR-007. Ingestion SPARQL + cron + `Station.dataSource` + `IngestionRun`. Endpoints `/stations`, `/stations/:id/measurements`, `/status`.
- **2026-04-21** : Incident DB vidée + post-mortem + défense entrypoint.sh. Sprint 3 démarré : scaffold landing, design tokens, atomes ABEM, refactor `MStationCard`, purge CSS brute, responsive 375 px, design-system.md réconcilié.
- **2026-04-21 (Temps 2)** : T2-C1 CORS + useApi (`c0ef094`). T2-C2 status badge live (`dae6a2a`). T2-C3 Leaflet map (`47dabed`). T2-C4 drawer + chart D3 24 h (`044a749`).
- **2026-04-22 (J13 — Temps 3)** : 8 commits sur `main`. Bloc 1 (LinkedIn footer `8a3b5d8` + README v2 `ee6bfdd`). Fix Traefik multi-homing 504 (`d930bce` + runbook `f8ffadd`) — leçon : pas de réseau Docker custom sous Coolify. Fix archive EACCES latent (`25d2b6e` + runbook `b0127aa`) — leçon : `USER` non-root + named volume exigent `mkdir+chown` dans l'image. Bloc 2 Lighthouse : robots/sitemap (`491afc2`), contraste WCAG AA (`72c450a`), 6 headers sécurité nginx (`2c5c1d7`). Lighthouse prod Desktop 96/100/100/100 · Mobile 90/100/96/100. Outils audit créés hors repo : `/tmp/axe-runner/` (axe-core + CSP smoke Puppeteer).
- **2026-04-22 (J14 — Bloc 4 polish final)** : 5 commits + tag. OG + Twitter Card (`9fb7019`), screenshots README Puppeteer versionné (`f0fac41`), STATUS J13 (`06e539e`), PRD Bloc 1+2+3 shipped (`adc0dc7`), CLAUDE pickup (`0eaaad1`). Tag annotated `v1.0.0-crealp` posé + poussé. 130 tests verts. Prod stable 90s post-swap, validation OG + 6 headers sécurité.
- **2026-04-22 (J14 — Session Option A : transparence sourcing)** : 4 commits (non pushés au moment de la rédaction). Audit factuel stations RESEARCH contre `crealp.ch/monitoring-des-eaux-de-surface` → Bramois `CONFIRMED`, Les Haudères + Evolène `ILLUSTRATIVE`. Champ `Station.sourcingStatus` (Prisma + migration additive `8f9ffb5`), DTO verbatim SCREAMING_SNAKE (`fb94f5a`), atom `ASourcingBadge` + tooltip CSS a11y `role=tooltip` + `aria-describedby` sur cartes research (`b5af019`). Docs : ADR-008 + `context/crealp-stations-sourcing.md` + reconcile STATUS/PRD/CLAUDE (`<hash>` en cours). 139 tests verts (71 API + 68 web). Leçons : pattern de provenance typée extensible (MétéoSuisse, GLAMOS) ; palette Tailwind defaults pour variante unique (respect ADR-002) ; tooltip CSS sans lib tant que scope layout reste simple.

## Non-scope candidature (2026-04-30)

Ces features font partie du PRD initial mais sont **intentionnellement hors du livrable candidature**. Ne pas les implémenter sans validation explicite — leur absence est un parti-pris assumé.

- **Multi-pages** : pas de `/stations/:id`, `/compare`, `/alerts`. Le livrable est une **single-page scrollable** pour densité d'impression recruteur < 30 s.
- **Admin UI** : pas de `/admin/thresholds`, pas d'édition de seuils, pas de formulaires protégés.
- **Authentification** : pas de `POST /auth/login`, pas de JWT, pas de bcrypt, pas de cookies. Tout est read-only public.
- **Alertes** : pas de CRUD Alert, pas de détection d'anomalies (moyenne mobile ± 2σ), pas de panneau d'alertes, pas de notifications.
- **Export CSV** et **brush/zoom D3** : conservés backlog v2.
- **E2E Playwright** + **Lighthouse formel** : reportés Temps 4 si budget.
- **Python / FastAPI / ML / LLM embarqué** : stack TypeScript uniquement (ADR-001).
- **Vue Flow**, **Module 3D / photogrammétrie** (territoire 3DGEOWEB).
- **Multi-langue** (FR uniquement), **OAuth / multi-tenant**, **microservices**.
- **Helmet + rate limiting** : non wired (Fastify défauts), à faire si production réelle post-candidature.
- **Sources alt** : pas de MétéoSuisse SwissMetNet, pas de GLAMOS temps-réel, pas de scraping. Seul LINDAS est consommé (ADR-007).

Un recruteur qui demande "pourquoi X manque" doit pouvoir être renvoyé vers `docs/product/prd.md` section "État du périmètre" pour justification.

## Outils et commandes fréquentes

### Dev local

```bash
# Monorepo root
pnpm install                              # une seule fois
docker compose up -d postgres             # DB dev sur 5432
pnpm --filter @alpimonitor/api prisma:migrate   # applique migrations dev
pnpm --filter @alpimonitor/api prisma:seed      # seed idempotent

# Servir
pnpm --filter @alpimonitor/api dev        # API sur :3000 (+ cron ingestion si INGESTION_ENABLED)
pnpm --filter @alpimonitor/web dev        # SPA sur :5173
```

### Gates de qualité (à passer avant chaque commit)

```bash
pnpm format:check
pnpm lint
pnpm --filter @alpimonitor/web typecheck
pnpm --filter @alpimonitor/api typecheck
pnpm --filter @alpimonitor/web test
pnpm --filter @alpimonitor/api test
pnpm --filter @alpimonitor/web build
pnpm --filter @alpimonitor/api build
```

### Production / Coolify

- Auto-deploy sur `git push origin main` via GitHub App `sodigitaljeremy`.
- Smoke test : `curl https://api.alpimonitor.fr/api/v1/health` doit retourner `{"status":"ok","database":"ok"}`.
- Observabilité : `curl https://api.alpimonitor.fr/api/v1/status | jq` expose `ingestion.lastRun`.
- SSH VPS : `ssh root@95.216.196.69` (cohabitation avec `exploreiot`).
- Logs : via UI Coolify (ressource `alpimonitor-prod`, service `api`).
- Incident check DB : `docker exec <pg-container> psql -U alpimonitor -d alpimonitor -c 'SELECT COUNT(*) FROM "Station"'` devrait retourner 7.

### Où chercher quoi

- **Types partagés front/back** : `packages/shared/src/`
- **Schémas Zod** : `packages/shared/src/schemas/`
- **Ingestion LINDAS** : `apps/api/src/ingestion/lindas/`
- **Services API** : `apps/api/src/services/`
- **Pinia stores** : `apps/web/src/stores/`
- **Atomes/molécules/organismes Vue** : `apps/web/src/components/{atoms,molecules,organisms}/`
- **Runbooks / post-mortems** : `docs/runbooks/`

## Contacts et ressources

- Annonce CREALP : https://www.crealp.ch/wp-content/uploads/2026/04/Developpeur-se-FrontEnd_Annonce.pdf
- Contact recrutement : Frédéric Etter — +41 27 607 11 93
- 3DGEOWEB (produit existant à ne pas concurrencer) : https://www.3dgeoweb.crealp.ch
- OFEV / LINDAS : https://lindas.admin.ch/query (endpoint SPARQL), graph `<https://lindas.admin.ch/foen/hydro>`
- Référence incident : `docs/runbooks/incident-2026-04-21.md`
- Snapshot projet 30 secondes : `docs/STATUS.md`
