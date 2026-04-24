# Conventions Git, code, commits

Règles de collaboration et de qualité du code. À lire avant d'ouvrir une PR ou une session Claude Code.

## Langue

- **Code, noms de fichiers, commentaires techniques, commits** : anglais.
- **Labels UI, messages utilisateur, documentation produit** : français.
- **Noms de domaine métier géographiques** : forme locale sans accents ASCII-friendly dans le code (`ValDHerens`, `GrandeDixence`, `Ferpecle`).
- **ADR et doc architecturale** : français (lisibilité candidature CREALP).

## Nommage

**Fichiers** — Composants Vue en `PascalCase.vue` dans leur dossier atomic (`atoms/`, `molecules/`, `organisms/`, `templates/`, `pages/`). Composables en `useThing.ts` camelCase. Utils en `camelCase.ts`. Tests co-localisés `thing.test.ts` ou dans `tests/` pour les suites larges.

**Variables et fonctions** — `camelCase` explicite (pas d'abréviation : `measurements`, pas `ms`). Booléens préfixés `is` / `has` / `can` / `should`. Constantes globales en `SCREAMING_SNAKE_CASE`, locales en `camelCase`.

**Types TS** — `PascalCase` (`Station`, `AlertLevel`). Enums + union types en `SCREAMING_SNAKE_CASE` pour les valeurs (`dataSource: 'LIVE' | 'RESEARCH' | 'SEED'`). Suffixe `DTO` pour les objets exposés par l'API.

**CSS** — ABEM strictement ([ADR-002](../09-architectural-decisions/adr-002.md)). Jamais de classes utilitaires Tailwind inline mélangées à des classes sémantiques ABEM sur un même élément (sauf spacings contextuels).

## Imports

Ordre dans chaque fichier : standard Node → tiers (`vue`, `pinia`, `@prisma/client`) → internes absolus (`@/lib/...`) → internes relatifs (`./helpers`) → types (`import type { ... }` en fin) → CSS en dernier. Un saut de ligne entre chaque groupe. ESLint autofix via `eslint-plugin-import`.

## Git

**Branches** — `main` toujours déployable. Feature branches `feat/us-X-Y-description`, corrections `fix/description`, maintenance `chore/description`.

**Commits (conventional commits)** — `type(scope): description` en anglais, présent. Types acceptés : `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`. Corps optionnel pour expliquer le **pourquoi** si non-évident.

**Atomic commits obligatoires** — un commit = un sous-livrable testable. Pas d'accumulation multi-phases dans le working tree (règle d'engagement 6 de `CLAUDE.md`).

**Chaque commit doit être défendable seul** en entretien. L'auteur doit pouvoir justifier les choix en cinq phrases.

**Push feature branches régulièrement** pour déclencher la CI en avance. La CI actuelle trigger uniquement sur `push: main` + PR — garder une branche 9 commits local-only expose à une flakiness cross-env détectée au merge (cf. mémoire projet `feedback_ci_feedback_loop`, incident flakiness d3 tick sur CI après merge 2026-04-23).

**Tags** — version-phase : `v1.0.0-crealp` (livraison candidature), `v1.1.0-refactor` (post-refactor architecture). Pas de release process complexe.

## Tests

**Pyramide visée** :

```text
            /\
           /E2E\          0 aujourd'hui — Playwright reporté v2
          /------\
         /  Comp  \       Vitest + @vue/test-utils sur organismes critiques
        /----------\
       /    Unit    \     logique pure (lib/, composables, chart-model)
      /--------------\
```

**Règles** — tests obligatoires sur la logique métier (parsing SPARQL, validations Zod, règles de seuil). Pas de test sur trivialités (getters, templates sans logique). Noms explicites (`describe('findNearestPointByPx') + it('returns null for empty list')`). Un test = une assertion claire ou plusieurs strictement liées.

**Stack** — Vitest + `@vue/test-utils` + Testing Library pour le web ; Vitest + Fastify inject + Prisma test DB pour l'API. `@vitest/coverage-v8` disponible mais pas enforced.

**Organisation** — tests co-localisés pour les petits fichiers (`foo.ts` + `foo.test.ts`), dossier `tests/` miroir pour les suites larges (ingestion, API integration).

## Lint et format

- **ESLint** — `@typescript-eslint`, `eslint-plugin-vue`, `eslint-plugin-import`, règles strictes.
- **Prettier** — config partagée, print width 100, single quotes, no trailing comma ES5.
- **Pre-commit hook** — `lint-staged` (Prettier + ESLint sur fichiers stagés).
- **CI** — `pnpm format:check` + `pnpm lint` + `pnpm typecheck` (post-fix C1 : `vue-tsc --noEmit --project tsconfig.app.json`) + `pnpm test` + `pnpm build`. Informative sur PR, non-bloquante à ce jour.

## Gestion des dépendances

- **pnpm** comme package manager (monorepo friendly, disk efficient).
- **Ajouter une dépendance nécessite une justification** — commit message ou ADR si majeure. Règle d'engagement 4 de `CLAUDE.md`.
- **Éviter les deps à faible popularité** sauf si mainteneurs connus.

## Revue avec Claude Code

- **Une session = une tâche claire** (une US ou une sous-tâche).
- **Relire chaque diff avant commit.**
- **Refuser tout code non-compris** — demander explication ou réécrire soi-même.
- **Toujours lancer les tests avant commit.**
- **Mettre à jour `CLAUDE.md`** en fin de session avec l'état courant.
- **Référencer les docs** dans les prompts : `@docs/08-cross-cutting-concepts/design-system.md §Tokens` — contraint Claude à se caler sur les règles projet.

## Principes transverses

- **DRY** — éviter la duplication **après la 3ᵉ occurrence**, pas dès la 2ᵉ (évite l'abstraction prématurée).
- **KISS** — privilégier la solution la plus simple qui répond au besoin.
- **YAGNI** — règle d'engagement 2 de `CLAUDE.md`, dure. Pas d'implémentation pour un besoin hypothétique futur.
- **SOLID** appliqué pragmatiquement — SRP un service = une responsabilité, interfaces ciblées (pas de méga-types), dépendance aux abstractions TS quand ça apporte une valeur de test.

## Documentation

- **Source de vérité** = ce dossier `docs/` (ce site arc42). Toute dérive entre la doc et l'implémentation doit être corrigée dans le même commit que la modification du code.
- **Un changement de décision** = mise à jour du doc concerné + ADR si structurant.
- **Un ADR obsolète** = passé à `Statut: Superseded by ADR-XXX`, jamais supprimé.
- **README racine court** — pointe vers `docs.alpimonitor.fr` et `storybook.alpimonitor.fr`.
