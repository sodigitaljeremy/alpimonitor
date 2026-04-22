# PRD — AlpiMonitor V1

> Product Requirements Document. Exigences fonctionnelles et non-fonctionnelles détaillées.
> Référence principale pour la décomposition en user stories et en tickets de développement.

## État du périmètre (audit 2026-04-22)

Ce PRD a été rédigé à J1 (2026-04-18) avec un scope délibérément large pour couvrir à la fois la **démonstration candidature CREALP** (13 jours, deadline 2026-04-30) et une **roadmap produit long-terme**. À J4 (2026-04-20), le pivot **LINDAS SPARQL** (ADR-007) a invalidé l'hypothèse "flux XML OFEV" qui sous-tendait toute la section ingestion. Les user stories ont donc été réorganisées autour du livrable candidature et d'un backlog post-candidature.

**Légende des statuts** :

- ✅ **DONE** — livré, référence commit donnée
- 🚧 **IN PROGRESS** — en cours dans le sprint en cours
- ⏭ **DEFERRED** — conservé, reporté au-delà du 2026-04-30 (backlog v2)
- ❌ **CANCELLED** — invalidé par une décision ultérieure (ADR, pivot scope, YAGNI)

**Scope candidature (livrable 2026-04-30)** : carte + fiche station drawer + graphique 24 h + ingestion LINDAS automatique + observabilité (`/status`, `/health`) + seed idempotent + CI + déploiement Coolify. **Lecture seule**, français uniquement, aucun compte utilisateur.

**Hors scope candidature mais conservé backlog** : comparaison multi-stations, alertes (détection + UI), admin seuils, export CSV, brush/zoom D3, E2E Playwright, Lighthouse formel. Ces items restent valides pour une continuation post-candidature mais ne seront pas utilisés comme critère d'évaluation par CREALP.

## 1. Exigences fonctionnelles

### 1.1 Vue d'ensemble du bassin (page d'accueil)

**FR-1.1.1** ✅ **DONE in 47dabed** — Carte interactive Leaflet centrée sur le Rhône valaisan, 7 stations (4 LIVE BAFU + 3 RESEARCH Borgne) géolocalisées.
**FR-1.1.2** ⏭ **DEFERRED** — Colorimétrie par état (vert/orange/rouge/gris) liée à la détection d'anomalies. **Motivation du report** : la détection d'anomalies (FR-1.6.5) et les alertes (1.4) sont hors scope candidature. La distinction actuelle `LIVE` (rempli, primary) vs `RESEARCH` (hollow, alpine) reflète la vraie ligne de fracture métier — le code couleur d'alerte s'y superposera quand les alertes arriveront.
**FR-1.1.3** ✅ **DONE in 044a749** — Tooltip léger sur les LIVE au survol (nom + dernier débit), clic → drawer. Spécification initiale légèrement adaptée : on ouvre directement le drawer plutôt qu'une tooltip + fiche séparée, cf. ADR du choix "tooltip → drawer, pas de popup LIVE" dans le commit T2-C4.
**FR-1.1.4** ✅ **DONE in 044a749** — Drawer latéral avec métadonnées + graphique 24 h. Pas de page séparée `/stations/:id` (décision recentrage candidature, cf. section 3.2 ci-dessous).
**FR-1.1.5** ⏭ **DEFERRED** — Liste textuelle alternative des stations (SEO + a11y clavier). **Motivation** : reste important pour WCAG AA complet mais hors budget T3. À traiter dans un Temps 4 a11y formel post-candidature.
**FR-1.1.6** ❌ **CANCELLED** — Panneau latéral d'alertes. **Motivation** : les alertes entières (épopée 1.4) sont hors scope candidature ; pas de panneau sans contenu.

### 1.2 Fiche station

