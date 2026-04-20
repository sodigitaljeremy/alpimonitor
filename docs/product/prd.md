# PRD — AlpiMonitor V1

> Product Requirements Document. Exigences fonctionnelles et non-fonctionnelles détaillées.
> Référence principale pour la décomposition en user stories et en tickets de développement.

## 1. Exigences fonctionnelles

### 1.1 Vue d'ensemble du bassin (page d'accueil)

**FR-1.1.1** L'utilisateur voit une carte interactive du bassin de la Borgne avec toutes les stations monitorées.
**FR-1.1.2** Chaque station est représentée par un marker coloré selon son état courant :
- Vert : état normal
- Orange : seuil de vigilance atteint
- Rouge : seuil d'alerte dépassé ou anomalie détectée
- Gris : station hors-ligne / données anciennes (> 2h sans update)
**FR-1.1.3** Au survol d'un marker, une tooltip affiche : nom station, dernière mesure, horodatage.
**FR-1.1.4** Au clic sur un marker, l'utilisateur accède à la fiche détaillée de la station.
**FR-1.1.5** Une liste textuelle des stations est disponible en complément de la carte (pour accessibilité clavier et SEO).
**FR-1.1.6** Un panneau latéral affiche le nombre d'alertes actives et permet d'y accéder.

### 1.2 Fiche station

**FR-1.2.1** Affichage des métadonnées : nom, rivière, altitude, coordonnées, opérateur, paramètres mesurés.
**FR-1.2.2** Carte d'état courant : dernière valeur de chaque paramètre + horodatage + comparaison à la moyenne saisonnière.
**FR-1.2.3** Graphique temporel D3 de chaque paramètre sur une période configurable (24h / 7j / 30j / 90j).
**FR-1.2.4** Bande colorée en arrière-plan du graphique indiquant les seuils (vigilance, alerte).
**FR-1.2.5** Brush interactif permettant de zoomer sur une sous-période.
**FR-1.2.6** Export CSV des données affichées.
**FR-1.2.7** Indication claire du type de débit : naturel / résiduel / dotation, avec infobulle explicative.

### 1.3 Comparaison multi-stations

**FR-1.3.1** L'utilisateur peut sélectionner 2 à 4 stations pour comparaison.
**FR-1.3.2** Graphique superposé D3 avec une courbe par station, couleurs distinctes.
**FR-1.3.3** Légende cliquable pour masquer/afficher une courbe.
**FR-1.3.4** Sélecteur de paramètre (débit, hauteur, température) — comparaison sur un seul paramètre à la fois.

### 1.4 Alertes

**FR-1.4.1** Liste paginée de toutes les alertes actives et historiques (30 derniers jours).
**FR-1.4.2** Chaque alerte affiche : station, type (seuil dépassé / anomalie), valeur, seuil, timestamp, durée.
**FR-1.4.3** Filtrage par station, par type, par niveau (vigilance/alerte).
**FR-1.4.4** Une alerte est close automatiquement dès que la mesure repasse sous le seuil.

### 1.5 Administration des seuils (accès restreint)

