# ADR-004 — Prisma comme ORM

**Date** : 2026-04-18
**Statut** : Acceptée

## Contexte

Le backend a besoin d'un accès typé à PostgreSQL. Plusieurs options :
- Prisma (ORM + schéma déclaratif + migrations)
- Drizzle (ORM SQL-first, plus léger, typé)
- Kysely (query builder typé, pas d'ORM)
- TypeORM (ancien, moins utilisé aujourd'hui)
- SQL brut via `pg` + types à la main

## Décision

On utilise **Prisma 5** comme ORM et générateur de migrations.

## Conséquences

### Positives

- **Schéma déclaratif unique** (`schema.prisma`) qui sert de source de vérité et génère automatiquement le client typé
- **Migrations gérées** (`prisma migrate`), avec un workflow clair (dev, deploy)
- **Types TypeScript générés** : zéro drift entre DB et code
- **Prisma Studio** : interface graphique pour explorer la DB en dev
- **Maturité** : c'est le choix par défaut de l'écosystème Node/TS en 2025-2026
- **Sécurité** : toutes les requêtes sont paramétrées, pas de SQL injection possible via l'API Prisma

### Négatives

- **Overhead vs query builder** : Prisma Client est plus lourd au runtime que Kysely
- **Contrôle SQL limité** sur les requêtes complexes (mitigation : `prisma.$queryRaw` disponible pour les cas spéciaux)
- **Dépendance forte** : migration vers un autre ORM serait un chantier

## Conventions d'usage

- Une seule instance Prisma Client (singleton) exposée via un plugin Fastify
- Pas d'accès direct à Prisma depuis les routes — toujours via un service dans `src/services/`
- Les entités Prisma ne sortent jamais vers le client HTTP — mapping DTO explicite
- Les migrations sont commitées et versionnées (`prisma/migrations/`)
- Pas de `prisma db push` en dev — toujours `migrate dev` pour garder l'historique

## Alternatives écartées

### Drizzle

Sérieusement envisagé. Plus léger, syntaxe SQL-first appréciable. Écartée parce que :
- L'écosystème Prisma est plus mature pour les besoins classiques
- Pas de valeur ajoutée démontrable à Drizzle pour ce projet précis
- Risque de bug subtil sur le petit reste de documentation vs. la mine d'info Prisma

### SQL brut + types manuels

Écartée. Démonstration faible de structure, risque d'incohérence, temps perdu à maintenir des types.
