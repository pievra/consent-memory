/// <reference types="chrome" />
import { expect, test } from '@playwright/test';
import { clicks, launch, readStore, seed, siteRecord, startServer, waitForFirstStart, waitForOutcome, type FixtureServer, type Session } from './harness';

/**
 * Proves the sentence on the welcome page: the extension never presses "accept"
 * unless the user chose to allow all six purposes on that site. All three runs use
 * the same fixture, a consent tool with an accept route and a refuse route.
 */
const ALL = ['storage', 'preferences', 'analytics', 'content', 'advertising', 'other'];
const all = (value: string) => Object.fromEntries(ALL.map((p) => [p, value]));

let fx: FixtureServer;
let session: Session;
const url = (host: string) => `http://${host}.localhost:${fx.port}/onetrust.html`;
const ext = (path: string) => `chrome-extension://${session.extensionId}/${path}`;

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

async function visit(host: string): Promise<Record<string, number>> {
  const page = await session.context.newPage();
  await page.goto(url(host));
  await waitForOutcome(session, `${host}.localhost`);
  return clicks(page);
}

test('the welcome page still carries the sentence, unchanged', async () => {
  const page = await session.context.newPage();
  await page.goto(ext('onboarding.html'));
  await expect(page.locator('body')).toContainText('It never presses “accept” unless you have chosen to allow all six purposes on that site.');
});

test('run 1: no site rule on a consent tool with an accept route: refuse is clicked', async () => {
  const result = await visit('norule');
  console.log('run 1, no site rule → clicks', JSON.stringify(result));
  expect(result).toEqual({ accept: 0, reject: 1 });
});

test('run 2: six site allows on the same fixture: accept is clicked', async () => {
  await seed(session, { 'site:sixallows.localhost': siteRecord('sixallows.localhost', ALL) });
  const result = await visit('sixallows');
  console.log('run 2, six site allows → clicks', JSON.stringify(result));
  expect(result).toEqual({ accept: 1, reject: 0 });
});

test('run 3: a store migrated from six global allows: refuse is clicked', async () => {
  await waitForFirstStart(session);
  const createdAt = ((await readStore(session)).meta as { createdAt: string }).createdAt;
  await seed(session, {
    meta: { schemaVersion: 1, createdAt },
    settings: { globalChoices: all('allow'), globalSetBy: all('user'), gpcEnabled: true, schemaVersion: 1 },
  });
  const profile = session.profile;
  await session.context.close();
  session = await launch(profile);
  await expect.poll(async () => ((await readStore(session)).meta as { schemaVersion: number }).schemaVersion).toBe(2);

  const result = await visit('migrated');
  console.log('run 3, store migrated from six global allows → clicks', JSON.stringify(result));
  expect(result).toEqual({ accept: 0, reject: 1 });
});
