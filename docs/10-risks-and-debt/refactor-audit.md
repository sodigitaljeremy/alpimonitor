# Audit refactor — J16 (2026-04-23 après-midi)

> Version condensée rétrospective post-R8. Le document source complet de l'audit (332 lignes, structure pré-refactor) vit dans le repo à [`docs/refactor/audit.md`](https://github.com/sodigitaljeremy/alpimonitor/blob/main/docs/_legacy/refactor/audit.md) et sert d'archéologie complète. Cette page garde le signal qui reste utile **après** application des phases R1→R8 : statut des hypothèses, patterns importés, findings résolus vs assumés, méta-réflexion sur la méthode.

## 1. Contexte avant refactor

L'audit a été rédigé la même journée que son exécution (2026-04-23 après-midi), en aval du livrable candidature initial `v1.0.0-crealp` (2026-04-22) et de la session Storybook (J15/matin), en amont de toute modification de code. Scope : `apps/web/`. Backend et `packages/shared/` lus pour comprendre les contrats, mais hors focus refactor.

Objectif : refonte architecturale niveau « Architect Engineer », démontrable à un relecteur en moins de 10 min via un diff lisible et une ADR finale. Budget estimé : 15-20 h (2-3 jours). Budget réel : ~8-10 h étalées sur la même journée 2026-04-23 (15:42 commit audit → 22:07 commit R8 → 22:23 commit ADR-010).

## 2. Les 10 hypothèses de dette — statut post-R8

| # | Hypothèse pré-refactor | Verdict audit | Statut post-R8 |
|---|------------------------|---------------|----------------|
| 1 | `organisms/` fourre-tout (`.vue` + `.ts` libres + tests mélangés) | ✅ confirmé | **Résolu R4** — `chart-model.ts` + `station-map-mapping.ts` déplacés vers `lib/charts/` + `lib/map/` |
| 2 | `services/` vide avec `.gitkeep` orphelin | ✅ confirmé | **Résolu R8** — dir supprimé, `lib/` concrétise l'intention |
| 3 | Pas de `types/` ni `domain/` côté web | ✅ confirmé | **Résolu R1** — types partagés via `packages/shared/src/types/`, `lib/status.ts` partage `BadgeStatus` |
| 4 | Research stations dans `fr.json` | ✅ confirmé | **Dette assumée** — tracée [ADR-008 §Trade-offs](../09-architectural-decisions/adr-008.md). Bascule DB post-candidature |
| 5 | `OStationDrawer.vue` god component (271 lignes, 7 responsabilités) | ✅ **critique** | **Résolu R2** — 4 primitives extraites (`useEscapeClose`, `useScrollLock`, `useStationDrawer`, `lib/hydrodaten.ts`) |
| 6 | Stores `stations` + `status` multi-responsabilités | ✅ confirmé | **Partiellement résolu** — `useStationsStore` split en 3 façades (R3), `useStatusStore` laissé (rule of 3 non atteinte, [§10.2](index.md)) |
| 7 | `OHydroChart` charge trop | ⚠️ partiel | **Non traité** — logique pure déjà dans `chart-model.ts`, ResizeObserver + pointer events acceptables in-place |
| 8 | `lindas-parser` intouchable | N/A backend | **N/A** — hors scope refactor frontend |
| 9 | `OHydroChart` / `OStationMap` sous-testés | ✅ confirmé | **Résolu R5** — 2 suites intégration ajoutées (`OHydroChart.test.ts` 170 lignes, `OStationMap.test.ts` 239 lignes) |
| 10 | Onboarding pénible (data flow, sourcingStatus, placement `chart-model.ts`) | ✅ confirmé | **Résolu R4+R3+R2** — `lib/` domain-scoped + façades nommées + barrel `composables/stations/index.ts` |

**Meta-finding J15** (`Introduction.mdx` affirmant "Templates non utilisés à date" alors que `TDefaultLayout` existe) → **Résolu R6+R7** (commit `958baf3`).

