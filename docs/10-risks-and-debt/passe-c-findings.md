# Passe C — Findings post-refactor (sans `/ultrareview` cloud)

## Contexte

- `/ultrareview` renvoie 404/502 de manière transitoire depuis 24 h → pivot Plan C : relecture disciplinée locale.
- Scope : 7 commits sur `feature/refactor-architect` (`ec8b860..958baf3`).
- Relecture axée sur 8 axes (error handling, race conditions, memory leaks, typing, tests faibles, cohérence cross-file, Pinia/Vue 3 anti-patterns, règle "pas d'accès direct `useStationsStore`").
- 102 tests passent. Gate `pnpm typecheck` dit « vert » — voir **C1** : ce gate ne vérifie rien.

## Findings

### Critical (1)

#### C1 — `pnpm typecheck` ne typecheck rien (gate faussement vert)

- **Fichier** : `apps/web/package.json:10`
- **Sévérité** : Critical
- **Description** : Le script `"typecheck": "vue-tsc --noEmit"` exécute `vue-tsc` sans `-p/--project` ni `-b`. Avec `composite: true` dans `tsconfig.app.json` et `files: []` dans `tsconfig.json` racine, `vue-tsc` n'entre dans aucun projet et sort en `exit 0` silencieux sans produire d'output.
- **Preuve** : `pnpm vue-tsc --noEmit --project tsconfig.app.json` fait surgir 39 erreurs (dont `M1`, `M2`, `vite.config.ts`, plusieurs Storybook stories). `git checkout main` + même commande → 39 erreurs aussi. Le gate est cassé depuis au moins J15 (pas introduit par le refactor), mais la claim « gates all green » repose dessus.
- **Impact user-facing** : aucun immédiat. Impact projet : la CI GitHub Actions, `pre-commit`, et toute revue future reposent sur un check qui ne check pas. Toute régression de typage passe inaperçue.
- **Fix proposé** : remplacer le script par `vue-tsc -b` (build mode, exit code correct, walk les composite projects) **ou** `vue-tsc --noEmit --project tsconfig.app.json`. Vérifier le comportement dans la CI (workflow GitHub Actions doit bien échouer sur une erreur). Corriger avant merge main : le patch de script est trivial, mais les 39 erreurs qu'il fera remonter doivent être triées (voir M1, M2, et pré-existants).

---

### Major (4)

#### M1 — Factories de test `makeStation` omettent le champ requis `sourcingStatus`

- **Fichiers** :
  - `apps/web/src/components/organisms/OStationDrawer.test.ts:16-31`
  - `apps/web/src/components/organisms/OKeyMetricsSection.test.ts:16-31`
  - `apps/web/src/lib/map/station-map-mapping.test.ts:6-22`
- **Sévérité** : Major
- **Description** : `StationDTO` requiert `sourcingStatus: SourcingStatus` (non optionnel, depuis ADR-008 session Option A). Les 3 factories ci-dessus retournent `StationDTO` sans ce champ. Masqué par C1. Deux autres factories (`stations.test.ts:16-31`, `useStationSelection.test.ts:9-25`, `useStationsList.test.ts:10-26`, `useStationMeasurements.test.ts` via `$patch`, `useStationDrawer.test.ts:12-28`, `hydrodaten.test.ts:6-22`, `OStationMap.test.ts:94-125`) incluent bien le champ — d'où l'incohérence.
- **Impact user-facing** : nul (tests passent, logique sourcing pas exercée par ces suites). Impact dev : typecheck correctement gating fera échouer CI ; les tests OStationMap re-render / OKeyMetricsSection ne vérifient jamais une station research avec un `sourcingStatus` non-trivial (CONFIRMED/ILLUSTRATIVE).
- **Fix proposé** : ajouter `sourcingStatus: partial.sourcingStatus ?? 'CONFIRMED'` (même défaut que `stations.test.ts:28`). 3 lignes à ajouter, cohérence des fixtures restaurée.

#### M2 — `chart-model.ts` incompatible `noUncheckedIndexedAccess`

