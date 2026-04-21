# ---------- Build stage ----------
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Workspace manifests first for layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Vite replaces import.meta.env.VITE_* at build time, so the API base URL
# must be provided as a build arg and exported into the env before `vite build`.
ARG VITE_API_BASE_URL=http://localhost:3000/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm --filter @alpimonitor/web build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

# nginx base image already defines a proper CMD and signal handling.