## 3. Patterns SkillSwap importés

Quatre patterns issus du codebase Next.js 15 + React de Jérémy (`~/Desktop/Documentation SkillSwap/projet-skillswap/`) transposés au stack Vue 3 + Pinia :

- **`lib/api-client.ts` centralisé** (SkillSwap `frontend/src/lib/api-client.ts`) → implémenté R1. Union discriminée `ApiError = network | http | parse` + `ApiResponse<T> = { success, data?, error? }`. Cadré par [ADR-010 §Décision.lib/](../09-architectural-decisions/adr-010.md).
- **`hooks/{feature}/` feature-grouped** (SkillSwap `hooks/messaging/`, `hooks/profile/`) → implémenté R3 sous `composables/stations/` (4 composables + `index.ts` barrel). Cadré par [ADR-010 §Décision.façades](../09-architectural-decisions/adr-010.md).
- **`organisms/{Page}/` feature-grouped** (SkillSwap `organisms/ConversationPage/`) → **partiellement appliqué**. AlpiMonitor étant mono-page, un regroupement `organisms/stations/` n'apporte pas le même bénéfice — les composables de `composables/stations/` jouent déjà le rôle de feature grouping. Pattern reçu comme inspiration, non cloné.
- **`lib/validation/` co-localisée** (SkillSwap `lib/validation/auth.validation.ts`) → **noté, pas appliqué**. Zod reste dans `packages/shared/src/schemas/`. Pattern pertinent si une validation front-only apparait (ex: formulaire admin, hors scope v1).

## 4. Top 3 Critiques + Top 5 Majeurs — statut

### Critiques (3)

- **C1 — `OStationDrawer.vue` god component** → **Résolu R2** (`2a68f28`). 271 → 193 lignes, script setup passé de 102 à 22 lignes. 4 primitives extraites + 1 fonction pure.
- **C2 — Tests absents sur `OHydroChart` / `OStationMap`** → **Résolu R5** (`355402c`). 2 suites intégration avec mock Leaflet + ResizeObserver.
- **C3 — Error typing pauvre (`Error` générique)** → **Résolu R1** (`02c9a8f`). Union discriminée `ApiError`. Chaque consumer nomme sa branche via le compilateur.

### Majeurs (5)

