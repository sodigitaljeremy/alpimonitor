# Incident 2026-06-04 — déploiement Coolify échoué sur une course transitoire au recreate

**Status:** Resolved
**Severity:** Minor · bref downtime prod (~6 min) pendant le déploiement de la couche IA (A+D)
**Duration:** ~6 min — premier `docker compose up` en échec à 17:10:57 UTC, prod restaurée par un Redeploy à 17:17:04 UTC
**Authors:** Jérémy Soriano (human) + Claude Code (pair)

## TL;DR

Le merge de la PR #1 (couche IA A+D, commit `d0fa304`) a déclenché l'auto-deploy Coolify. Le build a réussi ; **le `docker compose up -d` runtime a échoué (exit 255)** juste après *« Removing old containers »*, au moment où le conteneur `postgres` passait à `Starting`. Coolify ayant déjà supprimé les anciens conteneurs avant de démarrer les nouveaux (recreate **non-atomique**), la prod s'est retrouvée **sans backend → Traefik 503 « no available server »** sur `api.alpimonitor.fr` et `alpimonitor.fr`. Un **simple Redeploy de la même révision** (`d0fa304`, aucune modification) a réussi du premier coup : postgres `Healthy`, api/web `Started`. La cause est une **course transitoire au recreate**, pas le code ni la config (le build était passé, `docker compose config` parse sans erreur, les migrations sont additives).

## Contexte

Déploiement de dérisquage A+D : merge `feat/ai-layer` → `main` en merge commit, après CI verte sur la PR et secret `MISTRAL_API_KEY` posé côté Coolify. Le seul changement d'infra de ce déploiement était le mapping `MISTRAL_API_KEY` / `MISTRAL_MODEL` dans `docker-compose.prod.yml` (validé `config` OK) — sans rapport avec le conteneur `postgres` qui a échoué à démarrer.

## Timeline (UTC, 2026-06-04)

| Quand | Événement |
|---|---|
| 17:09:44 | Merge PR #1 → `main` (`d0fa304`). Auto-deploy Coolify lancé. |
| 17:10:55 | Build OK → « Removing old containers » → « Starting new application ». |
| 17:10:57 | Conteneurs `Created`, `postgres … Starting`, puis `docker compose up -d` **exit 255**. Déploiement marqué *Failed*. |
| ~17:11 | Prod **DOWN** : `/health` et web → **503 « no available server »** (Traefik sans backend). |
| 17:11 | Diagnostic : `docker compose -f docker-compose.prod.yml config` **parse OK** en local → écarte une erreur de syntaxe/compose ; échec localisé au **runtime `up`**, pas au build ni au code. |
| 17:15:49 | **Redeploy** Coolify de la même révision `d0fa304` (aucun changement). |
| 17:17:04 | postgres `Healthy`, api/web `Started`. Prod **restaurée**. |
| ~17:18 | Vérif post-deploy verte : `/health` ok, `/status` (compteurs created/unchanged), `/ai/status` 200, narration réelle sur station LIVE, badge IA présent dans le bundle. Tag `v1.2.0-ai` posé. |

## Cause racine

**Course transitoire au recreate Coolify.** Coolify déploie en *recreate* : il supprime les anciens conteneurs puis lance `docker compose up -d` pour les nouveaux. Quand ce `up` échoue de manière transitoire (résidu de conteneur/réseau en cours de libération, timing du daemon Docker), il sort en 255 alors que les anciens sont déjà partis → fenêtre de downtime. Le caractère **transitoire** est confirmé par le fait qu'un Redeploy **identique**, sans aucune modification, réussit.

Ce qui a été **écarté** comme cause : le build (réussi), le code applicatif (inchangé entre l'échec et le succès), la syntaxe compose (`config` OK), les migrations (additives, et appliquées sans souci au boot réussi).

## Procédure — la prochaine fois

1. **Ne pas paniquer ni reverter immédiatement** : si le build a réussi et que l'échec est au `up -d` (conteneurs `Created` puis exit 255), suspecter en premier une **course transitoire**.
2. **Confirmer que ce n'est pas le code/compose** : `docker compose -f docker-compose.prod.yml config` en local (parse) ; vérifier que le build Coolify est allé jusqu'à « Starting new application ».
3. **Relancer un Redeploy de la même révision** (bouton Coolify) — résout la majorité des courses au recreate.
4. **Si l'échec persiste à l'identique** : `ssh root@95.216.196.69` puis `docker ps -a` + `docker logs <conteneur>` pour la **vraie** ligne d'erreur `compose up` (le log Coolify tronque la cause après l'exit 255). Seulement alors, fix-forward ou revert.
5. **Revert (`git revert -m 1 <merge>`)** = repli ultime, à réserver aux causes **code/config** confirmées — inutile contre une course infra.

## Dette / suivi

- **Recreate non-atomique = bref downtime possible à CHAQUE déploiement.** Le modèle de déploiement Coolify actuel supprime l'ancien stack avant que le nouveau soit prêt ; tout échec (même transitoire) du `up` laisse la prod sans backend jusqu'au prochain essai réussi. Acceptable pour un site de démonstration candidature, **à revoir pour une vraie prod** : déploiement *rolling* / health-gated (ne basculer Traefik qu'une fois le nouveau conteneur `Healthy`), ou stratégie blue-green. Hors scope candidature.
- **Log Coolify tronqué** : la cause réelle de l'exit 255 n'apparaît pas dans le log UI. Pour un diagnostic fiable, prévoir l'accès SSH dès le premier échec persistant.
- Pas d'alerte automatique sur le 503 — la détection a reposé sur la surveillance manuelle du déploiement. Acceptable au stade actuel.
