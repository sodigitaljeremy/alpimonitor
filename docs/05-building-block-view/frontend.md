# Frontend (Vue 3 + Pinia)

Décomposition C4-C3 du container SPA. L'architecture post-refactor est entièrement spécifiée dans [ADR-010](../09-architectural-decisions/adr-010.md) — ce document en donne la vue orientée *building blocks*.

## 5.F.1 Couches

```
src/
├── components/
│   ├── atoms/         # a- (ABadge, AButton, AIcon, ANumericValue, ASourcingBadge)
│   ├── molecules/     # m- (MSectionHeader, MStatCard, MStationCard, MStatusBadge)
│   ├── organisms/     # o- (OHeroSection, OHydroChart, OKeyMetricsSection, OMapSection,
│   │                  #     OResearchZonesSection, OSiteFooter, OStationDrawer,
│   │                  #     OStationMap, OWhyLindasSection)
│   └── templates/     # t- (TDefaultLayout)
├── pages/             # p- (PHomePage)
├── composables/
│   ├── shared/        # useEscapeClose, useScrollLock, usePolling
│   ├── stations/      # useStationsList, useStationSelection,
│   │                  # useStationMeasurements, useStationDrawer
│   └── useI18nList.ts
├── lib/               # logique pure — aucune dépendance Vue/Pinia
│   ├── api-client.ts  # HTTP centralisé + ApiError discriminé
│   ├── charts/        # chart-model (D3 pure)
│   ├── map/           # station-map-mapping (Leaflet mapping pure)
│   ├── constants/     # chart.ts, map.ts, time.ts
│   ├── hydrodaten.ts  # stationToHydrodatenUrl + RESEARCH_OFEV_PREFIX
│   └── status.ts      # type BadgeStatus partagé
├── stores/            # Pinia singletons (stations, status)
├── locales/           # fr.json (vue-i18n FR uniquement)
├── router/            # 1 route (home), scrollBehavior configuré
├── assets/            # main.css (Tailwind layers)
└── main.ts
```

Préfixes ABEM strictement appliqués ([ADR-002](../09-architectural-decisions/adr-002.md)) — un composant `.vue` porte toujours un préfixe `a-/m-/o-/t-/p-` à son fichier et à sa classe racine.

## 5.F.2 Pattern façades feature-grouped

`useStationsStore` portait 3 responsabilités (liste, sélection UI, cache mesures). R3 du refactor a introduit 3 façades **read-only** sous `composables/stations/` :

- **`useStationsList()`** — expose `stations`, `isLoading`, `error`, `hasLoadedOnce`, `loadAll()`. Consommé par `OMapSection` et `OKeyMetricsSection`.
- **`useStationSelection()`** — expose `selectedStation`, `selectedStationId`, `selectStation(id)`, `clearSelection()`. Consommé par `OStationMap` (click → sélection) et indirectement par `OStationDrawer`.
- **`useStationMeasurements(stationId: Ref<string | null>)`** — reçoit un `stationId` réactif, dérive `series`, `isLoading`, `error` via `computed` (pas `storeToRefs` car la clé varie), expose `load()` et `reload()`. Consommé par `useStationDrawer`.

Un barrel `composables/stations/index.ts` ré-exporte les 3 + le composable orchestrateur `useStationDrawer`.

**Règle enforced** — aucun fichier `.vue` de production n'importe `useStationsStore`. Vérifiable :

```bash
grep -rn "useStationsStore" --include="*.vue" src/
# → 0 résultat
```

Exceptions documentées dans les JSDoc de tête : tests (`.test.ts`) et decorators Storybook (`seedStations`) peuvent `$patch` le store directement pour le seed de scénarios contrôlés.

## 5.F.3 Orchestrateur `useStationDrawer`

`OStationDrawer.vue` est un organisme visuel — son `<script setup>` ne contient plus que 22 lignes après le refactor R2 (contre 102 avant). Toute la logique vit dans `composables/stations/useStationDrawer.ts` :

- Souscription aux façades `useStationSelection` + `useStationMeasurements(selectedStationId)`.
- Snapshot de `now` à la sélection (fenêtre stable tant que le drawer est ouvert).
- `watch(selectedStationId)` → déclenche `load()` + reset du snapshot.
- Dérivations présentationnelles : `dischargeSeries`, `coordsLabel`, `hydrodatenUrl`.
- Montage des primitives transverses : `useEscapeClose(isOpen, close)` + `useScrollLock(isOpen)`.
- Méthodes publiques : `close()`, `retry()`.

Testé en isolation (`useStationDrawer.test.ts`) via un composant probe — pas besoin de mount le `.vue`.

## 5.F.4 Couche `lib/` — logique pure

`lib/` ne contient aucune dépendance Vue reactivity ni Pinia (hors `Ref` en signature pour `useStationMeasurements`). Testable sans monter de composant :

- **`api-client.ts`** — `api.getStations()`, `api.getStationMeasurements(id, params)`, `api.getStatus()`, `api.getHealth()`. Retourne un `ApiResponse<T> = { success: true; data: T } | { success: false; error: ApiError }` où `ApiError` est une union discriminée `network | http | parse`. Chaque consumer (stores + composables) nomme sa branche d'échec via le compilateur — impossible d'oublier un cas.
- **`charts/chart-model.ts`** — `computeYDomain`, `findNearestPointByPx`. Fonctions pures D3, testées avec des points synthétiques.
- **`map/station-map-mapping.ts`** — `stationToMarkerOptions`, `findLatestDischarge`. Mapping Leaflet pur (couleurs, radius, fill).
- **`hydrodaten.ts`** — `stationToHydrodatenUrl(station)` + constante `RESEARCH_OFEV_PREFIX = 'TBD'`. Lie la règle de génération d'URL Hydrodaten à un préfixe seed explicite.
- **`constants/{chart,map,time}.ts`** — magic numbers dédupliqués (`MARGIN`, `MAP_CENTER`, `MAP_ZOOM`, `ONE_DAY_MS`, `NARROW_BREAKPOINT`, …).
- **`status.ts`** — type `BadgeStatus = 'live' | 'stale' | 'offline' | 'loading'` partagé entre `MStatusBadge.vue` et `OHeroSection.vue` (auparavant inliné dans chaque fichier).

## 5.F.5 Stores Pinia

Deux singletons :

- **`useStationsStore`** — état liste + sélection + cache per-station des mesures. Accessible uniquement via les 3 façades (règle §5.F.2).
- **`useStatusStore`** — snapshot ingestion (`lastSuccessAt`, `minutesSinceLastSuccess`, `isHealthy`, `today.runsCount`, …). Pas de façade — 2 consommateurs prod (`OHeroSection`, `OKeyMetricsSection`), rule-of-three non atteinte. Décision explicitée dans le JSDoc de tête de `stores/status.ts` et tracée dans [ADR-010 §2.2](../09-architectural-decisions/adr-010.md).

Chaque fetch utilise `api.*` de `lib/api-client.ts` — aucun `fetch()` direct dans les stores ni les composables.