- **M1 — `useStationsStore` multi-responsabilités** → **Résolu R3** (`a2f47a1`). Split en 3 façades `useStationsList`, `useStationSelection`, `useStationMeasurements`. Règle enforced "aucun consumer prod hors façades" vérifiée par grep.
- **M2 — Duplication fetch/error handling (stations + status + useApi)** → **Résolu R1** (`02c9a8f`). `lib/api-client.ts` centralise, les stores délèguent. `useApi` composable supprimé.
- **M3 — `chart-model.ts` + `station-map-mapping.ts` mal placés dans `organisms/`** → **Résolu R4** (`3f775d5`). Déplacés vers `lib/charts/` + `lib/map/`.
- **M4 — `services/` vide, `utils/` feature-spécifique** → **Résolu R8** (`9439e43`). `services/` supprimé, `utils/relativeTime.ts` laissé en place (dette minime, renaming n'apporte pas).
- **M5 — Magic numbers disséminés** → **Résolu R6+R7** (`958baf3`). `lib/constants/{chart,map,time}.ts` dédupliquent 6 constantes (`MARGIN`, `MAP_CENTER`, `MAP_ZOOM`, `ONE_DAY_MS`, `NARROW_BREAKPOINT`, …).

**Findings passe C (J17 soirée)** post-refactor → voir [passe-c-findings.md](passe-c-findings.md) pour le détail (1 Critical / 4 Major / 5 Minor). 5 résolus pré-merge dans R8, 5 tracés en dette assumée dans [§10.2](index.md).

## 5. Budget estimé vs réel

| Phase | Contenu | Estimé | Réel |
|-------|---------|--------|------|
| R4 | Relocation chart-model + station-map-mapping | 1 h | ~30 min |
| R1 | `lib/api-client.ts` + `ApiError` discriminé | 3-4 h | ~1 h |
| R3 | Split `useStationsStore` en 3 façades | 2-3 h | ~1 h |
| R2 | Extraction `OStationDrawer` → 4 primitives | 3-4 h | ~2 h |
| R5 | Tests intégration chart + map | 2-3 h | ~1 h 30 |
| R6+R7 | Constantes + BadgeStatus + fix docs | 1 h | ~1 h |
| R8 | Passe C + corrections pré-merge + ADR-010 | 2-3 h | ~4 h |
| **Total** | | **15-20 h** | **~10-11 h** |

L'estimation pré-refactor était **~50 % trop large**. Explication probable : l'audit surévaluait la complexité des extractions (R2 surtout — le god component n'était pas aussi densément couplé que craint une fois le pattern façade appliqué). Process learning ci-dessous.

## 6. Process learnings — méta-réflexion sur la méthode d'audit

Trois enseignements sur la méthode elle-même, qui ne vivent nulle part ailleurs (ADR-010 raconte le résultat, pas la méta) :

**Discipline de pré-écriture avant de coder.** L'audit a pris ~2 h de lecture + rédaction avant le moindre refactor. Coût immédiat, retour immédiat : l'ordre de bataille R4 → R1 → R3 → R2 → R5 → R6+R7 a été suivi sans détour, zéro faux départ, zéro rollback. La tentation de sauter l'audit pour "gagner du temps" existe toujours — l'expérience montre que **2 h d'audit économisent 4 h de confusion** quand l'arbre de dépendances a 7 nœuds.

**Utilité des patterns SkillSwap transposés.** Importer des patterns validés depuis un autre codebase personnel (SkillSwap Next.js + React) plutôt que les inventer à partir de zéro a accéléré la conception des façades. Les 3 composables `useStationsList/Selection/Measurements` ont été cadrés en 15 min en miroir de `useConversationList/Messages/Selection` — sans l'ancrage, la discussion "1 store vs N composables" aurait pu traîner. Leçon : **transposer est un accélérateur architectural, pas un copier-coller — le pattern survient, le rationale se traduit**.

**Limite du jugement en tableau pre-refactor.** Le tableau des 10 hypothèses avait un biais de confirmation — tout ce qui est "observable pré-refactor" semble dette. En pratique, 7/10 étaient vraiment critiques, 2/10 étaient nice-to-have (7 `OHydroChart charge trop`, 10 `onboarding pénible`), 1/10 était hors scope (8 `lindas-parser` backend). **Un audit pré-refactor ne remplace pas un prototypage** — la densité de dette vraie ne se révèle qu'en touchant le code. La passe C post-R7 a été utile justement parce qu'elle a révélé **C1 (typecheck no-op silencieux)** — invisible à un audit pré-refactor qui n'exécute pas les gates.

## 7. Alternatives écartées pendant l'audit

Récap très court, détail dans le document source :

- **Ne rien refactorer post-Storybook** — rejeté, perte du levier « Architect Engineer » (cf. [ADR-010 §Alternatives écartées](../09-architectural-decisions/adr-010.md)).
- **Big-bang commit unique** — rejeté, 7 phases atomiques permettent 7 rollbacks + 7 narrative steps en entretien.
- **Trois stores Pinia distincts vs 1 store + 3 façades** — rejeté, duplication d'état partagé (`stations: StationDTO[]`) disproportionnée.

## 8. Trace complète

Le document source complet (10 hypothèses avec code snippets inline, 4 patterns SkillSwap avec citations intégrales, discussion détaillée des 13 findings initiaux, budget line par line) reste consultable dans [`docs/refactor/audit.md`](https://github.com/sodigitaljeremy/alpimonitor/blob/main/docs/_legacy/refactor/audit.md) (hors site MkDocs, servi par GitHub).

Cette version condensée ~150 lignes est suffisante pour un relecteur qui veut la rétrospective. L'archéologie exhaustive reste accessible.
