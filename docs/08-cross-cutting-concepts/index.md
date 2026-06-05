# §8 — Concepts transverses

Les concepts qui s'appliquent de manière cohérente sur l'ensemble du code base — ni purement frontend ni purement backend. Chaque concept renvoie à son ADR ou à sa sous-page quand le détail l'exige.

## 8.1 Design system — Atomic Design + ABEM

Le design system est spécifié par [ADR-002](../09-architectural-decisions/adr-002.md) (ABEM) et [ADR-009](../09-architectural-decisions/adr-009.md) (Storybook scope). Il est catalogué et naviguable sur [`storybook.alpimonitor.fr`](https://storybook.alpimonitor.fr) — 15 composants présentationnels, 46 stories, 5 pages MDX design system.

Détail tokens, composants et règles éditoriales : [design-system.md](design-system.md).

## 8.2 Conventions Git, code et commits

- **Commits atomiques + conventional commits en anglais** (règle d'engagement 6 de `CLAUDE.md`).
- **ABEM strictement appliqué** sur 100 % des composants Vue ([ADR-002](../09-architectural-decisions/adr-002.md)).
- **Règle façade enforced** côté web : aucun consumer prod n'importe `useStationsStore` directement ([ADR-010](../09-architectural-decisions/adr-010.md)).
- **Gate `pnpm typecheck` fonctionnel** depuis le fix C1 (script `vue-tsc --noEmit --project tsconfig.app.json`, voir [passe-c-findings §C1](../10-risks-and-debt/passe-c-findings.md)).
- **Push feature branches régulièrement** pour déclencher la CI en avance, éviter la flakiness cross-env exposée au merge (mémoire projet `feedback_ci_feedback_loop`).

Détail par domaine : [conventions.md](conventions.md).

## 8.3 Observabilité

- **Logs structurés Pino JSON stdout** sur l'API, captés par Coolify. Pas de PII, pas d'IP en clair en base.
- **`/api/v1/health`** — liveness probe minimaliste avec probe DB (`SELECT 1`). Consommé par Coolify/Traefik.
- **`/api/v1/status`** — expose `IngestionRun.lastRun`, `lastSuccessAt`, `healthyThresholdMinutes`, compteurs journée. Lu par `MStatusBadge` dans le hero UI (polling 60 s).
- **`/api/v1/ai/status`** — observabilité de la **couche IA** ([ADR-012](../09-architectural-decisions/adr-012.md), D). Agrège les `LlmCallRun` du jour (`callsToday`, `errorRate`, `costUsdToday`, `avgLatencyMs`). Un décorateur `ObservingLlmClient` persiste **un `LlmCallRun` par appel LLM**, succès comme échec, étiqueté par `operation` (`narration` pour A, `chat` pour C) — **la même observabilité couvre narration et chat**, et alimente le plafond coût du chat (cf. [§8.9](#89-couche-ia-grounding-strict-observabilite-et-gardes)).
- **Pas d'APM, pas de tracing distribué** — hors scope v1, cf. [§10 non-scope](../10-risks-and-debt/index.md).

## 8.4 Sécurité

- **6 headers nginx** côté SPA : HSTS (`max-age=31536000; includeSubDomains`), CSP, X-Frame-Options `DENY`, X-Content-Type-Options `nosniff`, Referrer-Policy `strict-origin-when-cross-origin`, Cross-Origin-Opener-Policy `same-origin`.
- **CORS allowlist côté API** — aucune étoile, `CORS_ORIGINS` env. Origines dev + prod whitelistées explicitement.
- **Container non-root** (`USER app`) + volume pre-créé + chowné dans le Dockerfile avant `USER` (lesson [post-mortem EACCES](../07-deployment-view/post-mortems/2026-04-22-eacces.md)).
- **Zod systématique** — validation runtime sur tous les endpoints. Payload malformé → 400 `VALIDATION_ERROR`, pas de crash.
- **Helmet + rate-limit API global** reportés post-candidature (read-only public acceptable pour démo). **Exception ciblée** : `POST /ask` (couche IA C, appels LLM payants) est protégé par un **rate-guard maison** (plafond coût $0,50/j + fenêtres par IP 5/min & 20/j) — refus 429 **avant tout appel LLM**, cf. [§8.9](#89-couche-ia-grounding-strict-observabilite-et-gardes).
- **Appels LLM server-side uniquement** — la CSP actuelle (`connect-src 'self'`) interdit déjà tout appel LLM depuis le navigateur. Clés (`MISTRAL_API_KEY`) par env, jamais committées.

## 8.5 Internationalisation

- **`vue-i18n` FR uniquement en v1.** Clés `fr.json` servies via `useI18n().t(key)` et `useI18nList<T>(key)` (composable dédié pour les arrays).
- **Multi-langue = backlog v2.** Le public cible CREALP est francophone. Ajouter `en`/`de` impliquerait deux locales à maintenir sans gain immédiat.
- **Labels UI en français**, code / commits / ADR en **anglais** pour le premier, **français** pour les autres ([§2.2 contraintes](../02-constraints-and-quality/index.md)).

## 8.6 Gestion d'erreurs

- **`ApiError` union discriminée côté web** — `network | http | parse`. Chaque consumer nomme sa branche via le compilateur TS. `apiErrorMessage(error)` centralise le rendu texte pour les logs / fallbacks ([ADR-010 §1.3](../09-architectural-decisions/adr-010.md)).
- **Ingestion LINDAS non-fatal** — un échec d'archive disque logue `warn` mais ne fait pas échouer l'upsert mesures. L'API reste up même si LINDAS est down (fallback seed + badge "données indisponibles").
- **`entrypoint.sh` tolérant au seed échoué** — `prisma migrate deploy` fatal, `prisma db seed` non-fatal (warn + continue). Une seed cassée ne met pas l'API offline ([post-mortem 2026-04-21](../07-deployment-view/post-mortems/2026-04-21.md)).

## 8.7 Tests — pyramide

- **Fonctions pures** (`lib/charts/chart-model`, `lib/map/station-map-mapping`, `lib/hydrodaten`) — tests unitaires Vitest, pas de mount, pas de Pinia.
- **Composables** (`useStationDrawer`, `useStationsList`, `useStationSelection`, `useStationMeasurements`, `useEscapeClose`, `useScrollLock`, `usePolling`) — tests via composant probe + `effectScope`.
- **Intégration composants** (`OHydroChart`, `OStationMap`, `OStationDrawer`, `OKeyMetricsSection`, `MStationCard`, `ASourcingBadge`) — `@vue/test-utils` + mount + assertions DOM.
- **API** — routes (`health`, `status`, `stations`, `station-measurements`, `station-status`, `cors`) + ingestion (`lindas-parser`, `lindas-ingestion`) + **couche IA** : narration (features pures, cache `Insight`), observabilité (`computeCostUsd`, `ObservingLlmClient`), anomalie (`detectAnomaly` pur, scan), **chat** (`chat-service` sur `QueryPort` en mémoire — **sans DB**, `rate-guard` à horloge injectée, dispatcher des 4 tools).
- **Total** : **344 tests verts (208 API + 136 web)** — dont la couche IA additive (A+D+B+C). Pas de E2E Playwright en v1 (reporté backlog).

## 8.8 Gestion de la documentation

- **Source de vérité** — ce dossier `docs/` (arc42, ce site) + les ADR dans `docs/architecture/adr/` (sources migrées ici §9).
- **Règle de dépendance** — un changement de décision = mise à jour du doc concerné + ADR si structurant. Un ADR obsolète passe à `Statut: Superseded by ADR-XXX`, jamais supprimé.
- **README racine court** — pointe vers `docs.alpimonitor.fr` (cette doc) et `storybook.alpimonitor.fr` pour les détails.

## 8.9 Couche IA — grounding strict, observabilité et gardes

Concepts transverses qui s'appliquent à **toute** la couche IA ([ADR-012](../09-architectural-decisions/adr-012.md)), additive et isolée du flux LINDAS → Prisma → API.

- **Grounding STRICT** — partout, le LLM ne fait que *reformuler* des faits déjà calculés / récupérés : narration (features pures pré-calculées, A), chat (faits récupérés via le `QueryPort`, C). Il **ne prédit rien, n'invente rien, n'extrapole rien**. Hors périmètre des données récupérées → **« je ne peux pas répondre »** (chat). Toute valeur chiffrée d'une sortie IA provient d'une donnée groundée.
- **Sorties IA jamais présentées comme vérité hydrologique** — narration étiquetée « résumé assisté par IA », chat avec disclaimer + **trace des tools** réellement appelés, anomalie étiquetée « statistique, non calibrée hydrologie experte ». Lignée de la transparence de sourcing ([ADR-008](../09-architectural-decisions/adr-008.md)).
- **Provider derrière une interface isolée** (`ai/llm-client.ts`) — le code produit ne connaît jamais Mistral en direct. Client **LiteLLM-ready** (OpenAI-compatible via `LITELLM_BASE_URL`) mais **proxy LiteLLM non déployé** — point d'extension assumé, pas une fonctionnalité livrée.
- **Observabilité unifiée** — un `LlmCallRun` par appel (succès/échec), discriminé par `operation` (`narration` | `chat`), agrégé sur `/ai/status`. La **même** source alimente le plafond coût du chat.
- **Garde unifié du seul endpoint coûteux** (`POST /ask`) — plafond coût quotidien ($0,50, disjoncteur global lu depuis l'observabilité) **+** rate-limit par IP (5/min, 20/j), dans un seul garde maison testable à horloge injectée. Refus **429 avant tout appel LLM**.
- **Hexagonal localisé** — la frontière ports/adapters (`QueryPort` / `PrismaQueryAdapter`) n'existe qu'à la couche chat (C), où elle a une vraie valeur (testabilité du raisonnement sans DB). Le reste du backend **reste volontairement plat** (YAGNI, [ADR-003](../09-architectural-decisions/adr-003.md)) — on n'hexagonalise pas « par cohérence ».
- **Retrieval structuré, jamais vectoriel** — function-calling sur 4 fonctions whitelistées, **pas de text-to-SQL, pas d'embeddings, pas de vector store** (sur-ingénierie écartée pour ~10 stations de données structurées, [ADR-012 alternatives](../09-architectural-decisions/adr-012.md)).
