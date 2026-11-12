/// <reference types="chrome" />
import { chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { readFileSync, mkdtempSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EXTENSION = resolve('.output/chrome-mv3');
const PAGES = resolve('tests/fixtures/pages');
// Set CHROMIUM_PATH to a Chrome for Testing or Chromium binary; branded Chrome no longer loads unpacked extensions from flags.
const EXECUTABLE = process.env.CHROMIUM_PATH;

export interface FixtureServer {
  server: Server;
  port: number;
  /** Paths requested, for asserting that no form was submitted. */
  hits: string[];
  /** Value of the Sec-GPC request header for each request, keyed by "host path". */
  gpc: Map<string, string | undefined>;
}

export function startServer(): Promise<FixtureServer> {
  const hits: string[] = [];
  const gpc = new Map<string, string | undefined>();
  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]!;
    hits.push(path);
    const header = req.headers['sec-gpc'];
    gpc.set(`${(req.headers.host ?? '').split(':')[0]} ${path}`, Array.isArray(header) ? header[0] : header);
    const name = path.replace(/^\//, '');
    if (/^[a-z-]+\.html$/.test(name)) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(readFileSync(join(PAGES, name)));
    } else {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<h1>other</h1>');
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: (server.address() as AddressInfo).port, hits, gpc })));
}

export interface Session {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  profile: string;
}

export async function launch(profile = mkdtempSync(join(tmpdir(), 'consent-memory-e2e-'))): Promise<Session> {
  const context = await chromium.launchPersistentContext(profile, {
    ...(EXECUTABLE ? { executablePath: EXECUTABLE } : { channel: 'chromium' }),
    headless: true,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, '--no-sandbox', '--headless=new'],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  return { context, worker, extensionId: new URL(worker.url()).host, profile };
}

export type Stored = Record<string, Record<string, unknown>>;

const storePages = new WeakMap<BrowserContext, Page>();

/**
 * Reads extension storage through an extension page. The service worker is not
 * used for this: the browser may have stopped it, which leaves stale handles.
 */
export async function readStore(session: Session): Promise<Stored> {
  let page = storePages.get(session.context);
  if (!page || page.isClosed()) {
    page = await session.context.newPage();
    await page.goto(`chrome-extension://${session.extensionId}/popup.html`);
    storePages.set(session.context, page);
  }
  return (await page.evaluate(() => chrome.storage.local.get(null))) as Stored;
}

const SETTLED = new Set(['verified', 'partial', 'failed', 'inconclusive', 'unsupported', 'skipped']);

export async function waitForOutcome(session: Session, site: string, timeoutMs = 30_000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  let last: Record<string, unknown> | undefined;
  while (Date.now() < deadline) {
    last = (await readStore(session))[`site:${site}`];
    if (last && SETTLED.has(String(last.status))) return last;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No settled outcome for ${site}; last record: ${JSON.stringify(last)}`);
}

export const clicks = (page: Page) => page.evaluate(() => (window as unknown as { __clicks: Record<string, number> }).__clicks);

/** A schema valid site record with the given purposes allowed by the user. */
export function siteRecord(domain: string, allowed: string[]): Record<string, unknown> {
  const purposes = ['storage', 'preferences', 'analytics', 'content', 'advertising', 'other'];
  return {
    domain,
    choices: Object.fromEntries(purposes.map((p) => [p, allowed.includes(p) ? 'allow' : 'refuse'])),
    setBy: Object.fromEntries(purposes.map((p) => [p, 'user'])),
    status: 'not_detected',
    paused: false,
    mappingVersion: 1,
    schemaVersion: 1,
  };
}

/**
 * Resolves once the extension has finished its first start after installation
 * (its store metadata exists). Until then Chrome has not recorded which events
 * the worker listens for, and a worker stopped in that window is not woken again.
 */
export async function waitForFirstStart(session: Session): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!('meta' in (await readStore(session)))) {
    if (Date.now() > deadline) throw new Error('Extension store was not initialised');
    await new Promise((r) => setTimeout(r, 100));
  }
}

export async function seed(session: Session, items: Record<string, unknown>): Promise<void> {
  // Data written before the store is initialised would be found without its metadata
  // and the store would be opened read only.
  await waitForFirstStart(session);
  await storePages.get(session.context)!.evaluate((data) => chrome.storage.local.set(data), items);
}

/** Terminates the extension service worker through the DevTools protocol. The browser restarts it on the next event. */
export async function stopServiceWorker(session: Session, page: Page): Promise<number> {
  const cdp = await session.context.newCDPSession(page);
  const { targetInfos } = await cdp.send('Target.getTargets');
  const workers = targetInfos.filter((t) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://'));
  for (const w of workers) await cdp.send('Target.closeTarget', { targetId: w.targetId });
  await cdp.detach();
  return workers.length;
}
