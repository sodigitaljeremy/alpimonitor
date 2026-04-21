import { resolve } from 'node:path';

import fp from 'fastify-plugin';
import cron from 'node-cron';

import { createFsArchive } from '../ingestion/archive.js';
import { runLindasIngestion } from '../ingestion/lindas-ingestion.js';

// One immediate pass at boot, then every 10 minutes. The boot fetch is
// wrapped in try/catch so a LINDAS outage never prevents the API from
// starting — the next tick retries.
const DEFAULT_SCHEDULE = '*/10 * * * *';

// 30-day retention on the archive. Pruning runs once a day at 03:17 UTC
// (quiet hour, offset to avoid colliding with other periodic jobs).
const PRUNE_SCHEDULE = '17 3 * * *';
const RETENTION_MS = 30 * 24 * 3600 * 1000;

export const ingestionPlugin = fp(
  async (app) => {
    const enabled = process.env.INGESTION_ENABLED !== 'false';
    const schedule = process.env.INGESTION_SCHEDULE ?? DEFAULT_SCHEDULE;
    const archiveRoot = resolve(process.env.LINDAS_ARCHIVE_DIR ?? '/app/var/lindas-archive');

    if (!enabled) {
      app.log.info({ reason: 'INGESTION_ENABLED=false' }, 'ingestion plugin disabled');
      return;
    }

    if (!cron.validate(schedule)) {
      app.log.error({ schedule }, 'invalid INGESTION_SCHEDULE — ingestion disabled');
      return;
    }

    const archive = createFsArchive(archiveRoot);

    const tick = async (): Promise<void> => {
      try {
        await runLindasIngestion({
          prisma: app.prisma,
          archive,
          logger: app.log,
        });
      } catch (err) {
        // runLindasIngestion catches its own errors and always resolves —
        // this is defence in depth for truly unexpected throws.
        app.log.error({ err }, 'ingestion tick threw unexpectedly');
      }
    };

    // Fire-and-forget boot fetch. Awaiting would delay /health readiness
    // (LINDAS sometimes takes a few seconds) and could block boot under
    // network partition.
    void tick();

    const task = cron.schedule(schedule, () => {
      void tick();
    });

    const pruneTask = cron.schedule(PRUNE_SCHEDULE, () => {
      void archive
        .prune(RETENTION_MS)
        .then((removed) => {
          if (removed > 0) {
            app.log.info({ removed }, 'lindas-archive: pruned old day folders');
          }
        })
        .catch((err: unknown) => {
          app.log.warn({ err }, 'lindas-archive: prune failed');
        });
    });

    app.log.info({ schedule, archiveRoot }, 'ingestion plugin armed');

    app.addHook('onClose', async () => {
      task.stop();
      pruneTask.stop();
    });
  },
  { name: 'ingestion', dependencies: ['prisma'] }
);
