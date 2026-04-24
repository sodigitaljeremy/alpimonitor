# §7 — Vue de déploiement

Infrastructure, pipeline, et conventions ops. Les trois post-mortems (voir [sous-section dédiée](post-mortems/index.md)) documentent les incidents rencontrés et les garde-fous résultants.

## 7.1 Topologie production

```mermaid
graph TB
    subgraph Internet
        User[Public web]
        Recruiter[Relecteur technique]
        Github[GitHub App<br/>push main]
    end

    subgraph DNS OVH
        DNS[A records :<br/>alpimonitor.fr<br/>api.alpimonitor.fr<br/>storybook.alpimonitor.fr<br/>docs.alpimonitor.fr]
    end

    subgraph VPS Hetzner — 95.216.196.69
        Traefik[Traefik<br/>TLS Let's Encrypt<br/>reverse proxy]
        Coolify[Coolify v4<br/>orchestrator]

        subgraph alpimonitor-prod
            Web[nginx:1.27-alpine<br/>SPA static<br/>6 headers sécurité]
            API[node:20-alpine<br/>Fastify + cron ingestion]
            DB[(postgres:16-alpine<br/>alpimonitor-pgdata)]
        end

        subgraph alpimonitor-storybook
            SB[nginx:1.27-alpine<br/>Storybook static]
        end
    end

    subgraph External
        LetsEncrypt[Let's Encrypt<br/>ACME HTTP-01]
        LINDAS[LINDAS SPARQL<br/>OFEV/BAFU]
        OSM[OpenStreetMap tiles]
    end

    User & Recruiter --> DNS
    DNS --> Traefik
    Traefik -->|alpimonitor.fr| Web
    Traefik -->|api.alpimonitor.fr| API
    Traefik -->|storybook.alpimonitor.fr| SB
    API <-->|Prisma| DB
    API -->|cron 10 min SPARQL| LINDAS
    Web -->|tiles HTTPS| OSM
    Traefik <-->|ACME challenge| LetsEncrypt
    Github -->|webhook| Coolify
    Coolify -->|build + deploy| Web
    Coolify -->|build + deploy| API
    Coolify -->|build + deploy| SB
```

Quatre sous-domaines servis par une seule instance Traefik gérée par Coolify. Deux « ressources » Coolify distinctes : `alpimonitor-prod` (web + api + postgres, orchestrés par `docker-compose.prod.yml`) et `alpimonitor-storybook` (container statique indépendant). La ressource `docs.alpimonitor.fr` sera ajoutée en Phase 4 de cette documentation.

## 7.2 Fichiers impliqués

- **`apps/api/Dockerfile`** — image runtime multi-stage. `node:20-alpine` base, user non-root `app`, tini PID 1, `prisma migrate deploy` au démarrage via `entrypoint.sh`. Pre-création + chown de `/app/var/lindas-archive` avant `USER app` (cf. [post-mortem EACCES](post-mortems/2026-04-22-eacces.md)).
- **`apps/api/entrypoint.sh`** — orchestre `prisma migrate deploy` → `prisma db seed` (conditionnel `SEED_ON_BOOT`) → `exec node dist/index.js`. `set -eu`, `PATH="/app/node_modules/.bin:$PATH"` pour `tsx`.
- **`apps/web/Dockerfile`** — build Vite (stage `build`) puis service statique via `nginx:1.27-alpine` (stage `runtime`). SPA fallback, cache assets hashés immutable, gzip actif.
- **`apps/web/nginx.conf`** — vhost principal, include `nginx-security-headers.conf`.
- **`apps/web/nginx-security-headers.conf`** — 6 headers HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Cross-Origin-Opener-Policy.
- **`apps/web/Dockerfile.storybook`** + **`apps/web/nginx-storybook.conf`** + **`apps/web/nginx-storybook-security-headers.conf`** — variantes pour le sous-domaine Storybook, CSP assouplie (`frame-ancestors 'self'` + `script-src 'unsafe-eval'` — cf. [ADR-009 §Déploiement](../09-architectural-decisions/adr-009.md)).
- **`docker-compose.prod.yml`** — regroupe `postgres` + `api` + `web` en une seule ressource Coolify. **Pas de réseau custom** (cf. [post-mortem Traefik](post-mortems/2026-04-22-traefik.md)) — Compose crée `<project>_default` auto-utilisé par Traefik.
- **`.env.production.example`** — variables à renseigner dans le panneau Coolify : `DATABASE_URL`, `CORS_ORIGINS`, `VITE_API_BASE_URL`, `POSTGRES_*`, `SEED_ON_BOOT`, `INGESTION_*`.

