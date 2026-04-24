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
- **Pas d'APM, pas de tracing distribué** — hors scope v1, cf. [§10 non-scope](../10-risks-and-debt/index.md).

## 8.4 Sécurité

- **6 headers nginx** côté SPA : HSTS (`max-age=31536000; includeSubDomains`), CSP, X-Frame-Options `DENY`, X-Content-Type-Options `nosniff`, Referrer-Policy `strict-origin-when-cross-origin`, Cross-Origin-Opener-Policy `same-origin`.
- **CORS allowlist côté API** — aucune étoile, `CORS_ORIGINS` env. Origines dev + prod whitelistées explicitement.
- **Container non-root** (`USER app`) + volume pre-créé + chowné dans le Dockerfile avant `USER` (lesson [post-mortem EACCES](../07-deployment-view/post-mortems/2026-04-22-eacces.md)).
- **Zod systématique** — validation runtime sur tous les endpoints. Payload malformé → 400 `VALIDATION_ERROR`, pas de crash.
- **Helmet + rate-limit API** reportés post-candidature (read-only public acceptable pour démo).

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
- **API** — 71 tests sur routes (`health`, `status`, `stations`, `station-measurements`, `station-status`, `cors`) + ingestion (`lindas-parser`, `lindas-ingestion`).
- **Total** : 173 tests verts. Pas de E2E Playwright en v1 (reporté backlog).

## 8.8 Gestion de la documentation

- **Source de vérité** — ce dossier `docs/` (arc42, ce site) + les ADR dans `docs/architecture/adr/` (sources migrées ici §9).
- **Règle de dépendance** — un changement de décision = mise à jour du doc concerné + ADR si structurant. Un ADR obsolète passe à `Statut: Superseded by ADR-XXX`, jamais supprimé.
- **README racine court** — pointe vers `docs.alpimonitor.fr` (cette doc) et `storybook.alpimonitor.fr` pour les détails.