- **Fichier** : `apps/web/src/lib/charts/chart-model.ts:24, 27, 33`
- **Sévérité** : Major
- **Description** : `points[0]` retourne `MeasurementPoint | undefined` (base tsconfig active `noUncheckedIndexedAccess`). La valeur est passée à `project: (p: MeasurementPoint) => number` → TS2345. La fonction `findNearestPointByPx` déclare retourner `MeasurementPoint | null` mais son `return best` retourne `MeasurementPoint | undefined`. Masqué par C1. Pré-existant au refactor (R4 n'a fait que déplacer le fichier).
- **Impact user-facing** : en pratique, `points.length === 0` est géré en amont, donc les accès `points[0]` et `points[i]` sont toujours définis à runtime. Aucun crash constaté. Mais un call-site futur qui appelle `findNearestPointByPx([], …)` sans passer par la garde d'amont crasherait sur `project(undefined)`.
- **Fix proposé** : restructurer `best` via `let best: MeasurementPoint = points[0]!` + mêmes non-null assertions sur `points[i]`, OU mieux : `for (const p of points) { if (best === undefined) { best = p; bestDist = …; continue; } … }` en typant `best: MeasurementPoint | undefined` et en guardant le return.

#### M3 — `useStatusStore` bypass le pattern façade — asymétrie non documentée

- **Fichiers** :
  - `apps/web/src/components/organisms/OHeroSection.vue:10`
  - `apps/web/src/components/organisms/OKeyMetricsSection.vue:9`
- **Sévérité** : Major
- **Description** : R3 a enforced la règle « aucun consumer prod n'importe `useStationsStore` hors façades » (vérifié clean par grep : seuls tests + Storybook touchent le store directement). Mais `useStatusStore` n'a PAS de façade et reste importé directement par 2 organismes prod. L'audit (section §2.2) justifiait cette asymétrie (« useStatusStore plus simple, 1 contexte »), mais ce choix n'est nulle part verrouillé en ADR ni commentaire — un lecteur arrivant après merge va naturellement se demander si c'est une omission ou une décision.
- **Impact user-facing** : aucun. Impact dev : cognitive overhead ; prochaine feature status (ex : ajout d'un polling côté keyMetrics) va soit re-traverser le store directement soit inventer une façade ad-hoc — drift architectural.
- **Fix proposé** : **option A** (léger) — commentaire d'ouverture dans `stores/status.ts` expliquant pourquoi pas de façade + mention dans ADR-010. **Option B** (cohérent) — créer `composables/status/useIngestionStatus.ts` qui miroite `useStationsList` (storeToRefs + méthode `refresh`). Préférer A sauf si une deuxième façade status émerge.

#### M4 — `OStationDrawer.test.ts` teste encore via mount(.vue) au lieu de tester le composable

- **Fichier** : `apps/web/src/components/organisms/OStationDrawer.test.ts` (149 lignes)
- **Sévérité** : Major
- **Description** : R2 a extrait `useStationDrawer` justement pour rendre le drawer testable sans monter le composant. `useStationDrawer.test.ts` (177 lignes) exerce bien le composable via un probe. Mais `OStationDrawer.test.ts` continue de mocker `fetch`, monter le composant, trigger les clicks sur `.o-station-drawer__close` etc. — il teste à la fois la template et la logique. Duplication d'intent : si je change `close()` dans le composable, les deux suites cassent. Si je change le template, seule la deuxième casse.
- **Impact user-facing** : aucun. Impact dev : budget tests double-jobbed sur la même surface ; les tests lents (Puppeteer-like mount + fetch mock) éclipsent les tests rapides (composable pur).
- **Fix proposé** : ne pas supprimer `OStationDrawer.test.ts` — il reste utile comme smoke test de rendu. Mais alléger : garder uniquement « monte, render le nom de station, close button dispatche l'event » (3 tests de rendu) et laisser les assertions sur escape, scroll-lock, retry, hydrodaten-nullity aux suites composable/shared. Budget M4 : à trancher — peut attendre post-merge si pas le temps.

---

### Minor (5)

#### m1 — `src/services/.gitkeep` dead directory

- **Fichier** : `apps/web/src/services/.gitkeep`
- Audit M5 proposait de renommer `services/` → `lib/` et supprimer `.gitkeep`. R4 a bien créé `lib/` mais n'a pas supprimé `services/`. Deux dirs qui racontent deux fois la même histoire. `trash src/services`.

#### m2 — Storybook decorators seedent `Error` brut dans `error: ApiError | null`

- **Fichier** : `apps/web/src/components/organisms/OMapSection.stories.ts:67-69`
- Depuis R1, `useStationsStore.error` est typé `ApiError | null`. La story seed `new Error('Simulated network failure')`. TypeScript gueule (cf. C1), mais le rendu visuel fonctionne (OMapSection fait juste `v-else-if="error"` truthy-check). Réparer en passant `{ kind: 'network', cause: new Error('Simulated network failure') }` — aligne la story avec la surface post-R1.

#### m3 — `useScrollLock` non-composable-safe (1 seul consumer tolérable)

- **Fichier** : `apps/web/src/composables/shared/useScrollLock.ts:17-40`
- Si deux consumers instancient `useScrollLock` simultanément, le second snapshotterait `'hidden'` (posé par le premier) comme valeur à restaurer — l'ordre de fermeture détermine si l'état final est correct. Pratiquement N/A : il n'y a qu'un seul drawer dans l'app. Mais le composable est présenté comme shared/réutilisable → violation silencieuse de son propre contrat.
- Fix : soit ref-counter module-scoped (`let locks = 0; if (locks === 0) snapshot ; locks++;`), soit commenter explicitement « single-consumer only » en tête de fichier.

#### m4 — `useStationDrawer.now` vs `store.fetchMeasurements` window — skew de ~1s

- **Fichier** : `apps/web/src/composables/stations/useStationDrawer.ts:59-67` + `apps/web/src/stores/stations.ts:82-83`
- Le composable snapshot `now = new Date()` pour l'axe X du chart. Le store snapshot SON propre `now` au moment du fetch (quelques ms plus tard en pratique, jusqu'à 1s si la sélection est bloquée par un fetch concurrent). Le chart affichera donc `[drawerNow - 24h, drawerNow]` mais les données reçues couvrent `[fetchNow - 24h, fetchNow]`. Invisible à l'œil.
- Fix : passer `from/to` depuis le composable vers le store (`fetchMeasurements(id, { from, to })`), OU accepter le skew et documenter. Pas prioritaire.

#### m5 — `VITE_API_BASE_URL` undefined silencieux

- **Fichier** : `apps/web/src/lib/api-client.ts:19`
- `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;` — si la variable manque, `fetch('undefined/stations')` → `TypeError: Failed to fetch` → surface comme `{ kind: 'network' }`. L'UI affichera « something went wrong » sans distinguer « env mal configuré en build » de « backend down ». POC-acceptable ; noter pour prod.
- Fix : `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''` n'améliore pas (idem, 404). Meilleur : throw at module load si undefined, ou fallback explicite sur `/api/v1` + warn.

---

## Axes propres (RAS)

- **Axis 2 — Race conditions** : RAS. Les 3 façades fan out proprement (`selectedStationId` unique, mesures cached per-station key). `usePolling` est stateless par design — si `fetchStatus > 60s`, 2 fetchs concurrent sont attendus et non-destructifs (le dernier assignement gagne, même ID). Clic rapide A → B → A n'entraîne pas corruption cache (keys disjoints).
- **Axis 3 — Memory leaks** : RAS. Tous les `setInterval` (`usePolling`), `ResizeObserver` (`OHydroChart`, `OStationMap`), `addEventListener` (`useEscapeClose` via `@vueuse/core`), `watch` (auto-cleanup) bind leur teardown à `onScopeDispose` ou au lifecycle Vue. `map.remove()` et `resizeObserver.disconnect()` appelés sur unmount.
- **Axis 7 — Pinia/Vue 3 anti-patterns** : RAS. `storeToRefs` utilisé correctement pour les refs à clé fixe (`useStationsList`, `useStationSelection`). `useStationMeasurements` utilise `computed` (pas `storeToRefs`) pour l'accès dynamique par `stationId` — c'est le bon pattern car le key change. Réactivité OK (le store réassigne toujours l'objet entier, donc `computed` re-run sur mutation).
- **Axis 8 — Règle façade stations** : ENFORCED. `grep -rn "useStationsStore" --include="*.vue" src/` retourne 0 résultat. Les seuls imports de `@/stores/stations` hors façades/tests sont `OMapSection.stories.ts` (exception Storybook) + `OStationMap.test.ts` / `OKeyMetricsSection.test.ts` / `OStationDrawer.test.ts` (exceptions tests via dynamic import pour le mock Leaflet, ou `$patch` pour seed controlled state). Aucune violation prod.

---

## Synthèse

- **Total findings** : 10 (1 Critical / 4 Major / 5 Minor)
- **Corrections recommandées AVANT merge main** :
  1. **C1** — fix script `typecheck` (1 ligne), re-run, trier les erreurs révélées.
  2. **M1** — ajouter `sourcingStatus` dans les 3 factories de test (3 lignes).
  3. **M2** — corriger `chart-model.ts` pour `noUncheckedIndexedAccess` (restructuration mineure).
  4. **m1** — supprimer `src/services/.gitkeep` (dead dir).
  5. **m2** — aligner story `OMapSection` sur `ApiError` typé.
- **Corrections à tracer dans ADR-010 comme dette assumée** :
  - **M3** — asymétrie façade stations / direct useStatusStore (si option A choisie) ; ou redirection vers future US pour créer façade status.
  - **M4** — overlap tests .vue vs composable pour OStationDrawer ; décision "garder les deux, budget doubled" vs "slim le .vue test" à trancher post-candidature.
  - **m3** — `useScrollLock` single-consumer only (commenter ou ref-compter).
  - **m4** — skew `drawerNow` vs `fetchNow`, acceptable tant que pas d'auto-refresh.
- **Corrections à skipper (pas de fix dans le scope candidature)** :
  - **m5** — env var undefined ; comportement POC-acceptable, flagger prod.
  - Les 39 erreurs Storybook (`OHeroSection.stories.ts`, `ABadge.stories.ts`, `AButton.stories.ts`, `OMapSection.stories.ts`) pré-existantes du merge J15 → tracer séparément en tâche « pré-candidature si budget ».

**Estimation totale pré-merge** : ~90 min (C1 + M1 + M2 + m1 + m2).

**Note sur le scope refactor vs dette héritée** : aucun des findings critique ou majeur n'est attribuable exclusivement aux 7 commits refactor. C1 et M2 pré-existaient ; M1 est apparu quand le champ `sourcingStatus` est devenu requis (session Option A, 2026-04-22), les tests ajoutés à R2/R3 ont hérité du problème sans le voir car C1 masquait tout. M3 est une conséquence de R3 (façade pour stations) qui n'a pas été étendue à status — par design selon audit §2.2, mais non-documentée.
