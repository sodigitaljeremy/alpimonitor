# Audit AlpiMonitor — J16 (2026-04-24)

Audit architectural en vue d'un refactor niveau **Architect Engineer** avant
l'échéance candidature CREALP (2026-04-30). Focus frontend. Aucun code modifié
par cet audit — seul ce fichier est posé.

Scope : `apps/web/src/`. Backend et `packages/shared/` lus pour comprendre les
contrats, mais hors focus refactor immédiat.

## 1. Hypothèses de Jérémy — vérification

> Les 10 zones de dette perçues par l'auteur, validées ou infirmées par
> lecture du code.

| # | Hypothèse | Verdict | Évidence |
|---|---|---|---|
| 1 | `organisms/` fourre-tout (Vue + `.ts` libres + tests mélangés) | ✅ confirmé | `chart-model.ts`, `chart-model.test.ts`, `station-map-mapping.ts`, `station-map-mapping.test.ts` cohabitent avec 9 fichiers `.vue`. Pas de regroupement par feature, pas de sous-dossier par "page/contexte" comme SkillSwap le fait. |
| 2 | `services/` vide | ✅ confirmé | Contient uniquement `.gitkeep`. Créé en prévision, jamais peuplé. Dette structurelle visible à `ls`. |
| 3 | Pas de `types/` ni `domain/` côté web | ✅ confirmé | Les types sont soit dans `packages/shared/src/types/` (DTO API), soit inlines dans les composants (`type BadgeStatus = 'live' \| ...` répété 3 fois dans le codebase). Pas de couche domaine front. |
| 4 | Research stations dans `fr.json` | ✅ confirmé | `OResearchZonesSection` consomme `useI18nList<ResearchStation>('researchZones.stations')` avec données statiques FR, non synchronisées avec la DB. Déjà tracé ADR-008 (dette post-candidature assumée). |
| 5 | `OStationDrawer.vue` god component | ✅ confirmé — **critique** | 271 lignes. Mélange 7 responsabilités : store subscription, orchestration fetch, UI state (now/windowFrom), scroll lock sur `document.body`, shortcut Escape, dérivations présentationnelles (3 computed), génération d'URL externe avec logique métier (`ofevCode.startsWith('TBD')`). Voir §3 Critique #1. |
| 6 | Stores `stations` + `status` multi-responsabilités | ✅ confirmé | `useStationsStore` concentre 3 contextes : liste, sélection, cache de mesures par station. `useStatusStore` plus simple (1 contexte ingestion) mais duplique le code fetch avec stations.ts. |
| 7 | `OHydroChart` charge trop | ⚠️ partiellement | 283 lignes template inclus, mais la logique pure (scales, domain, tooltip lookup) est déjà extraite dans `chart-model.ts`. Reste dans le `.vue` : ResizeObserver local + pointer events + hover state. Refactor utile mais pas urgent. |
| 8 | `lindas-parser` intouchable | N/A backend | Hors scope audit frontend. Note : si backend refactor futur, lire en détail. |
| 9 | `OHydroChart` / `OStationMap` / router navigation sous-testés | ✅ confirmé | Aucun test pour `OHydroChart.vue` ni `OStationMap.vue` (seul `chart-model.test.ts` et `station-map-mapping.test.ts` couvrent les pures). Router a 1 route (home). |
| 10 | Onboarding pénible (data flow, sourcingStatus, placement `chart-model.ts`) | ✅ confirmé | Un nouveau contributeur doit traverser `stores/` → `composables/useApi.ts` → `organisms/` pour comprendre le flux. `chart-model.ts` dans `organisms/` (pas `utils/`, pas `lib/`) est contre-intuitif. Diagramme data flow absent. |

**Meta-finding J15 Phase 5 à corriger** : `Introduction.mdx` (design system
Storybook) affirme "Templates non utilisés à date". FAUX : `TDefaultLayout.vue`
existe et est utilisé par `PHomePage.vue` (main + OSiteFooter). Erreur
factuelle de doc à corriger dans le cadre du refactor.

## 2. Patterns SkillSwap à importer

Le frontend SkillSwap (Next.js 15 + React) offre quatre patterns validés
transposables à AlpiMonitor (Vue 3 + Vite). Chaque pattern cité avec son
chemin source dans `~/Desktop/Documentation SkillSwap/projet-skillswap/`.

