# ADR-001 — Stack TypeScript unique

**Date** : 2026-04-18
**Statut** : Acceptée — implémentée
**Implémentation** : `5f3593b` (monorepo pnpm init), `e9a35e1` (Prisma + Fastify), confirmé par l'ensemble de la codebase.

## Contexte

AlpiMonitor doit démontrer les compétences requises pour le poste Front-End CREALP en 13 jours, avec un budget cognitif et temporel serré. Plusieurs stacks étaient envisageables :

- Mono-stack TypeScript (Vue 3 + Fastify + Prisma)
- Stack mixte TypeScript + Python/FastAPI pour volets IA/ML
- Stack mixte TypeScript + Go pour perf backend

## Décision

On part sur une **stack TypeScript unique** : Vue 3 côté front, Fastify côté back, Prisma côté ORM, Zod pour la validation partagée.

## Conséquences

### Positives

- **Partage de types** entre front et back via `packages/shared`, zéro drift
- **Courbe d'apprentissage réduite** : un seul runtime, un seul package manager, un seul écosystème de tests
- **Alignement strict avec l'annonce** : Vue/Vite/TS/Fastify explicitement mentionnés, aucune mention de Python/Go
- **Simplicité de déploiement** : un seul container backend, pas d'inter-service
- **Focus front-end** : le poste est front-end, la démonstration doit être majoritairement front

### Négatives

- **Pas de démonstration de polyglossie** : si CREALP valorise la pluralité de langages, on ne la montre pas ici
- **Pas de ML natif** : Node est moins à l'aise pour du ML sérieux. Mitigation : détection d'anomalies statistiques simple (écart-type sur moyenne mobile) qui ne nécessite aucune lib ML

## Alternatives écartées

### Ajouter Python/FastAPI pour un volet IA

Écartée. Le poste est front-end, pas ML. Ajouter un microservice Python aurait consommé 3-4 jours sur un sprint de 13. Les recruteurs techniques pourraient perçoir cet ajout comme une dispersion plutôt que comme un différenciant. Le positionnement "AI-driven engineer" du candidat se démontre par l'usage de Claude Code pendant le dev, pas par un modèle ML embarqué.

### Node + Go pour le backend

Écartée. Aucun bénéfice perf à cette échelle (quelques milliers de mesures/jour). Go n'est pas mentionné dans l'annonce.
