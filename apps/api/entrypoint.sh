#!/bin/sh
# Boot sequence for the AlpiMonitor API container.
#
#   1. `prisma migrate deploy` — mandatory. If migrations fail we crash
#      hard: starting the app against a stale schema would be worse.
#   2. `prisma db seed` — opt-in via SEED_ON_BOOT=true. Tolerant to failure:
#      a broken seed should not take the API offline (we'd rather serve
#      /health and let ops investigate than 503 the whole stack). The seed
#      is idempotent (see apps/api/prisma/seed.ts), so running it on every
#      boot is safe.
#   3. `exec node dist/index.js` — replaces the shell so tini (PID 1)
#      forwards signals directly to the Node process.
#
# Introduced after the 2026-04-21 incident (prod DB found empty with no
# trace of a wipe in my own tool history — root cause undetermined).
# Keeping this idempotent boot-seed closes the blast radius regardless of
# future external data loss.

set -eu

# `prisma db seed` reads package.json#prisma.seed (here: `tsx prisma/seed.ts`)
# and spawns it by name, relying on PATH. We add the workspace bin dir so
# tools installed as local deps (tsx, prisma) resolve without pnpm.
export PATH="/app/node_modules/.bin:$PATH"

echo "[boot] Applying pending migrations"
prisma migrate deploy

if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  echo "[boot] SEED_ON_BOOT=true — running idempotent seed"
  if ! prisma db seed; then
    echo "[boot] WARN: seed failed, continuing startup (see logs above)" >&2
  fi
else
  echo "[boot] SEED_ON_BOOT not set to 'true' — skipping seed"
fi

echo "[boot] Starting API"
exec node dist/index.js
