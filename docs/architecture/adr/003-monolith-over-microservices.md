# ADR-003 — Monolithe Fastify plutôt que microservices

**Date** : 2026-04-18
**Statut** : Acceptée — implémentée
**Implémentation** : `10609b9` (plugin `ingestion` intégré au serveur Fastify, tick wrappé dans try/catch, skip d'overlap, désactivable par `INGESTION_ENABLED=false` pour les tests). Monolithe vérifié par `apps/api/src/index.ts` + `apps/api/src/plugins/ingestion.ts`, déployé en un seul service Coolify (`alpimonitor-prod` / service `api`).

## Contexte

Le backend AlpiMonitor doit :
1. Exposer une API REST (endpoints publics + admin)
2. Ingérer périodiquement un flux XML OFEV
3. Détecter anomalies et déclencher alertes

Ces responsabilités pourraient être séparées dans des services distincts (API + worker d'ingestion) ou regroupées dans un monolithe.

## Décision

On déploie **un seul service Fastify** qui porte à la fois les routes HTTP et le scheduler d'ingestion (via plugin et `node-cron` ou équivalent natif Fastify).

## Conséquences

### Positives

- **Simplicité de déploiement** : un seul container à build, pousser et surveiller sur Coolify
- **Pas d'overhead inter-service** : pas de queue, pas d'API interne, pas de sérialisation réseau
- **Partage de code trivial** : services, entités, utils directement accessibles
- **Charge ridicule** : ~144 fetch/jour, un monolithe les gère sans s'en apercevoir
- **YAGNI respecté** : on ne sépare que si un besoin concret se manifeste

### Négatives

- **Couplage runtime** : un bug dans l'ingestion peut impacter l'API (mitigation : le scheduler tourne dans une Promise catch-all, isolé du service HTTP)
- **Scaling horizontal limité** : si on voulait N instances de l'API pour encaisser du trafic, le cron devrait se dédupliquer (mitigation : hors scope v1, si un jour nécessaire on ajoutera un lock Postgres ou on extrait le worker)
- **Moins démonstratif "à l'ère des microservices"** (mitigation : un README clair expliquant le choix pragmatique vaut mieux qu'une archi sur-ingénierie)

## Mitigation du couplage runtime

Le scheduler d'ingestion sera isolé dans `src/plugins/ingestion.ts` avec :
- Chaque tick enveloppé dans un `try/catch` global
- Aucune exception ne peut sortir et crasher le process HTTP
- Logs structurés sur échec
- Si un tick prend plus longtemps que l'intervalle, on skip le suivant (pas d'overlap)

## Alternatives écartées

### Worker séparé (2 containers : `api` + `ingestion`)

Écartée en v1. Ajoute un docker-compose service, une coordination pour ne pas dupliquer les fetches, et un déploiement plus complexe. Bénéfice marginal à notre échelle.

### Serverless (AWS Lambda + EventBridge)

Écartée. Hors scope VPS + Coolify choisi par le candidat pour démontrer la maîtrise de l'infrastructure auto-hébergée.

### File de messages (Redis + BullMQ)

Écartée. Overkill pour ~144 jobs/jour simples et séquentiels.

## Revoir cette décision si…

- Volume de mesures x100 (monitoring temps-réel de centaines de stations)
- Besoin de redéployer l'API sans couper l'ingestion
- Besoin de scaling horizontal de l'API pour encaisser du pic de trafic
