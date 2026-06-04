# Audit & cartographie AlpiMonitor — dossier INTELLITEK

> **Nature** : audit en lecture seule de la codebase réelle, écrit au fil pour résister aux coupures.
> **Règle** : aucune modification du code existant. Seul ce fichier de rapport est créé.
> **Date** : 2026-06-04 · **Branche** : `main` · **Tags de référence** : `v1.0.0-crealp`, `v1.1.0-refactor`
> **Méthode** : 5 explorations parallèles (stack, backend, frontend, data/tests/CI/deploy, docs) + vérifications ciblées.

---

## PRIORITÉ 1 — Réconciliation du nombre de tests

**Trois chiffres en conflit dans les sources :**

| Source | Chiffre annoncé | Nature |
|---|---|---|
| Documentation (README, PRD, STATUS, docs arc42) | **173** | cas de test |
| `CLAUDE.md` (État courant) | **139** (71 API + 68 web) | cas de test |
| Comptage initial d'un agent | **29** | **fichiers** (pas des cas) |

**Méthode de réconciliation** — comptage des blocs `it`/`test` réels, pas des fichiers :

```text
Fichiers de test : 8 API + 21 web = 29 fichiers
Cas (it/test)    : 71 API + 102 web = 173 cas
it.each / describe.each : 0   (le comptage statique n'est donc pas gonflé)
.skip / .todo / .only   : 0   (aucun cas neutralisé)
describe blocks         : 17 API + 25 web (regroupement, non comptés comme cas)
```

### Verdict

- **Le chiffre vrai est `173` cas de test (71 API + 102 web).**
- La **documentation (173) est correcte**.
- **`CLAUDE.md` (139) est PÉRIMÉ et doit être corrigé.** Le `139` est figé au snapshot du **2026-04-22 après-midi (Session Option A)**, *avant* le tag `v1.1.0-refactor` (2026-04-23) qui a ajouté Storybook + le refactor architecture (ADR-010) et fait passer les tests web de 68 → 102. La doc arc42, postérieure, reflète l'état final.
- Le `29` n'était pas faux, mais comptait des **fichiers**, pas des **cas** : 29 fichiers contiennent bien 173 cas.

> ⚠️ Action recommandée (hors audit, à valider) : mettre `CLAUDE.md` à jour de `139` → `173` (71 API + 102 web) pour cohérence avec la doc et le code.

*Note : exécution réelle de `pnpm test` non effectuée — `node_modules` absent et `pnpm install` écarté pour rester strictement en lecture seule. Le comptage statique est fiabilisé par l'absence de `.each`/`.skip`/`.todo`.*

---

## POINT 1 — Cartographie technique

### 1.1 Stack effective (versions réelles, relevées dans les `package.json`)

| Couche | Techno | Version | Note |
|---|---|---|---|
| Runtime | Node.js | `>=20.10.0` | `engines`, pas de `.nvmrc` |
| Package manager | pnpm | `10.33.0` | champ `packageManager`, lockfile v9.0 |
| Langage | TypeScript | `5.7.2` | `strict` + `noUncheckedIndexedAccess`, `verbatimModuleSyntax` |
| **Frontend** | Vue | `3.5.13` | Composition API, `<script setup>` |
| | Vite | `6.0.1` | |
| | Pinia | `3.0.4` | stores en setup syntax |
| | Vue Router | `4.6.4` | mono-route `/` |
| | vue-i18n | `11.3.2` | FR uniquement, mode Composition (`legacy:false`) |
| | Tailwind CSS | `3.4.15` | + `@apply` dans `<style scoped>`, palette custom |
| | D3 (modulaire) | `d3-scale 4.0.2`, `d3-shape 3.2.0`, `d3-time-format 4.1.0` | pas de bundle D3 complet |
| | Leaflet | `1.9.4` | tuiles OSM (cf. ADR-005 drift) |
| | @vueuse/core | `14.2.1` | `useNow`, helpers réactifs |
| | Storybook | `10.3.5` | `@storybook/vue3-vite` + addons docs/a11y |
| **Backend** | Fastify | `5.1.0` | + `@fastify/cors 11.2.0`, `fastify-plugin 5.1.0` |
| | Prisma | `6.19.2` | client + CLI |
| | node-cron | `4.2.1` | ordonnanceur ingestion |
| | Zod | `4.3.6` | validation entrée API |
| | tsx | `4.19.2` | exécution TS (dev + seed) |
| **DB** | PostgreSQL | `16-alpine` | via Docker |
| **Qualité** | ESLint | `9.15.0` (flat config) + `typescript-eslint 8.15.0` | |
| | Prettier | `3.3.3` | printWidth 100, singleQuote |
| | Vitest | `2.1.5` | + `@vue/test-utils 2.4.6`, jsdom 25 |
| | simple-git-hooks + lint-staged | `2.11.1` / `15.2.10` | pre-commit |
| **Docs** | MkDocs Material + Structurizr (C4) | déclaratif `mkdocs.yml` | markdownlint-cli2 |

