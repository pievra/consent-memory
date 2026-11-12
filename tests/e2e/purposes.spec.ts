/// <reference types="chrome" />
import { expect, test, type Page } from '@playwright/test';
import { clicks, launch, seed, siteRecord, startServer, waitForOutcome, type FixtureServer, type Session } from './harness';

let fx: FixtureServer;
let session: Session;
const url = (host: string, query = '') => `http://${host}.localhost:${fx.port}/cookiebot-purposes.html${query}`;
const submitted = (page: Page) => page.evaluate(() => (window as unknown as { __submitted: boolean[][] }).__submitted);

test.beforeAll(async () => {
  fx = await startServer();
});
test.afterAll(async () => {
  fx.server.close();
});
test.beforeEach(async () => {
  session = await launch();
});
test.afterEach(async () => {
  await session.context.close();
});

async function visit(host: string, allowed: string[], query = ''): Promise<{ page: Page; record: Record<string, unknown> }> {
  if (allowed.length > 0) await seed(session, { [`site:${host}.localhost`]: siteRecord(`${host}.localhost`, allowed) });
  const page = await session.context.newPage();
  await page.goto(url(host, query));
  return { page, record: await waitForOutcome(session, `${host}.localhost`) };
}

test('allowing one purpose sets exactly that purpose through the consent tool, clicks nothing, and is verified from what the tool stored', async () => {
  const { page, record } = await visit('one', ['storage', 'analytics']);
  expect(await submitted(page)).toEqual([[false, true, false]]); // preferences, statistics, marketing
  expect(await clicks(page)).toEqual({ accept: 0, reject: 0 });
  expect(record).toMatchObject({ status: 'verified', cmp: 'Cybotcookiebot', unfulfilled: [] });
  expect(record.evidenceSummary).toEqual(['cmp_state_read: confirms — CMP reports your choice for each of its 3 purposes']);
  await expect(page.locator('#CybotCookiebotDialog')).toHaveCount(0);

  const popup = await session.context.newPage();
  await popup.goto(`chrome-extension://${session.extensionId}/popup.html?site=${encodeURIComponent(url('one'))}`);
  await expect(popup.locator('.result .status')).toContainText('Choices applied and confirmed');
  await expect(popup.locator('.evidence')).toContainText('reports your choice for each of the 3 purposes it offers');
});

test('a purpose the consent tool does not offer is reported, and the result is partial', async () => {
  const { page, record } = await visit('extra', ['storage', 'analytics', 'content']);
  expect(await submitted(page)).toEqual([[false, true, false]]);
  expect(record).toMatchObject({ status: 'partial', unfulfilled: ['content'] });
});

test('never verified when the consent tool keeps a refused purpose switched on', async () => {
  const { page, record } = await visit('sticky', ['storage', 'analytics'], '?sticky');
  expect(await submitted(page)).toEqual([[false, true, false]]);
  expect(record.status).toBe('failed');
  expect(record.lastVerified).toBeUndefined();
});

test('partial when the consent tool does not grant a purpose that was allowed', async () => {
  const { record } = await visit('drop', ['storage', 'analytics'], '?drop');
  expect(record.status).toBe('partial');
  expect(record.lastVerified).toBeUndefined();
});

test('falls back to refusing everything when the category interface is missing', async () => {
  const { page, record } = await visit('noapi', ['storage', 'analytics'], '?noapi');
  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(record).toMatchObject({ status: 'partial', unfulfilled: ['storage', 'analytics'] });
});

test('with everything refused, or only purposes the tool does not offer allowed, the ordinary refusal is used', async () => {
  const refused = await visit('plain', []);
  expect(await submitted(refused.page)).toEqual([]);
  expect(await clicks(refused.page)).toEqual({ accept: 0, reject: 1 });
  expect(refused.record.status).toBe('verified');

  const other = await visit('unoffered', ['content']);
  expect(await submitted(other.page)).toEqual([]);
  expect(await clicks(other.page)).toEqual({ accept: 0, reject: 1 });
  expect(other.record).toMatchObject({ status: 'partial', unfulfilled: ['content'] });
});

test('five of six purposes allowed is never an acceptance of the banner', async () => {
  const five = ['storage', 'preferences', 'analytics', 'content', 'other'];
  const { page, record } = await visit('five', five);
  expect(await submitted(page)).toEqual([[true, true, false]]);
  expect(await clicks(page)).toEqual({ accept: 0, reject: 0 });
  expect(record).toMatchObject({ status: 'partial', unfulfilled: ['content', 'other'] });
});

test('allowing a purpose without "storage and access" grants nothing: everything is refused and the reason is shown', async () => {
  const { page, record } = await visit('nostorage', ['analytics']);
  expect(await submitted(page)).toEqual([]);
  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(record).toMatchObject({ status: 'partial', unfulfilled: ['analytics'] });
});

test('choices for one site are never submitted on another site that the tab has moved to', async () => {
  // Site A has a mixed choice; site B, also on this consent tool, has none. The tab is sent to B
  // the moment A's page starts, while the worker is still stopped and has to start up.
  await seed(session, { 'site:hop.localhost': siteRecord('hop.localhost', ['storage', 'analytics', 'advertising']) });
  const page = await session.context.newPage();
  await page.addInitScript(() => {
    if (location.hostname.startsWith('hop.')) window.addEventListener('DOMContentLoaded', () => setTimeout(() => location.replace(location.href.replace('hop.', 'landing.')), 60));
  });
  await page.goto(url('hop'));
  await page.waitForURL(/landing\.localhost/);
  const record = await waitForOutcome(session, 'landing.localhost');
  // B was handled with B's own choices: an ordinary refusal. Nothing from A reached it.
  expect(await submitted(page)).toEqual([]);
  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(record.status).toBe('verified');
});