### 2.1 `lib/api-client.ts` — abstraction HTTP centralisée

**Source** : `frontend/src/lib/api-client.ts`

SkillSwap expose un objet `api` typé avec méthodes nommées (`api.login()`,
`api.getProfile()`, `api.searchMembers()`). Réponses enveloppées dans
`ApiResponse<T> = { success, data?, error? }`. Gère auto token refresh,
AbortController, cookies httpOnly.

**À importer dans AlpiMonitor** : créer `apps/web/src/lib/api-client.ts`
exportant `api.getStations()`, `api.getMeasurements(id, from, to)`,
`api.getStatus()`, `api.getHealth()`. Remplace les trois `fetch(...)`
dupliqués actuels (`stores/stations.ts`, `stores/status.ts`, plus le
`useApi` composable qui fait la même chose avec moins de typage).

### 2.2 `hooks/{feature}/` — composables groupés par feature

**Source** : `frontend/src/hooks/messaging/` (7 hooks) + `hooks/profile/` (6 hooks)

SkillSwap regroupe les hooks par domaine fonctionnel. `useConversationList`,
`useConversationMessages`, `useSelectedConversation`, `useConversationActions`
vivent ensemble dans `hooks/messaging/`, avec `index.ts` barrel.

**À importer dans AlpiMonitor** : restructurer `apps/web/src/composables/`
en `composables/stations/` + `composables/status/` (et `composables/shared/`
pour `useApi`, `useI18nList`). Permet de split `useStationsStore` actuel en
composables dédiés à lire côté composants.

### 2.3 `organisms/{Page}/` — organisms feature-grouped

**Source** : `frontend/src/components/organisms/ConversationPage/` contient
`ConversationSection.tsx`, `MessageThread/`, `NewConversationDialog.tsx`,
`RatingDialog.tsx`, `useConversationState.ts`, `index.ts`.

