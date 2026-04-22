#!/usr/bin/env node
/**
 * Dev-local screenshot capture for the README.
 *
 * Runs against production (https://alpimonitor.fr) so the captures show real
 * live LINDAS data, not seed-only fixtures. Re-run after visual changes:
 *
 *     node scripts/screenshots.mjs
 *
 * Outputs:
 *   - docs/screenshots/01-hero.png  — Hero section, viewport crop at 1440x900
 *   - docs/screenshots/02-map.png   — Map section after Leaflet tiles settle
 *
 * Puppeteer is declared as a root devDependency. This script is not part of
 * CI and is not invoked by any build step — it's a manual reproducibility tool.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const TARGET_URL = 'https://alpimonitor.fr/';
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 2000;

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'docs', 'screenshots');

async function waitForLeafletTiles(page) {
  await page.waitForSelector('.leaflet-tile-loaded', { timeout: 30_000 });
  await new Promise((r) => setTimeout(r, SETTLE_MS));
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: VIEWPORT,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 60_000 });

    await page.waitForSelector('.o-hero-section', { timeout: 10_000 });
    await new Promise((r) => setTimeout(r, SETTLE_MS));

    const heroPath = resolve(outDir, '01-hero.png');
    await page.screenshot({ path: heroPath, fullPage: false });
    console.log(`✓ Hero  → ${heroPath}`);

    await page.evaluate(() => {
      document.querySelector('#map')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await waitForLeafletTiles(page);

    const mapPath = resolve(outDir, '02-map.png');
    await page.screenshot({ path: mapPath, fullPage: false });
    console.log(`✓ Map   → ${mapPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