**Écarts notables vs ce que la doc/CLAUDE laisse entendre :**

- **`pino` n'est PAS une dépendance explicite** : le logging passe par le logger natif de Fastify (`logger: { level }`). La doc parle de « pino JSON stdout » — c'est vrai *de facto* (Fastify embarque pino) mais il n'y a pas d'intégration pino custom.
- **`undici` n'est PAS déclaré** : les fetch LINDAS utilisent le `fetch` global de Node 20+ (undici transitif). La doc « via undici » est imprécise.

### 1.2 Arborescence réelle (commentée, 2 niveaux)

```text
alpimonitor/
├── apps/
│   ├── api/                  # Fastify 5 — API REST + cron ingestion (monolithe, ADR-003)
│   │   ├── src/
│   │   │   ├── routes/       # health.ts, status.ts, stations.ts (handlers + Zod inline)
│   │   │   ├── services/     # stations-service.ts (1 fichier, 2 use cases)
│   │   │   ├── domain/       # ⚠️ VIDE (.gitkeep seulement)
│   │   │   ├── plugins/      # prisma.ts, uptime.ts, ingestion.ts (cron)
│   │   │   ├── ingestion/    # lindas-client.ts, lindas-parser.ts, lindas-ingestion.ts, archive.ts
│   │   │   ├── schemas/      # stations.ts (schémas Zod)
│   │   │   ├── utils/        # station-status.ts (logique métier pure)
│   │   │   ├── server.ts     # buildServer() — assemblage plugins + routes
│   │   │   └── index.ts      # bootstrap + graceful shutdown
│   │   ├── prisma/           # schema.prisma + 4 migrations + seed.ts idempotent
│   │   ├── tests/            # 8 fichiers (71 cas)
│   │   ├── Dockerfile        # prod multi-stage (USER non-root, tini)
│   │   ├── Dockerfile.dev
│   │   └── entrypoint.sh     # migrate deploy → seed (opt) → node dist
│   ├── web/                  # Vue 3 SPA scrollable
│   │   ├── src/
│   │   │   ├── components/   # atoms(5) / molecules(5) / organisms(11) / templates(1) — ABEM
│   │   │   ├── composables/  # stations/ (5 façades) + shared/ (4 primitives)
│   │   │   ├── stores/       # status.ts, stations.ts (Pinia setup)
│   │   │   ├── lib/          # api-client, charts/chart-model, map/, constants/, status.ts (pur)
│   │   │   ├── pages/        # PHomePage.vue
│   │   │   ├── locales/      # fr.json
│   │   │   └── stories/      # Storybook (15 composants storyisés)
│   │   ├── Dockerfile        # prod multi-stage → nginx
│   │   ├── nginx.conf + nginx-security-headers.conf
│   │   └── .storybook/
│   └── docs/                 # image nginx servant la doc MkDocs en prod
├── packages/
│   └── shared/               # types TS partagés front/back (ZÉRO dépendance externe)
├── docs/                     # arc42 (10 sections) + 11 ADR + post-mortems + assets C4
├── .github/workflows/ci.yml  # lint→typecheck→test→build
├── docker-compose.yml        # dev (postgres+api+web)
├── docker-compose.prod.yml   # prod (Coolify)
└── mkdocs.yml
```

