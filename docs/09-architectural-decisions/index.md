# §9 — Décisions architecturales

Les 10 ADR du projet, classées par ordre chronologique et par numéro (qui reflète l'ordre temporel). Chaque ADR suit la même structure : **Date / Statut / Implémentation (hashes) / Contexte / Décision / Conséquences (Positives / Négatives / Trade-offs assumés) / Alternatives écartées / Références**.

## Tableau récapitulatif

| # | Titre | Statut | Date | 1-line résumé |
|---|-------|--------|------|---------------|
| [ADR-001](adr-001.md) | Stack TypeScript unique (monostack) | Acceptée | 2026-04-18 | Un seul langage côté code produit (Vue + Fastify + Prisma), pas de Python |
| [ADR-002](adr-002.md) | Méthodologie ABEM pour le CSS | Acceptée | 2026-04-18 | Préfixes `a-`/`m-`/`o-`/`t-`/`p-` sur 100 % des composants Vue |
| [ADR-003](adr-003.md) | Monolithe Fastify vs microservices | Acceptée | 2026-04-18 | API + cron ingestion dans le même runtime, pas de queue |
| [ADR-004](adr-004.md) | Prisma comme ORM | Acceptée | 2026-04-18 | Schéma typé end-to-end, migrations versionnées, zéro SQL brut |
| [ADR-005](adr-005.md) | Leaflet pour la cartographie | Acceptée avec drift | 2026-04-18 | Leaflet + OSM (drift vs swisstopo WMTS initial pour zero-cost attribution) |
| [ADR-006](adr-006.md) | D3 vanilla vs wrappers Vue | Acceptée | 2026-04-18 | D3 modules directement, pas de lib wrapper, logique pure extraite |
| [ADR-007](adr-007.md) | LINDAS SPARQL comme source de données | Acceptée — pivot | 2026-04-20 | Pivot depuis XML OFEV en J4, flux `hydroweb.xml` mort |
| [ADR-008](adr-008.md) | Transparence du sourcing des stations CREALP | Acceptée — implémentée | 2026-04-22 | Champ `sourcingStatus` CONFIRMED / ILLUSTRATIVE orthogonal à `dataSource` |
| [ADR-009](adr-009.md) | Périmètre Storybook et exclusions | Acceptée — implémentée | 2026-04-23 | 15 composants storyisés, 3 organismes Pinia + Leaflet exclus |
| [ADR-010](adr-010.md) | Architecture frontend post-refactor | Acceptée — implémentée | 2026-04-23 | Façades feature-grouped, `lib/` domain-scoped, règles enforced |

## Notes de lecture

- **ADR-005 a un drift documenté** — la décision initiale visait swisstopo WMTS, la réalité tourne sur OpenStreetMap (stabilité + zero-cost attribution). Trace conservée, pas de superseded.
- **ADR-007 est un pivot structurant** — survenu en cours de sprint (J4), il a invalidé toute la section ingestion du PRD initial. L'API, le modèle de données, et les conventions de sourcing en héritent.
- **ADR-008 et ADR-010 sont les plus récents** — ils capturent les décisions post-livraison candidature (session Option A + refactor post-Storybook). Leur densité narrative est la plus élevée du corpus.

Les ADR sont aussi servies sur la branche `main` du repo GitHub sous [`docs/architecture/adr/`](https://github.com/sodigitaljeremy/alpimonitor/tree/main/docs/architecture/adr) — même contenu verbatim, accessible hors site MkDocs pour archéologie git.
