// Runs the site panel in a real browser with the built extension and writes what was observed.
// Usage: CHROMIUM_PATH=/path/to/chrome node scripts/run-panel.mjs [outDir] [idFilter]
// Each site gets a fresh profile, one visit without the extension (to see whether a banner is
// offered to this visitor at all) and one visit plus one reload with it. Nothing is clicked by the script.
import { chromium } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EXTENSION = resolve('.output/chrome-mv3');
const EXECUTABLE = process.env.CHROMIUM_PATH;
const outDir = resolve(process.argv[2] ?? 'panel-out');
const filter = process.argv[3];
const panel = JSON.parse(readFileSync('tests/platforms/panel.json', 'utf8'));
const SETTLED = new Set(['verified', 'partial', 'failed', 'inconclusive', 'unsupported', 'skipped']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(outDir, { recursive: true });

async function open(withExtension) {
  const profile = mkdtempSync(join(tmpdir(), 'pievra-panel-'));
  const args = ['--no-sandbox', '--headless=new', '--lang=en-GB'];
  if (withExtension) args.push(`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`);
  const context = await chromium.launchPersistentContext(profile, {
    ...(EXECUTABLE ? { executablePath: EXECUTABLE } : { channel: 'chromium' }),
    headless: true,
    args,
    viewport: { width: 1366, height: 850 },
    locale: 'en-GB',
  });
  return { context, profile };
}

async function visit(context, url) {
  const page = await context.newPage();
  let httpStatus = null;
  let error = null;
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    httpStatus = response?.status() ?? null;
  } catch (e) {
    error = String(e.message ?? e).split('\n')[0];
  }
  return { page, httpStatus, error };
}

async function siteRecords(storePage) {
  const all = await storePage.evaluate(() => chrome.storage.local.get(null));
  return Object.entries(all)
    .filter(([key]) => key.startsWith('site:'))
    .map(([, value]) => value);
}

const pick = (record) =>
  record && {
    domain: record.domain,
    status: record.status,
    cmp: record.cmp ?? null,
    evidence: record.evidenceSummary ?? [],
    unfulfilled: record.unfulfilled ?? [],
    audit: record.audit ? record.audit.checks.map((c) => ({ check: c.check, outcome: c.outcome, count: c.count ?? c.services?.length ?? null })) : null,
  };

async function runSite(site) {
  const result = { ...site, ranAt: new Date().toISOString() };

  // 1. Without the extension: is a banner offered to this visitor?
  const plain = await open(false);
  try {
    const { page, httpStatus, error } = await visit(plain.context, site.url);
    await sleep(8000);
    result.plain = { httpStatus, error, title: await page.title().catch(() => '') };
    await page.screenshot({ path: join(outDir, `${site.id}-plain.png`) }).catch(() => {});
  } finally {
    await plain.context.close().catch(() => {});
    rmSync(plain.profile, { recursive: true, force: true });
  }

  // 2. With the extension: one visit, then one reload.
  const ext = await open(true);
  try {
    const worker = ext.context.serviceWorkers()[0] ?? (await ext.context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const storePage = await ext.context.newPage();
    await storePage.goto(`chrome-extension://${id}/popup.html`);
    for (let i = 0; i < 100 && !('meta' in (await storePage.evaluate(() => chrome.storage.local.get(null)))); i++) await sleep(100);

    const { page, httpStatus, error } = await visit(ext.context, site.url);
    await page.bringToFront().catch(() => {});
    const deadline = Date.now() + 35_000;
    let records = [];
    while (Date.now() < deadline) {
      records = await siteRecords(storePage);
      if (records.some((r) => SETTLED.has(String(r.status)))) break;
      await sleep(500);
    }
    await sleep(9000); // lets the audit's after-refusal window close
    records = await siteRecords(storePage);
    result.first = { httpStatus, error, title: await page.title().catch(() => ''), records: records.map(pick) };
    await page.screenshot({ path: join(outDir, `${site.id}-ext.png`) }).catch(() => {});

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {});
    await sleep(12_000);
    result.reload = { records: (await siteRecords(storePage)).map(pick) };
    await page.screenshot({ path: join(outDir, `${site.id}-reload.png`) }).catch(() => {});
  } catch (e) {
    result.runError = String(e.message ?? e).split('\n')[0];
  } finally {
    await ext.context.close().catch(() => {});
    rmSync(ext.profile, { recursive: true, force: true });
  }
  return result;
}

const results = [];
for (const site of panel.sites) {
  if (filter && !site.id.startsWith(filter)) continue;
  const result = await runSite(site);
  results.push(result);
  const first = result.first?.records?.[0];
  console.log(`${site.id} ${site.url} -> ${first ? `${first.status} (${first.cmp ?? 'no cmp'})` : `no record${result.runError ? ` [${result.runError}]` : ''}`} http=${result.first?.httpStatus}`);
  writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2));
}