## 7.3 Pipeline de déploiement

1. Développeur push sur la branche `main` (ou merge d'une PR).
2. GitHub App `sodigitaljeremy` émet un webhook HTTPS vers Coolify.
3. Coolify clone le repo sur le VPS, exécute `docker compose build` avec les Dockerfiles correspondants.
4. Au succès, Coolify stoppe les anciens containers, démarre les nouveaux, et swap Traefik vers les nouvelles instances (zero-downtime swap la plupart du temps).
5. `/api/v1/health` et le static `/` servis 200 ⇒ le deploy est considéré comme OK.

Aucune gate CI-pre-merge aujourd'hui — la CI GitHub Actions tourne **informativement** sur push et PR, mais le merge sur `main` n'est pas bloqué par un échec CI. C'est une dette assumée pour la démo ; la CI reste une référence factuelle.

Rollback : via le panneau Coolify, re-deploy de l'image précédente. Alternative git : `git revert <sha>` + push.

## 7.4 Sous-domaines

- **`alpimonitor.fr`** — SPA Vue (nginx static) + redirection `www.alpimonitor.fr`. TLS Let's Encrypt géré par Traefik.
- **`api.alpimonitor.fr`** — API Fastify. CORS allowlist `alpimonitor.fr` + `www.alpimonitor.fr` + origines dev (env `CORS_ORIGINS`).
- **`storybook.alpimonitor.fr`** — catalogue design system statique (cf. [ADR-009](../09-architectural-decisions/adr-009.md)).
- **`docs.alpimonitor.fr`** — documentation arc42 (ce site). Phase 4 de la roadmap docs — Dockerfile + nginx vhost à créer.

DNS OVH : 4 records A pointant vers `95.216.196.69`. Propagés 2026-04-20, TTL standard.

## 7.5 Stratégie sécurité

- **6 headers nginx** servis par le vhost SPA : HSTS (`max-age=31536000; includeSubDomains`), CSP, X-Frame-Options `DENY`, X-Content-Type-Options `nosniff`, Referrer-Policy `strict-origin-when-cross-origin`, Cross-Origin-Opener-Policy `same-origin`. Audit axe-core informel + Puppeteer smoke validés ([§10 audit](../10-risks-and-debt/index.md)).
- **CORS allowlist côté API** — aucune étoile, chaque origine whitelistée explicitement.
- **Container non-root** — user `app` (uid/gid 1001) dans les images API et web. Volume `/app/var` pre-créé + chowné dans le Dockerfile (lesson post-mortem EACCES).
- **Secrets via env uniquement** — `.env.production` n'est jamais commité, les valeurs vivent dans le panneau Coolify. `.env.production.example` documente la liste.
- **Zod systématique** — validation runtime sur tous les endpoints. Un payload malformé → 400 avec `VALIDATION_ERROR`, pas de crash serveur.
- **Non-wired en v1 (reportés prod réelle)** : Helmet (headers côté API), `@fastify/rate-limit`, auth JWT + bcrypt. Read-only public acceptable pour démo.

## 7.6 Observabilité

- **Logs** — Pino JSON stdout, captés par Coolify. Agrégation Loki/Datadog reportée v2.
- **Healthcheck** — `/api/v1/health` consommé par Coolify + Traefik. Retourne 503 si DB down.
- **Status** — `/api/v1/status` expose `IngestionRun.lastRun`, `lastSuccessAt`, compteurs journée. Badge UI `MStatusBadge` dans `OHeroSection` fait le polling 60 s.
- **Pas d'APM, pas de tracing distribué** — hors scope v1.