**FR-1.2.1** ✅ **DONE in 044a749** — Métadonnées dans le drawer : nom, rivière, coordonnées, ofevCode. Altitude + opérateur + paramètres présents dans la DB (`StationDTO`), non affichés aujourd'hui faute de place utile dans le drawer actuel.
**FR-1.2.2** ⏭ **DEFERRED** — Dernière valeur + comparaison moyenne saisonnière. **Motivation** : la comparaison saisonnière requiert ≥ 1 an d'historique LINDAS accumulé, donc irréaliste en 13 jours (LINDAS n'expose que le tick courant ; l'historique naît du cron). Le drawer affiche les 24 h accumulées depuis le démarrage du cron — suffisant pour la démo.
**FR-1.2.3** ✅ **DONE in 044a749** (partiel) — Graphique D3 **24 h uniquement**. Sélecteur de période (7 j / 30 j / 90 j) ⏭ **DEFERRED** — même motivation que FR-1.2.2.
**FR-1.2.4** ❌ **CANCELLED** — Bande colorée de seuils en arrière-plan. **Motivation** : pas de seuils configurés en scope candidature (section 1.5 cancelled) ; bande colorée sans seuil est cosmétique.
**FR-1.2.5** ⏭ **DEFERRED** — Brush interactif D3. Hors scope candidature (le graphique 24 h est assez court pour une lecture directe, l'intérêt du brush apparaît sur 7 j+).
**FR-1.2.6** ⏭ **DEFERRED** — Export CSV. Hors scope candidature, trivial à ajouter en v2 (endpoint `/stations/:id/measurements.csv`).
**FR-1.2.7** ⏭ **DEFERRED** — Infobulle naturel/résiduel/dotation. Le champ `flowType` existe déjà dans le modèle mais n'est pas exposé dans l'UI v1.

### 1.3 Comparaison multi-stations

**FR-1.3.1 → FR-1.3.4** ❌ **CANCELLED (scope candidature)** — La page `/compare` est un feature post-candidature. **Motivation** : ajouter une page implique routing multi-page + sélecteur + overlays D3 (~2 j). Le livrable candidature est intentionnellement une **single-page scrollable** pour maximiser la densité d'impression en < 30 secondes de lecture recruteur. Conservé au backlog v2.

### 1.4 Alertes

**FR-1.4.1 → FR-1.4.4** ❌ **CANCELLED (scope candidature)** — **Motivation** : l'épopée alertes dépend de seuils (cancelled), de détection d'anomalies (deferred) et d'un cron d'évaluation post-ingestion. Le modèle Prisma `Alert` + `Threshold` reste en place (seed de démonstration) mais aucun code d'évaluation/UI n'est développé en v1 candidature. Conservé au backlog v2 si AlpiMonitor continue après l'entretien.

### 1.5 Administration des seuils (accès restreint)

**FR-1.5.1 → FR-1.5.5** ❌ **CANCELLED (scope candidature)** — **Motivation** : l'auth JWT + CRUD admin (2-3 j de dev) n'apporte aucune démonstration supplémentaire sur le poste Front-End. Le scope candidature est volontairement **read-only public, aucune page protégée**. Les seuils sont seedés en dur et immuables. Reporté en v2.

### 1.6 Ingestion des données (backend, pas d'UI)

**FR-1.6.1** ✅ **DONE in 10609b9** (US-2.1) — Cron 10 min (configurable via `INGESTION_INTERVAL_MIN`). **Pivot majeur** : la source n'est plus le XML OFEV (mort au moment de la discovery, cf. ADR-007) mais **LINDAS SPARQL**.
**FR-1.6.2** ❌ **REMPLACÉE par ADR-007** — Parsing XML → parsing **SPARQL JSON results** (voir `1fe5d36`).
**FR-1.6.3** ✅ **DONE in 1fe5d36** — Validation Zod des bindings SPARQL avant persistance (`packages/shared/schemas/ingestion.ts`).
**FR-1.6.4** ✅ **DONE in 1fe5d36** — Upsert idempotent sur `{stationId, parameter, timestamp}` (voir `apps/api/src/ingestion/lindas/`).
**FR-1.6.5** ⏭ **DEFERRED** — Détection d'anomalies statistiques (moyenne mobile ± 2σ). Hors scope candidature (lié aux alertes).
**FR-1.6.6** ⏭ **DEFERRED** — Création d'alertes sur seuil. Même motif que 1.5.
**FR-1.6.7** ✅ **DONE in 10609b9** — Logs pino structurés sur échec ; `IngestionRun` persiste chaque tick (status + `stationsSeenCount` + `measurementsInsertedCount`) pour observabilité via `/status`.

## 2. Exigences non-fonctionnelles

### 2.1 Performance

**NFR-2.1.1 → NFR-2.1.4** ✅ **DONE (J13, 2026-04-22)** — Lighthouse prod mesuré : Desktop **96/100/100/100** · Mobile **90/100/96/100** (performance / a11y / best practices / SEO). Bundle web : `382 kB js / 129 kB gzip + 63 kB css / 13 kB gzip`. Au-dessus de la cible NFR-2.1.3 (300 kB) ; Leaflet + D3 dominent, code-splitting ⏭ **DEFERRED** (pas de gain LCP mesurable vs complexité).

### 2.2 Accessibilité

**NFR-2.2.1 → NFR-2.2.6** ✅ (partiel) **DONE in 72c450a** — Contrastes WCAG AA validés sur sections sombres (tokens SPARQL URI + badge research theme-dark). Focus visible, aria-label sur drawer, Escape fermeture, scroll-lock. Lighthouse a11y prod = 100/100 Desktop · 100/100 Mobile. Audit axe-core informel via Puppeteer (`/tmp/axe-runner/`). **Restants ⏭ DEFERRED** : navigation clavier Leaflet (FR-1.1.5), tableau de données alternatif aux charts (NFR-2.2.5).

### 2.3 Responsive

**NFR-2.3.1** ✅ **DONE in f94a0b7** — 375 px validé (header, sections, cartes, drawer full-width en T2-C4).
**NFR-2.3.2** ✅ — Tokens Tailwind standards.
**NFR-2.3.3** ✅ **DONE in 044a749** (chart) + **47dabed** (map) — ResizeObserver sur OHydroChart + OStationMap.

### 2.4 Sécurité

**NFR-2.4.1** ✅ (partiel) **DONE in 2c5c1d7** — 6 headers sécurité servis par nginx côté SPA (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Cross-Origin-Opener-Policy) via snippet `nginx-security-headers.conf`. **Côté API Fastify ⏭ DEFERRED** — Helmet non wired, acceptable pour la démo read-only.
**NFR-2.4.2** ✅ **DONE in c0ef094** — CORS avec origines déclarées (`ALLOWED_ORIGINS` env).
**NFR-2.4.3** ⏭ **DEFERRED** — Rate limiting. Hors scope démo, CREALP peut tester tranquillement.
**NFR-2.4.4** ✅ — Zod systématique sur tous les endpoints (packages/shared/schemas/).
**NFR-2.4.5 → NFR-2.4.6** ❌ **CANCELLED** — JWT + bcrypt : liés à l'admin (section 1.5) cancelled.
**NFR-2.4.7** ✅ — Secrets via env uniquement, `.env.production.example` documente.
**NFR-2.4.8** ✅ — Prisma exclusivement, zéro SQL brut.
**NFR-2.4.9** ✅ — Pino sans PII.

### 2.5 Qualité du code

**NFR-2.5.1** ✅ — TS strict activé.
**NFR-2.5.2** ✅ **DONE in ce73196** — ESLint + Prettier + CI lint-staged.
**NFR-2.5.3** ✅ — ABEM appliqué (audit continu).
**NFR-2.5.4** ✅ — Code EN, UI FR (vue-i18n).
**NFR-2.5.5** ✅ — Conventional commits, vérifiés par l'historique.

### 2.6 Tests

**NFR-2.6.1** ✅ — Vitest sur logique métier (ingestion parser, services, stores). 71 tests API + 68 tests web = **139 tests verts** au 2026-04-22 (après-midi).
**NFR-2.6.2** ⏭ **DEFERRED** — Coverage formel ≥ 80 %. Pas mesuré aujourd'hui.
**NFR-2.6.3** ✅ (partiel) — `@vue/test-utils` sur OStationDrawer, stores, composables. Couverture exhaustive des composants reportée.
**NFR-2.6.4** ⏭ **DEFERRED** — E2E Playwright. Hors scope candidature (13 j serrés, ROI faible vs le reste).
**NFR-2.6.5** ✅ **DONE in ce73196** — CI GitHub Actions exécute lint + typecheck + tests + build sur push main + PR.

### 2.7 Déploiement et ops

**NFR-2.7.1** ✅ **DONE in 9d959d5** — Dockerfiles multi-stage api + web.
**NFR-2.7.2** ✅ **DONE in 66090dd** — `docker-compose.yml` dev.
**NFR-2.7.3** ✅ **DONE in 9d959d5** — Coolify sur Hetzner + HTTPS Traefik/Let's Encrypt.
**NFR-2.7.4** ✅ — `.env.production.example` versionné.
**NFR-2.7.5** ✅ **DONE in e9a35e1** — `/api/v1/health` avec check DB.
**NFR-2.7.6** ✅ — Pino JSON stdout.

### 2.8 Documentation

**NFR-2.8.1** ✅ **DONE in ee6bfdd + f0fac41** — README v2 : pitch, stack, quickstart, liens docs, badge CI, 2 screenshots live capturés via `scripts/screenshots.mjs` (reproducible Puppeteer).
**NFR-2.8.2** ✅ — Docs `docs/` étoffées : context (5), product (2), architecture (4 + 8 ADR), ui (1), workflow (1), runbooks (3). ADR-008 (sourcing transparency) + `context/crealp-stations-sourcing.md` ajoutés dans la session du 2026-04-22 après-midi.
**NFR-2.8.3** ⏭ **DEFERRED** — JSDoc formel. Privilégié commentaires "why non-obvious" inline.
**NFR-2.8.4** ⏭ **DEFERRED** — Mermaid pour flux. Candidat pour Temps 4.

## 3. User stories (livrées vs backlog)

### 3.1 Epics terminées (scope candidature)

#### Epic 1 — Setup et fondations ✅ **DONE (Sprint 1)**

- **US-1.1** ✅ Monorepo pnpm workspace + apps/web + apps/api + packages/shared — commit `5f3593b`
- **US-1.2** ✅ Docker compose dev — `66090dd`
- **US-1.3** ✅ Prisma schema + 10 models + migration init + /health — `e9a35e1`
- **US-1.4** ✅ Seed idempotent (7 stations, glaciers, captages) — `94d6038` + `1ca23c9`
- **US-1.5** ✅ CI GitHub Actions — `ce73196`
- **US-1.6** ✅ Déploiement Coolify + HTTPS — `9d959d5`

#### Epic 2 — Ingestion LINDAS (pivot ADR-007) ✅ **DONE (Sprint 2)**

- **US-2.1** ✅ Discovery LINDAS + cron + idempotent upsert — `733c8c3` + `df82f87` + `1fe5d36` + `10609b9`
- **US-2.2** ❌ Fetch XML OFEV — remplacée par SPARQL LINDAS (pivot ADR-007)
- **US-2.3 → US-2.4** ✅ Validation Zod + upsert Prisma — `1fe5d36`
- **US-2.5** ✅ Cron 10 min (configurable) — `10609b9`
- **US-2.6** ⏭ Détection d'anomalies — DEFERRED
- **US-2.7** ⏭ Création d'alertes — DEFERRED

#### Epic 3 — API Fastify 🚧 **PARTIEL (Sprint 2)**

- **US-3.1** ✅ `GET /stations` — `d6e5569`
- **US-3.2** ❌ `GET /stations/:id` détail complet — non implémenté, le drawer consomme `/stations` (liste) + cache client, suffisant pour v1
- **US-3.3** ✅ `GET /stations/:id/measurements` — `d6e5569`
- **US-3.4** ❌ `GET /alerts` — CANCELLED (épopée alertes deferred)
- **US-3.5 → US-3.6** ❌ `POST /auth/login` + `PUT /thresholds` — CANCELLED (admin)
- **US-3.7** ✅ (partiel) — CORS (`c0ef094`), Helmet/rate-limit DEFERRED
- **US-3.8** ✅ `/health` — `e9a35e1` ; `/status` observabilité bonus — `755b3fb`

#### Epic 4 — Front-end Vue 3 ✅ **DONE (Sprint 3, clôturé 2026-04-22)**

- **US-4.1 → US-4.2** ✅ Layout + design tokens — `7145e14` + `400f427`
- **US-4.3** ✅ Atomes ABEM (AIcon, ABadge, AButton, etc.) — progressivement depuis `7145e14`
- **US-4.4 → US-4.5** ✅ Molécules + organismes landing — `400f427` + `30ccf57` + `f00833f`
- **US-4.6** ✅ Carte Leaflet avec markers — `47dabed`
- **US-4.7** ✅ Drawer + chart D3 24 h (remplace "page station") — `044a749`
- **US-4.8** ❌ Page comparaison multi-stations — CANCELLED (scope candidature)
- **US-4.9** ❌ Page alertes — CANCELLED
- **US-4.10** ❌ Page admin seuils — CANCELLED
- **US-4.11** ✅ États loading/error/empty — câblés sur hero (T2-C2), map (T2-C3), drawer (T2-C4), KeyMetrics (T2-C5)
- **US-4.12** ✅ (partiel) Responsive + a11y — 375 px → 1440 px validé, contraste WCAG AA shipped `72c450a`, Lighthouse a11y 100/100

#### Epic 5 — Tests et qualité 🚧

- **US-5.1** ✅ Tests unitaires logique métier (70 API + 60 web = 130)
- **US-5.2** ✅ (partiel) Tests composants Vue
- **US-5.3** ⏭ E2E Playwright — DEFERRED
- **US-5.4** ✅ **DONE (2026-04-22)** — Lighthouse prod Desktop 96/100/100/100 · Mobile 90/100/96/100

#### Epic 6 — Déploiement et docs ✅ / 🚧

- **US-6.1** ✅ Dockerfiles multi-stage — `9d959d5`
- **US-6.2** ✅ Deploy Coolify + HTTPS — `9d959d5`
- **US-6.3** ✅ **DONE in ee6bfdd + f0fac41** — README final v2 + 2 screenshots live (script Puppeteer reproducible)
- **US-6.4** ✅ Smoke tests post-deploy — validés 2026-04-20

### 3.2 Décisions de recentrage (non prévues au PRD initial)

Les user stories suivantes ont été ajoutées ou redéfinies en cours de sprint pour adapter le livrable à la réalité du scope candidature :

- **Single-page scrollable plutôt que multi-pages** : pas de `/stations/:id`, `/compare`, `/alerts`. La landing page fait tout le job de mise en scène. **Motivation** : densité d'impression recruteur en < 30 s de lecture > dispersion multi-pages.
- **RESEARCH Borgne comme parti-pris narratif** : les 3 stations non-BAFU sont affichées explicitement en différenciation, ce qui permet de raconter "le réseau fédéral s'arrête ici, voici ce qui vit au-delà dans l'espace CREALP". Non prévu au PRD initial, émergé de la discovery ADR-007. Couvert par `OResearchZonesSection`.
- **Section narrative "Pourquoi LINDAS"** : explique le pivot ADR-007 à un recruteur. Couvert par `OWhyLindasSection`.
- **Observabilité `/status` + badge hero** : dépasse NFR-2.7.5 (juste `/health`). Couvre IngestionRun visibilité, dernière sync, count de mesures. Couvert par US-T2-C2 (`dae6a2a`).
