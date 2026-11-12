/// <reference types="chrome" />
import { expect, test } from '@playwright/test';
import { launch, readStore, startServer, waitForFirstStart, waitForOutcome, type FixtureServer, type Session } from './harness';

let fx: FixtureServer;
let session: Session;
const url = (host: string, page: string) => `http://${host}.localhost:${fx.port}/${page}`;
const ext = (path: string) => `chrome-extension://${session.extensionId}/${path}`;
type Check = { check: string; outcome: string; services?: string[]; count?: number };

test.beforeAll(async () => {
  fx = await startServer();
});
test.afterAll(async () => {
  fx.server.close();
});
test.beforeEach(async () => {
  session = await launch();
  await waitForFirstStart(session);
});
test.afterEach(async () => {
  await session.context.close();
});

async function auditFor(host: string, query: string): Promise<Record<string, Check>> {
  const page = await session.context.newPage();
  await page.goto(url(host, `onetrust.html${query}`));
  await waitForOutcome(session, `${host}.localhost`);
  let checks: Check[] | undefined;
  await expect
    .poll(async () => (checks = ((await readStore(session))[`site:${host}.localhost`]?.audit as { checks: Check[] } | undefined)?.checks) !== undefined, { timeout: 20_000 })
    .toBe(true);
  return Object.fromEntries(checks!.map((c) => [c.check, c]));
}

test('a site that contacts nothing: tracking checks pass and refusing took one step', async () => {
  const checks = await auditFor('clean', '');
  expect(checks.tracking_before_consent).toEqual({ check: 'tracking_before_consent', outcome: 'passed' });
  expect(checks.tracking_after_refusal).toEqual({ check: 'tracking_after_refusal', outcome: 'passed' });
  expect(checks.refusal_accessibility).toMatchObject({ outcome: 'passed', count: 1 });
  // No machine readable consent state on this page: reported as not observable, never as passed.
  expect(checks.optional_purposes_preselected!.outcome).toBe('inconclusive');
  expect(checks.consent_information_available!.outcome).toBe('inconclusive');
  expect(checks.gpc_behaviour!.outcome).toBe('not_applicable');
});

test('a tracking service contacted before the answer is reported by its service name only', async () => {
  const checks = await auditFor('early', '?track=before');
  expect(checks.tracking_before_consent).toEqual({ check: 'tracking_before_consent', outcome: 'signal_detected', services: ['fixture-tracker.localhost'], count: 1 });
  expect(checks.tracking_after_refusal!.outcome).toBe('passed');
  expect(JSON.stringify((await readStore(session))['site:early.localhost'])).not.toMatch(/pixel\.gif|\?before|http:/);
});

test('a tracking service contacted after the refusal is reported, and the refusal can still be verified', async () => {
  const checks = await auditFor('late', '?track=after');
  expect(checks.tracking_before_consent!.outcome).toBe('passed');
  expect(checks.tracking_after_refusal).toEqual({ check: 'tracking_after_refusal', outcome: 'signal_detected', services: ['fixture-tracker.localhost'], count: 1 });
  expect((await readStore(session))['site:late.localhost']!.status).toBe('verified'); // stored refusal and observed behaviour are separate facts
});

test('preselected purposes are read from the page state while the banner is unanswered', async () => {
  const checks = await auditFor('preset', '?tcf=li');
  expect(checks.optional_purposes_preselected).toMatchObject({ outcome: 'signal_detected', count: 2 });
  expect(checks.consent_information_available!.outcome).toBe('passed');
});

test('nothing is recorded for a site without a known banner, even if it contacts a tracking service', async () => {
  const page = await session.context.newPage();
  await page.goto(url('nobanner', 'gpc.html'));
  await page.evaluate((port) => { new Image().src = `http://fixture-tracker.localhost:${port}/pixel.gif`; }, fx.port);
  await page.waitForTimeout(1500);
  await page.goto(url('elsewhere', 'gpc.html')); // leaving the page concludes its audit
  await page.waitForTimeout(1500);
  expect(Object.keys(await readStore(session)).filter((k) => k.startsWith('site:'))).toEqual([]);
});

test('the popup and settings show the audit as observations, in English and French', async () => {
  await auditFor('shown', '?track=both');
  const popup = await session.context.newPage();
  await popup.goto(ext(`popup.html?site=${encodeURIComponent(url('shown', 'onetrust.html'))}`));
  await expect(popup.locator('.audit h3')).toHaveText('Privacy signals on this site');
  await expect(popup.locator('.audit-total')).toHaveText('1 checks passed, 2 signals detected, 2 inconclusive.');
  await expect(popup.locator('.audit')).toContainText('1 tracking services were contacted after your refusal: fixture-tracker.localhost.');
  await expect(popup.locator('.audit')).toContainText('They are not a legal finding');
  await expect(popup.locator('.audit')).not.toContainText(/compliant|illegal|unlawful|violation/i);

  await popup.goto(ext(`popup.html?lang=fr&site=${encodeURIComponent(url('shown', 'onetrust.html'))}`));
  await expect(popup.locator('.audit h3')).toHaveText('Signaux de confidentialité sur ce site');
  await expect(popup.locator('.audit')).toContainText('Ce n’est pas une conclusion juridique');
});
