# §1 — Introduction et objectifs

## 1.1 Aperçu

**AlpiMonitor** est un tableau de bord hydrologique du bassin de la Borgne (Valais, Suisse), affluent rive gauche du Rhône drainant le Val d'Hérens. L'application rend visibles en quasi temps-réel les débits et niveaux d'eau de 7 stations — 4 fédérales BAFU ingérées depuis [LINDAS SPARQL](../03-context-and-scope/data-sources.md) et 3 stations du réseau cantonal CREALP sur la Borgne, marquées selon leur sourcing ([ADR-008](../09-architectural-decisions/adr-008.md)).

Le projet est un **livrable de démonstration technique** développé depuis le 2026-04-20 pour une candidature au poste de Développeur·se Front-End au [CREALP](https://www.crealp.ch) (Centre de recherche sur l'environnement alpin, Sion). Ce n'est pas un produit commercial et ne concurrence aucune plateforme existante — notamment pas [3DGEOWEB](https://www.3dgeoweb.crealp.ch) qui relève du cœur de produit photogrammétrique CREALP.

La prod tourne sur `alpimonitor.fr` (SPA) + `api.alpimonitor.fr` (API) + `storybook.alpimonitor.fr` (design system), auto-deploy sur push `main` via Coolify sur VPS Hetzner.

## 1.2 Objectifs

| # | Objectif | Critère vérifiable |
|---|----------|---------------------|
| G1 | **Démontrer la maîtrise du stack demandé** (Vue 3 + Vite + TypeScript + Tailwind + Fastify + tests) | 173 tests verts en CI, CI GitHub Actions verte sur push `main`, code TS strict sans `any` implicite |
| G2 | **Comprendre et restituer le domaine métier** hydrologique du Valais | Vocabulaire fidèle ([§10 glossaire](../10-risks-and-debt/glossary.md)), distinction LIVE/RESEARCH respectant le partage OFEV/CREALP, sourcing factuel tracé ([ADR-008](../09-architectural-decisions/adr-008.md)) |
| G3 | **Appliquer des bonnes pratiques défendables en entretien** | Atomic Design ABEM ([ADR-002](../09-architectural-decisions/adr-002.md)), façades feature-grouped sur Pinia ([ADR-010](../09-architectural-decisions/adr-010.md)), 10 ADR documentant chaque décision structurante |
| G4 | **Livrer bout en bout** | URL HTTPS publique, auto-deploy Coolify, 3 post-mortems incident ([§7](../07-deployment-view/post-mortems/index.md)), Lighthouse Desktop 96/100/100/100 |

La priorité est la **densité d'impression en moins de 30 s** pour un relecteur technique senior, pas l'exhaustivité fonctionnelle. C'est pourquoi le livrable est intentionnellement une **single-page scrollable** sans comparateur multi-stations, sans admin, sans auth — voir [§10 §Non-scope candidature](../10-risks-and-debt/index.md).

## 1.3 Parties prenantes

**Recruteur technique** (équipe IT CREALP) — vérifie la maîtrise du stack, la rigueur architecturale, la capacité à défendre chaque décision. Lecture du README + survol des ADR + 5 min sur le code suffisent à se forger une opinion.

**Recruteur métier** (CREALP) — reconnaît son vocabulaire (Borgne, MINERVE, GUARDAVAL, hydrologie alpine) et le positionnement non-concurrent vis-à-vis de 3DGEOWEB. La landing page identifie le territoire et les acteurs en moins de 30 s.

**Candidat (auteur)** — doit pouvoir défendre chaque ligne en entretien sans hésiter. Code, commits, et ADR racontent une histoire cohérente et vérifiable.

**Ops futur(e)** — reprend le deploy sans onboarding long. README §Déploiement + [§7 Vue de déploiement](../07-deployment-view/index.md) + 3 post-mortems fournissent tout.

**Curieux / public informé** — comprend le débit de son cours d'eau dans son contexte (captages Grande Dixence, glaciers Ferpècle). Page accessible, lecture possible sans connaissance préalable.

Les deux premières parties prenantes — recruteurs — définissent les critères qualité ([§2](../02-constraints-and-quality/index.md)). Les trois suivantes héritent du livrable sans influencer directement son scope.

## 1.4 Positionnement CREALP (contexte institutionnel)

CREALP opère trois produits internes qui cadrent le non-scope d'AlpiMonitor :

- **MINERVE** — modèle de prévision des crues hydrologiques du Rhône, opéré 24/7 par CREALP pour le Service cantonal des Dangers Naturels. AlpiMonitor **ne reproduit pas** MINERVE — il est un outil léger de consultation, pas un moteur de prévision.
- **GUARDAVAL** — plateforme de publication interne des résultats MINERVE pour les autorités cantonales. AlpiMonitor peut se lire comme une **démonstration grand-public** de ce genre de plateforme, à échelle réduite (un sous-bassin, données BAFU, pas de prévision).
- **3DGEOWEB** — base photogrammétrique publique CREALP (drones BVLOS + avions légers). AlpiMonitor **n'empiète pas** sur ce territoire — zéro 3D, zéro photogrammétrie, uniquement données tabulaires et séries temporelles.

Ce positionnement complémentaire est revendiqué dans la page d'accueil (`OResearchZonesSection`, `OWhyLindasSection`) et ancré dans [ADR-007](../09-architectural-decisions/adr-007.md) (pivot LINDAS) et [ADR-008](../09-architectural-decisions/adr-008.md) (sourcing transparency).