### 1.3 Architecture réelle (vérification DDD/hexagonal annoncé vs code)

> Détaillé au POINT 2. En une phrase : **architecture monolithe orientée routes**, pas hexagonale/DDD. Le dossier `domain/` existe mais est **vide**. Pas de repository pattern, pas de ports/adapters — Prisma est appelé directement dans le service.

### 1.4 Modèle de données (Prisma / PostgreSQL)

- **11 modèles** : `Catchment`, `Station`, `Sensor`, `Measurement`, `Threshold`, `Alert`, `Glacier`, `StationGlacier` (N-N), `Withdrawal`, `User`, `ThresholdAudit`, + `IngestionRun`.
- **10 enums** dont les structurants : `DataSource` (LIVE/RESEARCH/SEED), `SourcingStatus` (CONFIRMED/ILLUSTRATIVE — ADR-008), `Parameter`, `IngestionStatus` (SUCCESS/PARTIAL/FAILURE).
- **Idempotence garantie au schéma** : `Sensor @@unique([stationId, parameter])`, `Measurement @@unique([sensorId, recordedAt])` → upsert rejouable sans doublon.
- **Index de perf** : `Measurement @@index([sensorId, recordedAt DESC])` (derniers points), `IngestionRun @@index([source, startedAt DESC])`.
- **4 migrations** versionnées (init → dataSource+IngestionRun → withdrawal unique → sourcingStatus).
- **Seed idempotent** (upsert) : 1 bassin (Borgne, 383 km²), 7 stations (4 LIVE BAFU CONFIRMED + 3 RESEARCH dont 1 CONFIRMED Bramois + 2 ILLUSTRATIVE), 2 capteurs/station, seuils DISCHARGE, 2 glaciers, 2 captages.
- ⚠️ **Modèles présents mais non exploités par l'UI candidature** : `Alert`, `Threshold` (partiel), `User`, `ThresholdAudit` — vestiges du PRD initial, hors-scope assumé.

### 1.5 Source de données & pipeline d'ingestion (LINDAS SPARQL — ADR-007)

- **Source** : endpoint SPARQL `https://lindas.admin.ch/query`, graph `<https://lindas.admin.ch/foen/hydro>`. Pivot depuis le flux XML OFEV mort (ADR-007).
- **Pipeline découplé** (vrai point fort) : `lindas-client.ts` (fetch + requête SPARQL) → `lindas-parser.ts` (parsing pur, testable : `parseWkt`, `buildStation`, `classifyNarrativeRole`) → `lindas-ingestion.ts` (upsert idempotent + persistance `IngestionRun`) → `archive.ts` (gzip horodaté + prune 30 j).
- **Cron** : `node-cron`, `*/10 * * * *` (10 min) + boot fire-and-forget + prune quotidien 03:17 UTC. Plugin Fastify avec `dependencies:['prisma']` et cleanup `onClose`.
- **Réconciliation** : seules les stations `dataSource=LIVE` reçoivent des mesures ; les RESEARCH restent contextuelles.

### 1.6 Déploiement (Docker / Coolify)

