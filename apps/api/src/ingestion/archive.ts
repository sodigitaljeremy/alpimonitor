// Filesystem archive of raw LINDAS SPARQL payloads. One gzipped file per
// successful fetch, keyed by timestamp + hash. Retention: 30 days.
//
// Path layout: <root>/YYYY-MM-DD/<ISO>-<hash12>.json.gz
// The daily folder makes `rm` / retention cheap and keeps ls manageable.

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);

export interface ArchiveWriter {
  write(body: string, hash: string, timestamp: Date): Promise<string>;
  prune(olderThanMs: number, now?: Date): Promise<number>;
}

export function createFsArchive(root: string): ArchiveWriter {
  return {
    async write(body, hash, timestamp) {
      const day = timestamp.toISOString().slice(0, 10);
      const dayDir = join(root, day);
      await mkdir(dayDir, { recursive: true });
      const fileName = `${timestamp.toISOString().replace(/[:.]/g, '-')}-${hash.slice(0, 12)}.json.gz`;
      const filePath = join(dayDir, fileName);
      const compressed = await gzipAsync(body);
      await writeFile(filePath, compressed);
      return filePath;
    },

    async prune(olderThanMs, now = new Date()) {
      let removed = 0;
      let entries: string[];
      try {
        entries = await readdir(root);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 0;
        throw err;
      }
      const cutoff = now.getTime() - olderThanMs;
      for (const entry of entries) {
        // Day folders are named YYYY-MM-DD — anything else is ignored.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(entry)) continue;
        const day = new Date(`${entry}T00:00:00Z`);
        if (day.getTime() < cutoff) {
          await rm(join(root, entry), { recursive: true, force: true });
          removed++;
        }
      }
      return removed;
    },
  };
}

export function ensureDirSync(path: string): Promise<void> {
  return mkdir(dirname(path), { recursive: true }).then(() => undefined);
}