**À importer dans AlpiMonitor** (plus nuancé — l'app est mono-page) :
regrouper les organisms qui participent d'une même feature dans un
sous-dossier. Candidat évident : `organisms/stations/` contenant `OStationMap.vue`,
`OStationDrawer.vue`, `station-map-mapping.ts`, et un futur
`useStationDrawer.ts` (extrait du god component). Le reste des organisms
(`OHero`, `OWhy`, `OResearch`, `OMetrics`) restent plats car indépendants
les uns des autres.

### 2.4 `lib/validation/` — validation co-localisée avec les types

**Source** : `frontend/src/lib/validation/` avec `auth.validation.ts`,
`conversation.validation.ts`, etc.

**À importer dans AlpiMonitor** : moins urgent car le projet utilise Zod
dans `packages/shared/src/schemas/`. Mais une validation côté web des
inputs utilisateur (quand il y en aura) aurait sa place dans
`apps/web/src/lib/validation/`. À noter pour évolutions futures, pas action
immédiate.

### Patterns SkillSwap **non transposables**

- **`providers/AuthProvider.tsx`** — React Context. Équivalent Vue = Pinia +
  `provide/inject`, déjà couverts par les stores. Pas de dette ici.
- **`hooks` en React** → **composables en Vue** : le nom change, le pattern
  est identique. Pas d'import à faire, juste à respecter le renaming.

## 3. Findings Claude Code local

### Critique — bloquants pour scalabilité / tests

#### C1. `OStationDrawer.vue` god component — 7 responsabilités dans 102 lignes de setup

Fichier : `apps/web/src/components/organisms/OStationDrawer.vue`.

Le `<script setup>` (lignes 1-102) assume :

1. **Store subscription** (L14-21) — `storeToRefs` sur 5 champs de `useStationsStore`.
2. **UI state** (L23-26) — `isOpen`, `now`, `windowFrom` via refs/computed.
3. **Orchestration fetch** (L31-35) — `watch(selectedStationId)` déclenche `fetchMeasurements`.
4. **Dérivations présentationnelles** (L37-55) — 3 computed sur le store.
5. **Callbacks UI** (L57-65) — `close()`, `retry()`.
6. **Side effect clavier** (L69-71) — `useEventListener(window, 'keydown')` + branchement Escape.
7. **Side effect scroll lock** (L77-84) — `watch(isOpen)` mutant `document.body.style.overflow` directement.
8. **Business logic** (L86-92) — génération d'URL hydrodaten avec règle `ofevCode.startsWith('TBD')` (code mort côté research stations).
9. **i18n formatting** (L94-101) — `coordsLabel` avec `toFixed(4)`.

**Impact** : impossible à tester unitairement sans monter le composant
entier et mocker Pinia + document.body. Duplication potentielle des
responsabilités 6 et 7 (Escape, scroll-lock) dans tout futur drawer/modal.

**Proposition** :
- `composables/shared/useEscapeClose.ts` — reçoit un `isOpen: Ref<boolean>` + `onClose: () => void`.
- `composables/shared/useScrollLock.ts` — reçoit un `isOpen: Ref<boolean>`.
- `composables/stations/useStationDrawer.ts` — encapsule la souscription store + derivations (1, 2, 3, 4) sous une API stable `{ isOpen, station, dischargeSeries, windowFrom, windowTo, isLoading, error, close, retry }`.
- `lib/hydrodaten.ts` (ou `composables/stations/useHydrodatenUrl.ts`) — une fonction pure `stationToHydrodatenUrl(station): string | null`.
- Le `.vue` restant ne contient plus que du template + un appel à `useStationDrawer()`.

Gain : chaque primitive est testable en isolation, réutilisable pour un
futur drawer alerte/seuil.

#### C2. Tests absents sur les organismes visuels-critiques

- `OHydroChart.vue` — aucun test. La logique pure est couverte par
  `chart-model.test.ts`, mais le ResizeObserver handling, la coordination
  pointer events / hover state, et la résilience width=0 / point unique
  ne sont pas testés.
- `OStationMap.vue` — aucun test. Le mapping marker options est testé
  (`station-map-mapping.test.ts`), mais le cycle Leaflet (mount,
  invalidateSize, cleanup) et la délégation click → store ne le sont pas.
- Router navigation — 1 seule route, pas de test du `scrollBehavior`.

**Impact** : régression silencieuse possible sur un refactor D3 ou Leaflet.

**Proposition** : ajouter des tests intégration (Vitest + `@vue/test-utils`)
sur `OHydroChart` et `OStationMap` couvrant au moins happy path + cleanup
(unmount).

#### C3. Error typing pauvre — un seul `Error` pour toutes les sources

Fichier : `composables/useApi.ts` + les deux stores.

Aujourd'hui `error: Ref<Error | null>`. Un composant consommateur ne peut
pas distinguer :
- Network failure (`fetch` a rejeté, offline, CORS)
- HTTP 4xx (requête mal formée côté client)
- HTTP 5xx (backend en carafe)
- Parse failure (JSON invalide)

**Impact** : pour une UI "Réessayer" vs "Contacter support" vs "Recharger
la page", l'absence de distinction force à afficher un message générique.
Bloque l'évolution vers des erreurs contextualisées.

**Proposition** : définir une union discriminée typée dans `lib/api-client.ts` :

```ts
type ApiError =
  | { kind: 'network'; cause: Error }
  | { kind: 'http'; status: number; statusText: string; path: string }
  | { kind: 'parse'; cause: Error };
```

### Majeur — architecture, coupling

#### M1. `useStationsStore` — 3 responsabilités mélangées

`apps/web/src/stores/stations.ts`. Un seul store expose :
- Liste de stations (items, loading, error, hasLoadedOnce, fetchStations)
- Sélection UI (selectedStationId, selectedStation, selectStation, clearSelection)
- Cache de mesures par station (measurementsByStation/Loading/Error, fetchMeasurements)

**Proposition** : split en trois composables (pas nécessairement trois
stores) via le pattern SkillSwap `hooks/stations/` :
- `useStationsList()` — GET /stations, exposes stations + loading + error.
- `useStationSelection()` — selection state local (ref ou store), methods.
- `useStationMeasurements(id: Ref<string | null>)` — cache indexé, fetch on id change.

Le `OStationDrawer` consommerait les trois.

#### M2. Duplication fetch/error handling dans stations.ts, status.ts, useApi.ts

Trois fichiers font le même dance :

```ts
try {
  const res = await fetch(...);
  if (!res.ok) throw new Error(`API ${res.status} ...`);
  // parse
} catch (err) {
  error.value = err instanceof Error ? err : new Error(String(err));
} finally {
  loading.value = false;
}
```

**Proposition** : centraliser via `lib/api-client.ts` (pattern SkillSwap
2.1). Les stores et `useApi` délèguent.

#### M3. `chart-model.ts` et `station-map-mapping.ts` mal placés

Dans `apps/web/src/components/organisms/`, on trouve :
- `OHydroChart.vue`
- `chart-model.ts` — fonctions pures D3 (computeYDomain, findNearestPointByPx)
- `chart-model.test.ts`
- `OStationMap.vue`
- `station-map-mapping.ts` — fonctions pures Leaflet options
- `station-map-mapping.test.ts`

Ces `.ts` pures ne sont pas des components. Les mettre dans `organisms/`
pollue la conception Atomic Design.

**Proposition** : déplacer dans `apps/web/src/lib/charts/` et
`apps/web/src/lib/map/` (ou `composables/stations/` si on veut feature-grouping
plus strict).

#### M4. Magic numbers Leaflet / chart disséminés

- `OStationMap.vue` : `MAP_CENTER = [46.22, 7.4]`, `MAP_ZOOM = 10`, `maxZoom: 18`.
- `OHydroChart.vue` : `MARGIN = {...}`, `width.value < 420` hardcoded, `width * 0.45` aspect ratio, `Math.min(280, Math.max(180, ...))`.
- `OStationDrawer.vue` : `24 * 60 * 60 * 1000` (ONE_DAY_MS dupliqué aussi dans `stores/stations.ts`).
- `station-map-mapping.ts` : `PRIMARY = '#0F2847'` et `ALPINE = '#F4C542'` dupliqués depuis `tailwind.config.ts`.

**Proposition** : un fichier `lib/constants.ts` ou `lib/config/` centralisant
les constantes d'affichage partagées. La duplication tokens Tailwind → Leaflet
est inévitable (D3/SVG et Leaflet Canvas n'héritent pas des classes CSS),
mais elle doit vivre en un seul point.

#### M5. `services/` vide, `utils/` fourre-tout mince

- `services/` contient `.gitkeep` seul. Une intention d'architecture non
  suivie. Soit on la concrétise (services = abstractions métier côté
  client), soit on la supprime.
- `utils/relativeTime.ts` est couplé à la feature keyMetrics (clés i18n
  `keyMetrics.relativeTime.*`). Le nom `utils/` suggère cross-cutting ; en
  pratique c'est une util feature-spécifique.

**Proposition** : renommer `services/` → `lib/` (pattern SkillSwap) et y
poser `api-client.ts`, `charts/`, `map/`, `hydrodaten.ts`. Déplacer
`utils/relativeTime.ts` vers `composables/status/formatMinutesAgo.ts` ou
un `lib/format/relativeTime.ts` générique (en changeant les clés i18n vers
un namespace partagé).

### Mineur — cosmétique, nommage, duplication légère

- **Types `BadgeStatus` inlined**. `type BadgeStatus = 'live' | 'stale' | 'offline' | 'loading'` est défini dans `OHeroSection.vue` L10 ET dans `MStatusBadge.vue` L2. Devrait vivre dans `packages/shared/src/types/` ou `apps/web/src/lib/status.ts` et être importé.
- **Magic string `'TBD'`** dans `OStationDrawer.vue` L90 (`station.ofevCode.startsWith('TBD')`). Nommée `RESEARCH_OFEV_PREFIX = 'TBD'` serait plus claire. Lie la logique à une convention seed implicite.
- **Duplication `ONE_DAY_MS`** dans `stores/stations.ts` L7 ET `OStationDrawer.vue` L26. Candidat à `lib/time.ts`.
- **`Introduction.mdx` faux sur Templates** (meta-finding ci-dessus). À corriger : mention `TDefaultLayout` + explication du parti "1 seul template, layout racine".
- **`OKeyMetricsSection.vue` commentaire L14-17** sur la couche singleton Pinia assume un ordre de mount (HeroSection puis MapSection). Fragile si l'ordre change dans `PHomePage.vue`.
- **`OStationMap.vue` `buildResearchPopupHtml`** construit du HTML raw par interpolation string. Pas de risque XSS actuel (data interne), mais le pattern est à tracer.

### Clean — à ne pas toucher

- **`composables/useI18nList.ts`** — 20 lignes, un seul rôle, bien commenté, testé. Exemplaire.
- **`packages/shared/src/types/`** — types DTO clairs, avec `dataSource` / `sourcingStatus` orthogonaux (ADR-007 / ADR-008 respectés). Commentaires utiles.
- **`chart-model.ts`** (la logique elle-même, pas sa localisation) — pures, testées, bien documentées.
- **`station-map-mapping.ts`** idem — pures, explicite sur le choix de couleurs duplique.
- **`ASourcingBadge.vue`** et **`MStationCard.vue`** — single-responsibility, tests existants, ABEM propre.
- **Les 5 MDX design system** — rien à toucher côté contenu (hors correction templates).

## 4. Synthèse — priorités de refactor

### Top 3 findings critiques

1. **C1 — OStationDrawer god component** → extraction de 4 composables + 1 fonction pure.
2. **C3 — error typing pauvre** → union discriminée `ApiError` dans `lib/api-client.ts`.
3. **C2 — tests absents OHydroChart / OStationMap** → 2 fichiers de test d'intégration.

### Top 5 findings majeurs

1. **M2 — fetch duplication** → `lib/api-client.ts` centralise.
2. **M1 — useStationsStore multi-resp** → split en 3 composables feature-grouped.
3. **M3 — chart-model.ts / station-map-mapping.ts mal placés** → `lib/charts/` + `lib/map/` ou `composables/stations/`.
4. **M5 — `services/` vide** → renommer `lib/` + supprimer `.gitkeep`.
5. **M4 — magic numbers disséminés** → `lib/constants.ts` ou `lib/config/`.

### Patterns SkillSwap pertinents à importer

1. **`lib/api-client.ts` centralisé** (2.1) — résout C3 + M2 d'un coup.
2. **`hooks/{feature}/` feature-grouped** (2.2) — résout M1 + soutient C1.
3. **`organisms/{Page}/` feature-grouped** (2.3) — partiellement applicable (`organisms/stations/`).
4. **`lib/validation/`** (2.4) — pas d'usage immédiat, noter pour plus tard.

### Estimation budget

| Phase | Contenu | Durée estimée |
|---|---|---|
| R1 | `lib/api-client.ts` + `ApiError` typed + migration stations.ts + status.ts | 3-4 h |
| R2 | Extraction OStationDrawer : 3 composables `useEscapeClose` / `useScrollLock` / `useStationDrawer` + lib/hydrodaten.ts | 3-4 h |
| R3 | Split `useStationsStore` en 3 composables feature-grouped | 2-3 h |
| R4 | Relocation `chart-model.ts` + `station-map-mapping.ts` → `lib/charts/` + `lib/map/` | 1 h |
| R5 | Tests intégration `OHydroChart` + `OStationMap` | 2-3 h |
| R6 | `lib/constants.ts` + dedup magic numbers | 1 h |
| R7 | Findings mineurs (BadgeStatus shared, TBD const, ONE_DAY_MS, Introduction.mdx fix) | 1 h |
| R8 | `/ultrareview` final + correction findings + docs mises à jour (ADR-010 ?) | 2-3 h |
| **Total** | | **15-20 h = 2-3 jours** |

Tenable dans la fenêtre J16 → J20 (5 jours, deadline J21). Garde du buffer.

### Ordre de bataille proposé

Dépendances : R1 précède R2/R3 (elles en dépendent). R4 avant R2 (plus
propre de déplacer les fichiers avant d'extraire les composables qui les
importent). R5 peut se faire en parallèle de R1-R3.

Séquence recommandée :

1. **R4** (relocation, 1 h, risque ~0) — warmup, pas de logique touchée, que des imports.
2. **R1** (api-client centralisé, 3-4 h, risque faible si les tests existants passent).
3. **R3** (split store, 2-3 h, dépend de R1).
4. **R2** (drawer extraction, 3-4 h, dépend de R1+R3).
5. **R5** (tests intégration chart + map, 2-3 h — en parallèle de R2 si envie).
6. **R6** (magic numbers, 1 h).
7. **R7** (mineurs, 1 h).
8. **R8** (ultrareview + correctifs + ADR-010 "architecture front post-refactor", 2-3 h).

Gate à chaque étape : `pnpm format:check` + `pnpm lint` + `pnpm --filter @alpimonitor/web typecheck` + `pnpm --filter @alpimonitor/web test` verts. Commit atomique par phase R*.

---

**Fin de l'audit. Fichier prêt pour review Jérémy + décision `/ultraplan` ou attaque directe.**