- **Multi-stage** sur les 2 apps. API : build → `pnpm deploy --prod` → runtime `node:20-alpine` + `tini` (PID 1) + **USER non-root** + `mkdir+chown /app/var` (leçon incident EACCES). Web : build Vite → `nginx:1.27-alpine`.
- **`entrypoint.sh`** : `prisma migrate deploy` (hard-fail) → seed conditionnel `SEED_ON_BOOT` (soft-fail) → `exec node dist/index.js`.
- **nginx durci** : 6 en-têtes sécurité (HSTS, CSP détaillée, X-Frame-Options, nosniff, COOP, Referrer-Policy), gzip, cache immutable sur assets hashés, no-store sur `index.html`.
- **Coolify** : auto-deploy sur push `main`, Traefik + Let's Encrypt, réseau Compose par défaut (leçon incident Traefik multi-homing).

### 1.7 Tests & CI

- **173 cas** (71 API + 102 web) — Vitest. API : prisma mocké (pas de DB en test). Web : `@vue/test-utils` + jsdom + Pinia + i18n réel. Pyramide unit → composable → composant.
- **CI** (`.github/workflows/ci.yml`) : 1 job, Node 20, `pnpm install --frozen-lockfile` → `prisma generate` → `format:check` → `lint` → `typecheck` → `test` → `build`. Trigger push `main` + PR, timeout 10 min, concurrency cancel.

---

## POINT 2 — Gap doc ↔ code

Classement par sévérité du point de vue « défense en entretien ».

### 🔴 Écart majeur — « Hexagonal API » revendiqué, absent du code

- **Claim** : `README.md` ligne 38 — *« Architecture claire : monorepo pnpm, Atomic Design ABEM, hexagonal API, Docker multi-stage »*.
- **Réalité code** :
  - `apps/api/src/domain/` ne contient qu'un `.gitkeep` → **aucune entité métier, aucun value object**.
  - **Pas de repository pattern** : `stations-service.ts` appelle `prisma.station.findMany(...)` directement (mélange logique métier + accès DB + mapping DTO dans la même fonction, ex. `getStationMeasurements` lignes ~137-239).
  - **Pas de ports/adapters** : Prisma injecté tel quel, zéro interface d'abstraction.
- **Nuance honnête** : la doc arc42 §5 (backend.md) est, elle, **honnête** — elle écrit que « les couches `domain/` + `services/` sont fines aujourd'hui ». Le mot « hexagonal » n'apparaît **nulle part** ailleurs que dans le README (0 occurrence dans les 11 ADR, 0 « DDD », 0 « ports/adapters »).
- **Risque entretien** : un relecteur technique INTELLITEK qui lit « hexagonal » dans le README puis ouvre `domain/` vide → crédibilité entamée.
- **Recommandation** (à valider) : soit retirer « hexagonal » du README (honnêteté = « monolithe en couches fines, pragmatique YAGNI »), soit en faire un objectif explicite de la couche IA à venir. **Le pitch « pragmatique/YAGNI » est plus défendable que le buzzword.**

### 🟠 Écart mineur tracé — tuiles carte (ADR-005)

- **Claim** : ADR-005 décide tuiles **swisstopo WMTS**.
- **Réalité** : code utilise **OpenStreetMap** (`OStationMap.vue`). Drift **assumé et documenté** dans l'ADR (raison : zéro quota/coût, API Leaflet identique, swap = 1 ligne). Défendable tel quel.

### 🟡 Imprécisions de vocabulaire (doc vs implémentation)

