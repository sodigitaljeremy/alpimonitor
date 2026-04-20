# Workflow and Conventions

> Règles de collaboration, nommage, structure et qualité du code.
> À lire avant d'ouvrir une PR ou une session Claude Code.

## 1. Langue

- **Code, noms de fichiers, commentaires techniques, commits** : anglais
- **Labels UI, messages utilisateur, documentation produit (`brief.md`, `prd.md`)** : français
- **Noms de domaine métier géographiques** : conservés dans leur forme locale (ex: `ValDHerens`, `GrandeDixence`, `Ferpecle` — sans accents pour ASCII-friendliness dans le code)

## 2. Nommage

### 2.1 Fichiers

- **Composants Vue** : `PascalCase.vue` (ex: `StationCard.vue`). Préfixe atomic via dossier (`atoms/`, `molecules/`, etc.)
- **Composables** : `useThing.ts` en camelCase (ex: `useStationList.ts`)
- **Services / utils** : `camelCase.ts`
- **Tests** : `thing.test.ts` à côté du fichier testé OU dans `tests/` miroir
- **Types** : dans des fichiers `thing.types.ts` OU inline selon taille

### 2.2 Variables et fonctions

- Variables : `camelCase`, noms explicites, pas d'abréviation (`measurements`, pas `ms`)
- Booléens : préfixe `is`, `has`, `can`, `should` (`isLoading`, `hasAlerts`)
- Fonctions : verbe à l'infinitif (`fetchStations`, `computeAnomaly`)
- Constantes : `SCREAMING_SNAKE_CASE` pour les constantes globales, `camelCase` pour les constantes locales

### 2.3 Types et interfaces

- Types TS : `PascalCase` (`Station`, `AlertLevel`)
- Enums / union types : `PascalCase` pour le type, `SCREAMING_SNAKE_CASE` pour les valeurs
- Suffixe `DTO` pour les objets exposés par l'API (`StationDTO`)
- Suffixe `Entity` pour les entités Prisma mappées (`StationEntity`) — usage interne seulement

### 2.4 CSS

- Conventions ABEM (voir ADR-002)
- Jamais de classes utilitaires Tailwind inline mélangées à des sémantiques ABEM sur un même élément (sauf spacings contextuels)

## 3. Structure des imports

Ordre dans chaque fichier :

1. Imports standard Node / globals
2. Imports tiers (`vue`, `@prisma/client`, `d3-*`, etc.)
3. Imports internes absolus (`@/types/...`, `@/services/...`)
4. Imports internes relatifs (`./helpers`)
5. Imports de types (`import type { ... }` — groupés en fin)
6. Imports CSS en tout dernier

Un saut de ligne entre chaque groupe. ESLint autofix via `eslint-plugin-import`.

## 4. Git

### 4.1 Branches

- `main` : toujours déployable
- `feat/us-X-Y-description` : feature branches
- `fix/description` : corrections
- `chore/description` : maintenance, docs

### 4.2 Commits (conventional commits)

Format : `type(scope): description` en anglais, présent.

Types acceptés : `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`.

Exemples :
```
feat(api): add thresholds endpoint
fix(ingestion): handle malformed OFEV XML gracefully
test(domain): cover anomaly detection edge cases
chore(deps): bump prisma to 5.22
docs(adr): add ADR-007 on rate limiting strategy
```

Corps de commit optionnel pour expliquer le **pourquoi** si non-évident.

### 4.3 Pull requests

Pour ce projet solo, pas de PR formelles — merge direct sur main après revue mentale. Mais :

- **Chaque commit doit être défendable** seul : l'auteur doit pouvoir justifier les choix en interview
- **Un commit = un changement cohérent**, pas un méga-commit "WIP end of day"
- **Pas de commit de code que tu ne comprends pas**

### 4.4 Tags et releases

- Tag `v0.1.0` à la livraison MVP (fin sprint, avant soumission candidature)
- Pas de release process complexe

## 5. Tests

### 5.1 Pyramide visée

