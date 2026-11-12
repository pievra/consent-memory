/// <reference types="chrome" />
import { expect, test, type Page } from '@playwright/test';
import { launch, seed, siteRecord, startServer, waitForFirstStart, type FixtureServer, type Session } from './harness';

let fx: FixtureServer;
let session: Session;
const url = (host: string, page: string) => `http://${host}.localhost:${fx.port}/${page}`;
const ext = (path: string) => `chrome-extension://${session.extensionId}/${path}`;

test.beforeAll(async () => {
  fx = await startServer();
});
test.afterAll(async () => {
  fx.server.close();
});
test.beforeEach(async () => {
  session = await launch();
  await waitForFirstStart(session);
  fx.gpc.clear();
});
test.afterEach(async () => {
  await session.context.close();
});

/** The header rule and script registration are applied just after the store is ready. */
async function gpcApplied(expected: boolean): Promise<void> {
  const page = await session.context.newPage();
  await page.goto(ext('options.html'));
  await expect
    .poll(async () => page.evaluate(async () => ({ rules: (await chrome.declarativeNetRequest.getDynamicRules()).length, scripts: (await chrome.scripting.getRegisteredContentScripts()).length })))
    .toEqual(expected ? { rules: 1, scripts: 1 } : { rules: 0, scripts: 0 });
  await page.close();
}
async function probe(host: string, query = ''): Promise<Page> {
  const page = await session.context.newPage();
  await page.goto(url(host, `gpc.html${query}`));
  await page.evaluate(() => (window as unknown as { __ready: Promise<unknown> }).__ready);
  return page;
}
const signal = (page: Page) => page.evaluate(() => ({ atStart: (window as unknown as { __gpcAtStart: unknown }).__gpcAtStart, now: (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl }));

test('on by default: the header is sent on the page, on requests it makes, and the page can read the signal from its first script', async () => {
  await gpcApplied(true);
  const page = await probe('one');
  expect(fx.gpc.get('one.localhost /gpc.html')).toBe('1');
  expect(fx.gpc.get('one.localhost /echo.txt')).toBe('1');
  expect(fx.gpc.get('one.localhost /pixel.gif')).toBe('1');
  expect(await signal(page)).toEqual({ atStart: true, now: true });

  // a second navigation in the same tab
  await page.goto(url('two', 'gpc.html'));
  await page.evaluate(() => (window as unknown as { __ready: Promise<unknown> }).__ready);
  expect(fx.gpc.get('two.localhost /gpc.html')).toBe('1');
  expect(await signal(page)).toEqual({ atStart: true, now: true });
});

test('frames from another site receive the header and the signal too', async () => {
  await gpcApplied(true);
  const page = await probe('outer', `?frame=${encodeURIComponent(url('inner', 'gpc.html'))}`);
  const frame = page.frames().find((f) => f.url().startsWith('http://inner.localhost'));
  await frame!.waitForLoadState();
  expect(fx.gpc.get('inner.localhost /gpc.html')).toBe('1');
  expect(await frame!.evaluate(() => (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl)).toBe(true);
});

test('switching it off in settings removes both the header and the signal, and switching it on restores them', async () => {
  await gpcApplied(true);
  const settings = await session.context.newPage();
  await settings.goto(ext('options.html'));
  const control = settings.locator('fieldset.purpose', { hasText: 'Sec-GPC' });
  await expect(control.getByLabel('On', { exact: true })).toBeChecked();
  await control.getByLabel('Off', { exact: true }).check();
  await gpcApplied(false);

  let page = await probe('off');
  expect(fx.gpc.get('off.localhost /gpc.html')).toBeUndefined();
  expect(fx.gpc.get('off.localhost /echo.txt')).toBeUndefined();
  expect(await signal(page)).toEqual({ atStart: undefined, now: undefined });

  await control.getByLabel('On', { exact: true }).check();
  await gpcApplied(true);
  page = await probe('onagain');
  expect(fx.gpc.get('onagain.localhost /gpc.html')).toBe('1');
  expect(await signal(page)).toEqual({ atStart: true, now: true });
});

test('a paused site receives neither the header nor the signal, while other sites still do', async () => {
  await seed(session, { 'site:quiet.localhost': { ...siteRecord('quiet.localhost', []), paused: true } });
  // Pausing through the popup is what triggers the update; do it the way a user would.
  const popup = await session.context.newPage();
  await popup.goto(ext(`popup.html?site=${encodeURIComponent(url('quiet', 'gpc.html'))}`));
  await popup.getByRole('button', { name: 'Resume on this site' }).click();
  await popup.getByRole('button', { name: 'Pause on this site' }).click();
  await expect(popup.locator('#gpc-status')).toContainText('not sent to this site while it is paused');

  await expect.poll(async () => popup.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules())[0]?.condition.excludedRequestDomains)).toEqual(['quiet.localhost']);
  const quiet = await probe('quiet');
  expect(fx.gpc.get('quiet.localhost /gpc.html')).toBeUndefined();
  expect(fx.gpc.get('quiet.localhost /echo.txt')).toBeUndefined();
  expect(await signal(quiet)).toEqual({ atStart: undefined, now: undefined });

  const loud = await probe('loud');
  expect(fx.gpc.get('loud.localhost /gpc.html')).toBe('1');
  expect(await signal(loud)).toEqual({ atStart: true, now: true });
});

test('still on after the browser is closed and reopened, before any settings page is opened', async () => {
  await gpcApplied(true);
  const profile = session.profile;
  await session.context.close();
  session = await launch(profile);
  fx.gpc.clear();
  // The header must be on every page from the very first one.
  // The page property comes from a script registration that Chrome restores shortly after
  // launch. Pages loaded before that have the header only: usually just the first page,
  // more on a slow machine. So: the property must appear within ten seconds, and once it
  // has appeared it must never be missing again.
  let appearedAt = -1;
  for (let index = 0; index < 20 && appearedAt < 0; index++) {
    const page = await probe(`restart${index}`);
    expect(fx.gpc.get(`restart${index}.localhost /gpc.html`)).toBe('1');
    if ((await signal(page)).atStart === true) appearedAt = index;
    else await page.waitForTimeout(500);
    await page.close();
  }
  expect(appearedAt).toBeGreaterThanOrEqual(0);
  for (const host of ['later1', 'later2', 'later3']) {
    const page = await probe(host);
    expect(fx.gpc.get(`${host}.localhost /gpc.html`)).toBe('1');
    expect(await signal(page)).toEqual({ atStart: true, now: true });
  }
});
