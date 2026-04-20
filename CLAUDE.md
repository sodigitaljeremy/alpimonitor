# CLAUDE.md — Instructions for Claude Code sessions

> Ce fichier est le **premier point d'entrée** de toute session Claude Code sur ce repo.
> Il est aussi utile pour tout nouveau contributeur humain.

## Identité du projet

**AlpiMonitor** est un tableau de bord hydrologique du bassin de la Borgne (Valais, Suisse), développé en 13 jours comme démonstration technique pour une candidature au poste de **Développeur·se Front-End au CREALP** (Centre de recherche sur l'environnement alpin, Sion).

Stack : Vue 3 + Vite + TypeScript + Tailwind + Fastify + Prisma + PostgreSQL + D3 + Leaflet.
Méthodologie : Atomic Design avec convention ABEM.
Déploiement : Docker + Coolify sur VPS.

## Règles d'engagement absolues

1. **Lire les docs avant d'agir.** Tout prompt de dev doit s'appuyer sur les documents listés ci-dessous. Jamais de code sans contexte.
2. **YAGNI est une règle dure.** Ne pas implémenter ce qui n'est pas demandé. Pas d'abstraction "au cas où".
3. **ABEM strictement appliqué** pour les classes CSS, voir ADR-002.
4. **Aucune dépendance ajoutée sans justification** documentée dans le commit ou un ADR.
5. **Tests avant commit.** Une tâche n'est terminée que si les tests passent.
6. **Conventional commits** en anglais.
7. **Pas de Python, pas d'IA embarquée, pas de Vue Flow** (hors scope v1 — voir `docs/context/business.md`).
8. **L'auteur humain doit pouvoir défendre chaque ligne** en interview technique. Pas de code obscur ou "magique".

## Organisation du repo

```
alpimonitor/
├── CLAUDE.md                 ← ce fichier
├── README.md                 ← pitch public
├── apps/
│   ├── web/                  ← Vue 3 SPA
│   └── api/                  ← Fastify API + ingestion
├── packages/
│   └── shared/               ← types TS + schémas Zod partagés
├── docs/
│   ├── context/              ← métier, CREALP, données
│   ├── product/              ← brief, PRD, user stories
│   ├── architecture/         ← overview, data model, API, ADRs
│   ├── ui/                   ← design system
│   └── workflow/             ← conventions
├── docker-compose.yml
└── .github/workflows/
```

## Documents de référence (ordre de lecture recommandé)

### Pour comprendre le projet
1. `docs/context/business.md` — CREALP, le poste, le pourquoi
2. `docs/context/domain.md` — hydrologie, Val d'Hérens, glossaire
3. `docs/context/data-sources.md` — OFEV, flux XML, attribution
4. `docs/context/internal-projects.md` — synthèse des rapports d'activité CREALP 2022-2024 (équipe IT, MINERVE, GUARDAVAL, WATERWISE, vocabulaire institutionnel, storytelling)
5. `docs/product/brief.md` — vision produit 1 page
6. `docs/product/prd.md` — exigences fonctionnelles et non-fonctionnelles

### Pour coder
7. `docs/architecture/overview.md` — C4 niveaux 1-2, flux
8. `docs/architecture/data-model.md` — schéma Prisma commenté
9. `docs/architecture/api-contracts.md` — endpoints et DTOs
10. `docs/architecture/adr/` — décisions techniques individuelles
11. `docs/ui/design-system.md` — tokens, composants, a11y
12. `docs/workflow/conventions.md` — nommage, Git, tests

## Références rapides

### Quand je commence à coder…

- Je référence **explicitement** les docs pertinents dans mon prompt (ex: `@docs/ui/design-system.md` section 3.1)
- Je lis le code existant autour avant d'ajouter
- Je vérifie les conventions de nommage dans `docs/workflow/conventions.md`

### Quand je veux ajouter une dépendance…

- Je vérifie qu'elle n'est pas déjà installée
- Je documente la raison dans le commit (`feat(web): add leaflet for map rendering`)
- Si c'est une décision structurante, j'ajoute un ADR

### Quand je modifie le schéma DB…

- Je mets à jour `docs/architecture/data-model.md`
- Je génère une migration Prisma (`prisma migrate dev --name ...`)
- Je mets à jour le seed si nécessaire

### Quand je crée un nouveau composant Vue…

- Je respecte ABEM (`a-`, `m-`, `o-` préfixes)
- Je vérifie les atomes/molécules disponibles avant de créer un nouveau
- Je coche la check-list a11y de `docs/ui/design-system.md` section 5
- J'ajoute un test unitaire si logique non-triviale

### Quand je crée un endpoint API…

- Je documente le contrat dans `docs/architecture/api-contracts.md` (ou je vérifie qu'il l'est déjà)
- Je définis les schémas Zod dans `packages/shared/schemas/`
- Je traverse : route → service → domain → repository (Prisma)
- Je sérialise toujours en DTO explicite (jamais d'entité Prisma brute)

## État courant du sprint

> **À mettre à jour à la fin de chaque session Claude Code.**

**Sprint** : 0 (pré-dev, cadrage)
**Date dernière mise à jour** : 2026-04-18
**Statut** : Documentation initiale du projet terminée.
**Prochaine tâche** : J1 — Initialiser le monorepo (apps/web + apps/api + packages/shared), configurer Docker compose, setup Prisma et première migration `init`.
**Blocages** : aucun

### Historique des sessions

- **2026-04-18** : Génération du context pack (business, domain, data-sources, brief, PRD, architecture overview, data model, API contracts, 6 ADR, design system, conventions).
- **2026-04-18 (v2)** : Ajout de `docs/context/internal-projects.md` (synthèse rapports d'activité CREALP 2022-2024). Enrichissement ciblé de `business.md` (structure équipe IT, chiffres CA, Frédéric Etter).

## Non-goals rappelés

Ne **jamais** implémenter les éléments suivants sans discussion explicite avec l'auteur humain :

- Python ou FastAPI (stack TypeScript uniquement)
- IA / ML / LLM embarqué
- Vue Flow
- Storybook complet (sauf marge fin de sprint)
- Module 3D / photogrammétrie
- Authentification complexe (OAuth, multi-tenant)
- i18n multi-langue
- Microservices

## Contacts et ressources

- Annonce CREALP : https://www.crealp.ch/wp-content/uploads/2026/04/Developpeur-se-FrontEnd_Annonce.pdf
- Contact recrutement : Frédéric Etter — +41 27 607 11 93
- 3DGEOWEB (produit existant à ne pas concurrencer) : https://www.3dgeoweb.crealp.ch
- OFEV données : https://www.hydrodaten.admin.ch
- Swisstopo tuiles : https://wmts.geo.admin.ch