| Doc dit | Code fait | Impact |
|---|---|---|
| « pino JSON stdout » | logger natif Fastify (embarque pino, mais pas d'intégration custom) | cosmétique, factuellement OK |
| « via undici fetch » | `fetch` global Node 20 (undici transitif, non déclaré) | cosmétique |
| CLAUDE.md « 139 tests » | **173** (cf. Priorité 1) | à corriger |
| CLAUDE.md « 68 web » | **102 web** | à corriger (post v1.1.0) |

### 🟢 Claims vérifiés conformes (solides à défendre)

- **ABEM 100 %** (ADR-002) : tous les composants portent un préfixe `a-/m-/o-/t-`, avec éléments `__` et modificateurs `--`. Vérifié sur l'ensemble des composants.
- **Façades Pinia** (ADR-010) : 3 façades (`useStationsList`, `useStationSelection`, `useStationMeasurements`) ; aucun consumer prod n'importe le store directement (règle grep-vérifiable).
- **`lib/` pur** (ADR-010) : `chart-model.ts`, `station-map-mapping.ts` sans dépendance Vue/Pinia, testés isolément.
- **Monolithe Fastify** (ADR-003), **LINDAS SPARQL** (ADR-007), **zéro SQL brut sauf agrégats `$queryRaw` paramétrés**, **Zod en entrée de chaque route**, **sourcingStatus CONFIRMED/ILLUSTRATIVE** (ADR-008) en DB + DTO + badge UI : tout conforme.
- **`ApiError` union discriminée** (`network|http|parse`) : conforme, force l'exhaustivité au compilateur.

### Note process intéressante (déjà capturée par la doc)

ADR-010 documente que le gate `pnpm typecheck` était **silencieusement no-op** (manquait `-p tsconfig.app.json`) → 40 erreurs cachées ~2 j, corrigées en R8. Bon signal de maturité : l'équipe documente ses propres pièges de CI.

---

## POINT 3 — Points forts & dette

### ✅ Points forts solides et défendables

1. **Pipeline d'ingestion exemplaire** — séparation fetch/parse/persist/archive, parsing pur testable, **idempotence garantie au niveau schéma** (upsert sur clés uniques) + traçabilité (`IngestionRun` à chaque tick avec hash SHA-256, durée, compteurs). C'est la pièce la plus mature du repo.
2. **TypeScript end-to-end strict** — `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`, types partagés via `packages/shared` (zéro drift front/back), Zod pour le runtime + `z.infer` pour le compile-time.
3. **Frontend discipliné** — ABEM 100 %, Atomic Design réel, dataviz D3 avec **modèle pur découplé du rendu** (`chart-model.ts`), façades Pinia (règle « aucun accès direct au store » enforced), composables réutilisables (`usePolling`, `useEscapeClose`, `useScrollLock`).
4. **Accessibilité prise au sérieux** — `ASourcingBadge` : `role=tooltip` + `aria-describedby` + `tabindex` + tooltip visible au focus clavier ; status badge avec `aria-live`. Storybook addon-a11y.
5. **Prod durcie** — multi-stage, USER non-root + tini, 6 en-têtes sécurité nginx dont CSP détaillée, cache immutable, seed-on-boot défensif. **3 post-mortems d'incidents réels** documentés (DB vidée, Traefik 504, EACCES archive) — preuve d'exploitation réelle, pas un POC jetable.
6. **Observabilité native** — `/health` (liveness DB), `/status` (uptime + dernier run ingestion + taux de succès du jour), consommé par un badge UI live/stale/offline.
7. **Documentation arc42 + 11 ADR + C4 Structurizr** — densité et traçabilité rares pour un projet de 13 jours. Drifts assumés (tuiles, pivot LINDAS).
8. **Qualité automatisée** — 173 tests, CI complète, pre-commit hooks, markdownlint.

### ⚠️ Dette et fragilités

| Sujet | Détail | Sévérité | Défendable en l'état ? |
|---|---|---|---|
| **`domain/` vide + « hexagonal »** | README annonce une archi non implémentée | 🔴 | Non — corriger le wording (cf. Point 2) |
| **Service monolithique** | `stations-service.ts` mêle métier + Prisma + DTO ; intestable sans DB réelle pour cette couche | 🟠 | Oui (YAGNI), mais c'est LE point de bascule pour la couche IA |
| **Modèles morts** | `Alert`, `User`, `ThresholdAudit`, `Threshold` (partiel) en DB mais sans UI | 🟡 | Oui (hors-scope assumé PRD), mais à signaler au relecteur |
| **CLAUDE.md périmé** | tests 139→173, web 68→102 | 🟡 | À corriger |
| **i18n mono-langue** | structure vue-i18n en place mais FR seul | 🟢 | Oui (assumé), extensible sans refonte |
| **Pas d'E2E / Lighthouse CI** | Playwright et Lighthouse formels hors scope | 🟢 | Oui (assumé candidature) |
| **Pas de rate-limit / helmet API** | défauts Fastify, pas de hardening applicatif API | 🟢 | Oui (read-only public), à wirer si trafic réel |
| **Imprécisions vocabulaire** | pino/undici (cf. Point 2) | 🟢 | Oui |

### Lecture stratégique

La dette est **soit assumée et tracée** (hors-scope, drifts ADR), **soit cosmétique** (vocabulaire, CLAUDE.md). Le **seul vrai accroc** est le mot « hexagonal » du README face au `domain/` vide. C'est aussi, paradoxalement, **l'opportunité** : la couche IA est l'occasion d'introduire une vraie frontière (port/adapter) là où le service actuel est plat.

---

## POINT 4 — Mapping INTELLITEK (matrice de preuves d'entretien)

Pour chaque axe attendu : la preuve concrète dans le repo (fichier/mécanisme) + le pitch d'une phrase.

| Axe INTELLITEK | Preuve dans le code | Force | Pitch entretien (1 phrase) |
|---|---|---|---|
| **Full-stack TypeScript** | Monorepo pnpm, `strict` partout, types partagés `packages/shared` (front+back+Zod), `z.infer` | ⭐⭐⭐⭐⭐ | « Un seul langage du SPARQL parser au composant Vue, types partagés garantissant l'absence de drift de contrat. » |
| **Base relationnelle + modélisation** | `schema.prisma` 11 modèles, 10 enums, relations N-N (`StationGlacier`), contraintes uniques métier, index ciblés, 4 migrations versionnées | ⭐⭐⭐⭐⭐ | « Modèle normalisé avec idempotence garantie au schéma : `@@unique([sensorId, recordedAt])` rend l'ingestion rejouable sans doublon. » |
| **Dataviz / data → indicateurs** | `OHydroChart.vue` (D3 modulaire) + `chart-model.ts` (modèle pur), `computeMeasurementStatus` (seuils → statut), `/status` (runs → taux de succès), KeyMetrics | ⭐⭐⭐⭐⭐ | « La logique de viz est extraite en fonctions pures testables, le rendu D3 reste fin et le SVG reste réactif via les computed Vue. » |
| **Pipeline d'ingestion** | `ingestion/` (client SPARQL / parser pur / upsert idempotent / archive gzip), cron 10 min, `IngestionRun`, prune 30 j | ⭐⭐⭐⭐⭐ | « Pipeline résilient : fetch SPARQL → parse pur → upsert idempotent → archive horodatée, chaque tick traçé avec hash et durée. » |
| **Mise en prod / Docker / cloud** | Dockerfiles multi-stage, USER non-root + tini, `entrypoint.sh` (migrate→seed→start), Coolify auto-deploy, Traefik+LE, nginx durci | ⭐⭐⭐⭐⭐ | « Prod réelle live sur VPS via Coolify, durcie (non-root, CSP, HSTS) et défendue par 3 post-mortems d'incidents vécus. » |
| **Observabilité** | `/health` + `/status`, `IngestionRun` persisté, logger structuré Fastify, badge UI live/stale/offline | ⭐⭐⭐⭐ | « L'état du pipeline est exposé en API et rendu visible à l'utilisateur par un badge piloté par le dernier run réussi. » |
| **Choix techniques argumentés** | 11 ADR (pivot LINDAS, monolithe YAGNI, drift tuiles tracé, ABEM, sourcing factuel), arc42, C4 | ⭐⭐⭐⭐⭐ | « Chaque décision structurante a son ADR, y compris les pivots subis (XML mort → SPARQL) et les drifts assumés. » |
| **Architecture logicielle (séparation couches)** | Façades Pinia + `lib/` pur côté front (solide) ; côté back service plat, `domain/` vide (faible) | ⭐⭐⭐ | « Front strictement en couches avec façades enforced ; back volontairement plat (YAGNI) — la frontière hexagonale viendra avec la couche IA. » |
| **Accessibilité / qualité front** | ABEM 100 %, addon-a11y Storybook, ARIA/role/tabindex, Lighthouse Desktop 96/100/100/100 | ⭐⭐⭐⭐ | « Design system documenté en Storybook avec audit a11y intégré et tooltips clavier-accessibles. » |
| **Tests / CI** | 173 cas Vitest (pyramide unit→composable→composant), CI lint+typecheck+test+build | ⭐⭐⭐⭐ | « 173 tests, pipeline CI bloquante, et un post-mortem documenté sur un gate typecheck qui était silencieusement no-op. » |

**Axes les plus vendeurs pour INTELLITEK** : ingestion, modélisation relationnelle, mise en prod/Docker, choix argumentés (les 4 à ⭐⭐⭐⭐⭐ les plus distinctifs).
**Axe à manier avec précaution** : « architecture logicielle » côté back — assumer le pragmatisme plutôt que survendre « hexagonal ».

---

## POINT 5 — Points d'extension IA (ancrages, pas implémentation)

> Principe directeur : la couche IA s'ajoute **sans toucher au flux existant** (LINDAS → Prisma → API → SPA reste intact). Tout vit dans une **nouvelle frontière** — l'occasion de matérialiser enfin la séparation que le README revendiquait. Branche dédiée `feat/ai-layer`, jamais sur `main`, pour protéger les tags.

### Principe d'ancrage transversal

Créer un **module isolé** (ex. `apps/api/src/ai/`) + un **enum `IngestionSourceKind` étendu** ou un nouveau modèle `Insight` — les sorties IA sont **persistées et traçées comme l'ingestion** (mêmes patterns : provenance, horodatage, idempotence). Côté front, un nouvel **organisme** + une **façade** dédiée, sans toucher aux composants existants. La clé API LLM passe par variable d'environnement (jamais committée), appel **côté serveur uniquement** (CSP `connect-src` actuelle interdit déjà les appels LLM directs depuis le navigateur — c'est voulu).

### Les 4 extensions, par effort croissant

#### A. 🟢 Narration LLM des séries (le meilleur premier pas)

- **Quoi** : un résumé en langage naturel d'une série (« Le débit de la Borgne à Bramois a augmenté de 18 % sur 24 h, sous le seuil de vigilance »).
- **Ancrage back** : nouveau service `ai/narration-service.ts` qui consomme la **même sortie que `getStationMeasurements`** (réutilise le DTO existant → zéro impact ingestion). Nouvel endpoint `GET /api/v1/stations/:id/narrative` (ou champ optionnel). Cache en DB (modèle `Insight` : stationId, window, text, model, generatedAt, payloadHash) pour ne pas rappeler le LLM à chaque vue → reprend le **pattern idempotent + traçabilité de `IngestionRun`**.
- **Ancrage front** : nouvelle façade `useStationNarrative`, rendu dans `OStationDrawer` (slot sous le chart). Le modèle pur `chart-model.ts` peut pré-calculer les features (delta, min/max, franchissement de seuil) passées au prompt → **prompt déterministe et testable**.
- **Pourquoi en premier** : valeur démontrable immédiate, surface minimale, réutilise tout l'existant, montre data→indicateur→narration.

#### B. 🟡 Détection d'anomalie (pont vers les modèles « morts »)

- **Quoi** : repérer les ruptures statistiques (moyenne mobile ± 2σ) ou via LLM, **réactiver le modèle `Alert`** déjà présent en DB (actuellement inexploité).
- **Ancrage back** : hook **dans le tick d'ingestion existant** (`lindas-ingestion.ts`, après upsert) OU job séparé — calcule l'anomalie, écrit dans `Alert` (le modèle existe déjà, types et enums `AlertType.STATISTICAL_ANOMALY` aussi !). Endpoint `GET /api/v1/alerts`.
- **Ancrage front** : organisme `OAlertsPanel`, badge sur les markers carte.
- **Atout narratif** : « j'ai conçu le modèle `Alert` dès le départ ; la couche IA l'active sans migration destructrice » — montre que le schéma initial anticipait l'extension.
- **Note** : commencer par la version statistique pure (testable, déterministe), LLM en enrichissement optionnel.

#### C. 🟠 Chat / RAG sur les données

- **Quoi** : « Quelle station a le débit le plus élevé cette semaine ? » en langage naturel.
- **Ancrage back** : module `ai/rag/` — le « retrieval » interroge **Prisma** (pas un vector store au début : les données sont structurées et peu volumineuses → text-to-SQL contrôlé ou function-calling sur des requêtes Prisma pré-définies est plus sûr et défendable que RAG vectoriel). Endpoint `POST /api/v1/ask`. **C'est ICI que la frontière port/adapter prend tout son sens** : définir un `QueryPort` (interface) avec un `PrismaQueryAdapter` → matérialise enfin l'« hexagonal » du README, proprement.
- **Ancrage front** : organisme `OChatPanel` + façade `useDataChat`.
- **Garde-fou** : function-calling sur requêtes whitelistées >> SQL libre généré (sécurité + déterminisme + testabilité).

#### D. 🔵 Observabilité LLM (LiteLLM / proxy)

- **Quoi** : tracer coût/latence/tokens des appels LLM, fallback multi-modèles, rate-limit.
- **Ancrage** : insérer **LiteLLM en proxy** entre le service IA et les providers (`ai/llm-client.ts` pointe vers le proxy, pas directement OpenAI/Anthropic). Étend le pattern `/status` existant : un `GET /api/v1/ai/status` exposant coût du jour / taux d'erreur LLM, rendu par un **badge réutilisant `MStatusBadge`**.
- **Atout** : prolonge naturellement la culture observabilité déjà en place (`IngestionRun` → `LlmCallRun`). Cohérence narrative forte avec l'existant.

### Ordre validé & garde-fous communs

**Ordre retenu (validé 2026-06-04)** : **A (narration) → D (observabilité LiteLLM) → B (anomalie) → C (chat/RAG)**.

- **A → D** : on introduit l'observabilité LiteLLM *dès le premier appel LLM* (A), pas après — coût/latence tracés depuis le jour 1.
- **Point d'arrêt défendable** : **A + D + B** finis. C (chat/RAG) = **vitrine stretch** si le temps le permet ; c'est aussi C qui matérialise la frontière port/adapter (l'« hexagonal » devenu objectif réel, cf. ADR-012).

**Garde-fous transverses :**

- Appels LLM **server-side only** (la CSP actuelle le force déjà — atout, pas obstacle).
- Sorties IA **persistées + traçées** (provenance, modèle, hash) sur le modèle de `IngestionRun` → cohérence d'architecture.
- **Features pré-calculées en fonctions pures** (extension de `chart-model.ts`) → prompts déterministes et testables.
- Nouvel **ADR-012 « Introduction de la couche IA »** : provider, proxy LiteLLM, où vit la frontière, ce qui reste hors-scope. C'est le livrable doc qui prouve la continuité méthodologique.
- Tout sur `feat/ai-layer`, tags `v1.x` protégés.

---

## Fin de l'audit — STOP pour validation

Les 5 points sont écrits dans ce fichier (`docs/audit/intellitek-audit.md`). Aucun code existant modifié.
**À valider avant toute suite** : priorisation des extensions IA (A→B→D→C proposé), et décision sur le wording « hexagonal » du README.