**FR-1.5.1** Authentification JWT par couple login/password en variables d'environnement (un seul admin en V1).
**FR-1.5.2** Liste des stations avec seuils courants.
**FR-1.5.3** Formulaire d'édition des seuils (vigilance, alerte) par station et par paramètre.
**FR-1.5.4** Validation côté serveur (Zod) : cohérence seuils (alerte > vigilance pour hauteur d'eau par ex.).
**FR-1.5.5** Historique des modifications de seuils (audit simple : qui, quand, valeur avant/après).

### 1.6 Ingestion des données (backend, pas d'UI)

**FR-1.6.1** Job de fetch du flux OFEV toutes les 10 minutes.
**FR-1.6.2** Parsing XML vers objets TypeScript typés.
**FR-1.6.3** Validation Zod de chaque mesure avant persistence.
**FR-1.6.4** Upsert idempotent (clé : stationId + parameter + timestamp).
**FR-1.6.5** Calcul des anomalies après chaque ingestion (moyenne mobile 30j + écart-type).
**FR-1.6.6** Création d'alerte si seuil dépassé ou anomalie statistique détectée.
**FR-1.6.7** Logs structurés (pino) en cas d'échec de fetch ou de parsing.

## 2. Exigences non-fonctionnelles

### 2.1 Performance

**NFR-2.1.1** Time to Interactive < 3s en 4G simulé, sur une page de station.
**NFR-2.1.2** Interaction chart (zoom, brush) < 100ms.
**NFR-2.1.3** Payload initial < 300 Ko (hors tuiles carto).
**NFR-2.1.4** Lighthouse Performance ≥ 90 sur desktop, ≥ 80 sur mobile.

### 2.2 Accessibilité

**NFR-2.2.1** Conformité WCAG 2.1 niveau AA visée.
**NFR-2.2.2** Navigation clavier complète, ordre de focus cohérent, focus visible.
**NFR-2.2.3** Contrastes texte/fond ≥ 4.5:1 pour texte normal, ≥ 3:1 pour texte large.
**NFR-2.2.4** Toute information communiquée par couleur est aussi communiquée autrement (icône, texte).
**NFR-2.2.5** Graphiques D3 accompagnés d'une alternative textuelle (tableau de données ou summary).
**NFR-2.2.6** Attributs ARIA appropriés sur composants interactifs.

### 2.3 Responsive

**NFR-2.3.1** Usage confortable à partir de 375px de large.
**NFR-2.3.2** Breakpoints Tailwind : sm (640), md (768), lg (1024), xl (1280).
**NFR-2.3.3** Graphiques D3 redimensionnés dynamiquement via ResizeObserver.

### 2.4 Sécurité

**NFR-2.4.1** Helmet activé avec CSP stricte.
**NFR-2.4.2** CORS restrictif (origines déclarées explicitement).
**NFR-2.4.3** Rate limiting sur tous les endpoints (60 req/min par IP par défaut).
**NFR-2.4.4** Validation Zod systématique des inputs.
**NFR-2.4.5** JWT signé HS256, refresh token court (15 min access / 7j refresh), cookies httpOnly SameSite=Strict.
**NFR-2.4.6** Bcrypt (coût ≥ 12) pour le mot de passe admin.
**NFR-2.4.7** Secrets en variables d'environnement, jamais dans le code ni les logs.
**NFR-2.4.8** Pas de SQL brut — tout via Prisma (protection injection).
**NFR-2.4.9** Logs sans PII ni secrets.

### 2.5 Qualité du code

**NFR-2.5.1** TypeScript strict mode activé.
**NFR-2.5.2** ESLint + Prettier configurés, pre-commit hook via simple-git-hooks ou husky.
**NFR-2.5.3** Convention ABEM appliquée aux classes CSS (voir `docs/ui/design-system.md`).
**NFR-2.5.4** Nommage en anglais pour le code, français pour les labels UI.
**NFR-2.5.5** Conventional commits.

### 2.6 Tests

**NFR-2.6.1** Tests unitaires Vitest sur la logique métier critique : calcul d'anomalies, évaluation de seuils, parsing XML, validations Zod.
**NFR-2.6.2** Coverage ≥ 80 % sur `src/domain` et `src/services`.
**NFR-2.6.3** Tests de composants Vue via Vitest + @vue/test-utils sur les composants interactifs clés.
**NFR-2.6.4** Un test E2E Playwright sur le happy path principal : ouvrir la carte → cliquer station → voir chart → brush période.
**NFR-2.6.5** Tous les tests tournent en CI (GitHub Actions) sur chaque push.

### 2.7 Déploiement et ops

**NFR-2.7.1** Application containerisée (Docker multi-stage builds).
**NFR-2.7.2** docker-compose.yml pour environnement local complet (app + postgres).
**NFR-2.7.3** Déploiement via Coolify sur VPS, domaine HTTPS.
**NFR-2.7.4** Variables d'environnement documentées dans `.env.example`.
**NFR-2.7.5** Healthcheck endpoint `/health` (backend).
**NFR-2.7.6** Logs structurés (JSON) redirigés vers stdout.

### 2.8 Documentation

**NFR-2.8.1** README.md racine : pitch, stack, architecture, quickstart, choix techniques, roadmap v2.
**NFR-2.8.2** Docs internes sous `docs/` (ce présent ensemble).
**NFR-2.8.3** JSDoc / TSDoc sur les fonctions publiques des services.
**NFR-2.8.4** Diagrammes Mermaid pour les flux principaux (ingestion, auth).

## 3. User stories (décomposition initiale)

> Ces user stories seront raffinées et tickétisées lors du sprint planning au J1 fin de journée.

### Epic 1 — Setup et fondations

- **US-1.1** Initialiser le monorepo (apps/web, apps/api, packages/shared)
- **US-1.2** Setup Docker compose (web + api + postgres)
- **US-1.3** Setup Prisma avec schéma initial + migrations
- **US-1.4** Seed de données de démo (4-6 stations + 90 jours de mesures)
- **US-1.5** Setup CI GitHub Actions (lint + test + build)

### Epic 2 — Ingestion OFEV

- **US-2.1** Discovery : script de listage des stations OFEV pertinentes
- **US-2.2** Service de fetch + parsing XML du flux OFEV
- **US-2.3** Validation Zod des mesures parsées
- **US-2.4** Upsert idempotent via Prisma
- **US-2.5** Scheduling cron 10 minutes
- **US-2.6** Détection d'anomalies statistiques
- **US-2.7** Création d'alertes sur seuil dépassé

### Epic 3 — API Fastify

- **US-3.1** GET /stations (liste)
- **US-3.2** GET /stations/:id (détail)
- **US-3.3** GET /stations/:id/measurements (série temporelle paramétrable)
- **US-3.4** GET /alerts (liste + filtres)
- **US-3.5** POST /auth/login (JWT)
- **US-3.6** PUT /stations/:id/thresholds (protégé admin)
- **US-3.7** Sécurité transverse : helmet, CORS, rate limit
- **US-3.8** Healthcheck /health

### Epic 4 — Front-end Vue 3

- **US-4.1** Layout global + navigation + footer (attribution OFEV)
- **US-4.2** Design system : tokens Tailwind + palette + typo
- **US-4.3** Atomes ABEM : Button, Badge, Input, Select, Icon, Spinner, StatusDot
- **US-4.4** Molécules : StationCard, AlertBanner, ThresholdBar, StatMetric
- **US-4.5** Organismes : StationList, AlertPanel, ComparisonPicker
- **US-4.6** Page d'accueil avec carte Leaflet + markers
- **US-4.7** Page station avec chart D3
- **US-4.8** Page comparaison multi-stations
- **US-4.9** Page alertes
- **US-4.10** Page admin seuils (protégée)
- **US-4.11** États de chargement / erreur / vide
- **US-4.12** Responsive + a11y

### Epic 5 — Tests et qualité

- **US-5.1** Tests unitaires logique métier
- **US-5.2** Tests composants Vue
- **US-5.3** Test E2E Playwright happy path
- **US-5.4** Audit Lighthouse et corrections

### Epic 6 — Déploiement et docs

- **US-6.1** Dockerfile multi-stage web + api
- **US-6.2** Deploy Coolify + domaine + HTTPS
- **US-6.3** README final avec diagrammes
- **US-6.4** Smoke tests post-deploy
