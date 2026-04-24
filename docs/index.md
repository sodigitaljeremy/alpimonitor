# AlpiMonitor — Documentation architecturale

Tableau de bord hydrologique du bassin de la Borgne (Valais, Suisse), livrable de démonstration technique pour une candidature au poste de Développeur·se Front-End au [CREALP](https://www.crealp.ch). Cette documentation suit la structure **arc42 adaptée en 10 sections** — voir la navigation en haut de page.

## Démo live

- **Application** : [alpimonitor.fr](https://alpimonitor.fr) — SPA Vue 3, carte Leaflet + drawer + chart D3 24 h.
- **API + observabilité** : [api.alpimonitor.fr/api/v1/status](https://api.alpimonitor.fr/api/v1/status) — JSON, expose `IngestionRun.lastRun` + compteurs journée.
- **Design system** : [storybook.alpimonitor.fr](https://storybook.alpimonitor.fr) — 46 stories + 5 MDX.
- **Repository** : [github.com/sodigitaljeremy/alpimonitor](https://github.com/sodigitaljeremy/alpimonitor).

Production auto-déployée sur push `main` via Coolify + VPS Hetzner ([§7 Vue de déploiement](07-deployment-view/index.md)).

## Tags et phases livrées

- **`v1.0.0-crealp`** (2026-04-22) — Livrable candidature initial : landing live, ingestion LINDAS temps réel, 7 stations cartographiées, Lighthouse Desktop 96/100/100/100.
- **`v1.1.0-refactor`** (2026-04-23) — Design system + architecture : Storybook exhaustif, façades feature-grouped, `lib/` domain-scoped, 173 tests, règle « aucun consumer prod hors façades » enforced ([ADR-010](09-architectural-decisions/adr-010.md)).

## Guide de lecture

Deux parcours recommandés selon le temps disponible.

### Parcours recruteur 30 s

1. [§1 Introduction et objectifs](01-introduction-and-goals/index.md) — pitch + 4 objectifs + personas.
2. [§3 Contexte et périmètre](03-context-and-scope/index.md) — diagramme contexte + interfaces externes + in/out scope.
3. [§9 Index ADR](09-architectural-decisions/index.md) — tableau des 10 ADR avec statut et 1-line résumé.
4. Le [repo GitHub](https://github.com/sodigitaljeremy/alpimonitor) pour échantillonner le code.

### Parcours lecteur approfondi

1. [§1 Introduction et objectifs](01-introduction-and-goals/index.md).
2. [§4 Stratégie de solution](04-solution-strategy/index.md) — choix top-level + data flow.
3. [§5 Vue des blocs de construction](05-building-block-view/index.md) + sous-pages [frontend](05-building-block-view/frontend.md) / [backend](05-building-block-view/backend.md) / [persistence](05-building-block-view/persistence.md).
4. [§6 Vue d'exécution](06-runtime-view/index.md) — 3 scénarios sequence (ingestion, sélection UI, health).
5. [§7 Vue de déploiement](07-deployment-view/index.md) + [3 post-mortems incidents](07-deployment-view/post-mortems/index.md).
6. [§9 ADR 001-010 verbatim](09-architectural-decisions/index.md) pour le détail des décisions.
7. [§10 Risques et dette](10-risks-and-debt/index.md) — non-scope candidature, dette assumée, backlog post-candidature.

## Source de cette documentation

Site généré par [MkDocs](https://www.mkdocs.org) + thème [Material](https://squidfunk.github.io/mkdocs-material/), sources Markdown dans `docs/` du repo. Diagrammes rendus en [Mermaid](https://mermaid.js.org) inline (C4 Structurizr SVG prévus pour une phase ultérieure). Voir [docs/README.md](https://github.com/sodigitaljeremy/alpimonitor/blob/main/docs/README.md) pour le setup local.
