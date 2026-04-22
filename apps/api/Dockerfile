# ---------- Build stage ----------
FROM node:20-alpine AS build

# libssl3 + openssl: required by the Prisma query engine on alpine.
RUN apk add --no-cache libssl3 openssl \
  && corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Workspace manifests first — maximises layer cache on source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Source trees needed for the api build (web is not required here).
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Compile TypeScript → apps/api/dist/.
RUN pnpm --filter @alpimonitor/api build

# Produce a standalone, prod-only, flattened node_modules for the api package.
# --legacy is required under pnpm v10 when workspace packages are not injected
# (see ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE). It resolves workspace deps
# (@alpimonitor/shared) into real directories inside /prod/api/node_modules.
RUN pnpm --filter @alpimonitor/api deploy --prod --legacy /prod/api

# Generate Prisma Client against the *deployed* node_modules. pnpm deploy
# creates a fresh tree from the package store, so a generate done earlier in
# the build-stage node_modules would be lost. Running it here writes the
# engine + generated client into /prod/api/node_modules, which is what the
# runtime stage copies.
RUN cp -r apps/api/prisma /prod/api/prisma \
  && cd /prod/api && node_modules/.bin/prisma generate

# ---------- Runtime stage ----------
FROM node:20-alpine AS runtime

# tini for proper PID 1 / signal handling.
RUN apk add --no-cache libssl3 openssl tini

# Run as non-root.
RUN addgroup -S app && adduser -S -G app app

WORKDIR /app

COPY --from=build --chown=app:app /prod/api/node_modules ./node_modules
COPY --from=build --chown=app:app /app/apps/api/dist ./dist
COPY --from=build --chown=app:app /app/apps/api/prisma ./prisma
COPY --from=build --chown=app:app /app/apps/api/package.json ./package.json
COPY --chown=app:app --chmod=0755 apps/api/entrypoint.sh /app/entrypoint.sh

# Pre-create the archive root with app ownership so the named volume
# inherits the right perms on first mount (Docker copies image content
# into an EMPTY new volume, preserving ownership). Cf.
# docs/runbooks/incident-2026-04-22-archive-eacces.md.
RUN mkdir -p /app/var/lindas-archive && chown -R app:app /app/var

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

USER app

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
# entrypoint.sh runs `prisma migrate deploy` (mandatory) and, when
# SEED_ON_BOOT=true, `prisma db seed` (idempotent, non-fatal on failure).
CMD ["/app/entrypoint.sh"]