```
            /\
           /E2E\          1 scénario Playwright happy path
          /------\
         /  Comp  \       ~5-10 tests composants critiques
        /----------\
       /    Unit    \     coverage ≥ 80% sur domain + services
      /--------------\
```

### 5.2 Règles

- **Tests unitaires sur la logique métier obligatoires** : détection anomalies, évaluation seuils, parsing XML, validations Zod
- **Pas de test sur trivialités** (getters simples, templates sans logique)
- **Noms de tests explicites** : `describe('computeAnomaly')` + `it('returns true when value exceeds 2σ above mean')`
- **Un test = une assertion claire** (ou plusieurs strictement liées)
- **Pas de tests E2E pour les cas de bord** : happy path suffit pour le MVP

### 5.3 Stack

- **Unit + component** : Vitest + @vue/test-utils
- **E2E** : Playwright (headless, chromium uniquement en CI)
- **Coverage** : `@vitest/coverage-v8`

### 5.4 Organisation

- Tests co-localisés pour les petits fichiers : `foo.ts` + `foo.test.ts`
- Tests dans `tests/` pour les suites larges (ingestion, API integration)
- Fixtures dans `tests/fixtures/` (échantillons XML OFEV, etc.)

## 6. Lint et format

- **ESLint** : `@typescript-eslint`, `eslint-plugin-vue`, `eslint-plugin-import`, règles strictes
- **Prettier** : configuration partagée, print width 100, single quotes, no trailing comma ES5
- **Pre-commit hook** : lint-staged (run Prettier + ESLint sur fichiers stagés)
- **CI** : lint bloquant, test bloquant, build bloquant

## 7. Gestion des dépendances

- **pnpm** comme package manager (monorepo friendly, disk efficient)
- **Ajouter une dépendance nécessite une justification** (commit message ou ADR si majeure)
- **Éviter les deps avec < 10k downloads/mois** sauf si maintainers connus
- **Audit régulier** : `pnpm audit` avant chaque release

## 8. Revue avec Claude Code

### Règles pour l'auteur humain

- **Une session Claude Code = une tâche claire** (une US ou une sous-tâche)
- **Relire chaque diff avant commit**
- **Refuser tout code non-compris** (demander explication, ou réécrire soi-même)
- **Toujours lancer les tests avant de commit**
- **Mettre à jour le `CLAUDE.md`** en fin de session avec l'état courant

### Références obligatoires dans les prompts Claude Code

Tout prompt de dev qui touche au code doit explicitement référencer les docs pertinents :

```
Implémente l'atom `AButton` selon `@docs/ui/design-system.md` section 3.1.
Respecte la convention ABEM documentée dans `@docs/architecture/adr/002-abem-methodology.md`.
Tests unitaires selon `@docs/workflow/conventions.md` section 5.
```

C'est plus verbeux, mais **ça contraint Claude Code à se caler sur nos règles**, pas sur les siennes.

## 9. Principes transverses (rappels)

- **DRY** : éviter la duplication **après** la 3e occurrence, pas dès la 2e (évite l'abstraction prématurée)
- **KISS** : toujours privilégier la solution la plus simple qui répond au besoin
- **YAGNI** : ne pas implémenter pour un besoin hypothétique futur
- **SOLID** appliqué pragmatiquement :
  - SRP : un service = une responsabilité
  - OCP : ouvert à l'extension via config, pas via héritage complexe
  - LSP : typage strict, pas de casts non-sûrs
  - ISP : interfaces ciblées, pas de "mega-types"
  - DIP : dépendre des abstractions (interfaces TS) quand ça apporte de la valeur de test

## 10. Gestion de la documentation

- **Ce dossier `docs/` est source de vérité** pour toute question de design, métier ou process
- **Un changement de décision = mise à jour du doc concerné** + ADR si structurant
- **Un ADR obsolète n'est jamais supprimé** : il est passé à `Statut: Superseded by ADR-XXX`
- **Le README.md racine reste court** : il renvoie vers les docs pour les détails
