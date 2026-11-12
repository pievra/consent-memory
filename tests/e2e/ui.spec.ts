/// <reference types="chrome" />
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { launch, readStore, seed, siteRecord, startServer, waitForOutcome, type FixtureServer, type Session } from './harness';

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
});
test.afterEach(async () => {
  await session.context.close();
});

async function handled(host: string): Promise<void> {
  const page = await session.context.newPage();
  await page.goto(url(host, 'onetrust.html'));
  await waitForOutcome(session, `${host}.localhost`);
  await page.close();
}
const purpose = (page: Page, name: string) => page.locator('fieldset.purpose', { hasText: name });
const site = async (domain: string) => (await readStore(session))[`site:${domain}`] as { choices: Record<string, string>; setBy: Record<string, string>; paused: boolean; status: string };

async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

test('popup shows the verified result for the site and lets the user set a choice and pause', async () => {
  await handled('shop');
  const popup = await session.context.newPage();
  await popup.goto(ext(`popup.html?site=${encodeURIComponent(url('shop', 'onetrust.html'))}`));

  await expect(popup.locator('h1')).toHaveText('shop.localhost');
  await expect(popup.locator('.result .status')).toContainText('Refused and confirmed');
  await expect(popup.locator('.evidence')).toContainText('reports your refusal as stored');
  // The result comes first; the per site choices are folded until asked for.
  await expect(purpose(popup, 'Advertising')).toBeHidden();
  await expect(popup.locator('details.choices > summary')).toContainText('Uses my defaults');
  await popup.locator('details.choices > summary').click();
  await expect(purpose(popup, 'Advertising').getByLabel('Default (refuse)')).toBeChecked();
  await expectAccessible(popup);

  // The click is answered by the background a moment later, so each stored value is polled for.
  await purpose(popup, 'Preferences').getByLabel('Allow', { exact: true }).check();
  await expect(purpose(popup, 'Preferences').getByLabel('Allow', { exact: true })).toBeChecked();
  await expect.poll(async () => { const r = await site('shop.localhost'); return [r.choices.preferences, r.setBy.preferences]; }).toEqual(['allow', 'user']);
  expect((await site('shop.localhost')).status).toBe('verified'); // the earlier result is untouched

  await purpose(popup, 'Preferences').getByLabel('Default (refuse)').check();
  await expect.poll(async () => (await site('shop.localhost')).setBy.preferences).toBe('default');

  await popup.getByRole('button', { name: 'Pause on this site' }).click();
  await expect(popup.locator('.result .status')).toContainText('Paused on this site');
  await expect.poll(async () => (await site('shop.localhost')).paused).toBe(true);
  await expect(popup.getByRole('button', { name: 'Resume on this site' })).toBeVisible();
});

test('popup choices can be changed with the keyboard alone', async () => {
  const popup = await session.context.newPage();
  await popup.goto(ext(`popup.html?site=${encodeURIComponent('https://keyboard.example/')}`));
  await expect(popup.locator('.result .status')).toContainText('Nothing found yet');
  // Opened from the keyboard too: the summary is a native control.
  await popup.locator('details.choices > summary').focus();
  await popup.keyboard.press('Enter');
  await purpose(popup, 'Storage and access').getByLabel('Default (refuse)').focus();
  await popup.keyboard.press('ArrowRight');
  await popup.keyboard.press('ArrowRight');
  await expect(purpose(popup, 'Storage and access').getByLabel('Allow', { exact: true })).toBeChecked();
  await expect.poll(async () => (await site('keyboard.example'))?.choices.storage).toBe('allow');
});

test('popup explains when the page is not a website', async () => {
  const popup = await session.context.newPage();
  await popup.goto(ext(`popup.html?site=${encodeURIComponent('chrome://extensions/')}`));
  await expect(popup.locator('body')).toContainText('not a website the extension can work on');
  await expect(popup.locator('fieldset')).toHaveCount(0);
  // The brand header is on every popup view and its only link goes to the publisher's website, in a new tab.
  await expect(popup.getByRole('img', { name: 'Pievra' })).toBeVisible();
  const site = popup.locator('a.brand-link');
  await expect(site).toHaveAttribute('href', 'https://pievra.com');
  await expect(site).toHaveAttribute('target', '_blank');
  await expect(site).toHaveAttribute('rel', 'noopener noreferrer');
});

test('settings: defaults, search, filter, forget with undo, and bulk refusal with preview', async () => {
  await handled('alpha');
  await handled('beta');
  await seed(session, { 'site:gamma.localhost': siteRecord('gamma.localhost', ['content', 'analytics']) });
  const page = await session.context.newPage();
  await page.goto(ext('options.html'));
  await expect(page.locator('h1')).toHaveText('Settings');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expectAccessible(page);

  // defaults
  await purpose(page, 'Analytics').getByLabel('Allow', { exact: true }).check();
  await expect.poll(async () => ((await readStore(session)).settings as { globalChoices: Record<string, string> } | undefined)?.globalChoices.analytics).toBe('allow');

  // search and filter
  await page.getByPlaceholder('Search sites').fill('alph');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByPlaceholder('Search sites').fill('');
  await page.getByLabel('Show').selectOption('verified');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByLabel('Show').selectOption('all');

  // details
  await page.getByRole('button', { name: 'Details for alpha.localhost' }).click();
  await expect(page.locator('tr.detail')).toContainText('reports your refusal as stored');

  // forget and undo
  const before = await site('beta.localhost');
  await page.getByRole('checkbox', { name: 'beta.localhost' }).check();
  await page.getByRole('button', { name: 'Forget' }).click();
  await expect(page.locator('.toast')).toContainText('1 sites forgotten');
  expect((await readStore(session))['site:beta.localhost']).toBeUndefined();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await readStore(session))['site:beta.localhost']).toEqual(before);

  // bulk: preview first, nothing written until confirmed
  await page.getByRole('button', { name: 'Refuse everything on all sites' }).click();
  await expect(page.locator('#bulk-text')).toHaveText('This will change your defaults for 1 purposes and your choices on 1 sites.');
  expect((await site('gamma.localhost')).choices.content).toBe('allow');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect.poll(async () => (await site('gamma.localhost')).choices.content).toBe('refuse');
  expect(((await readStore(session)).settings as { globalChoices: Record<string, string> }).globalChoices.analytics).toBe('refuse');
  expect((await site('alpha.localhost')).status).toBe('verified');
});

test('settings: export, delete everything, then import brings the choices back without any result', async () => {
  await handled('kept');
  await seed(session, { 'site:custom.localhost': { ...siteRecord('custom.localhost', ['preferences']), paused: true } });
  const page = await session.context.newPage();
  await page.goto(ext('options.html'));
  await expect(page.locator('tbody tr')).toHaveCount(2);

  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export my choices' }).click()]);
  const path = await file.path();
  const exported = JSON.parse(await (await import('node:fs/promises')).readFile(path, 'utf8')) as { format: string; sites: Array<Record<string, unknown>> };
  expect(exported.format).toBe('consent-memory-export');
  expect(exported.sites.map((s) => Object.keys(s).sort())).toEqual([['choices', 'domain', 'paused', 'setBy'], ['choices', 'domain', 'paused', 'setBy']]);

  await page.getByRole('button', { name: 'Delete everything' }).first().click();
  await expect(page.locator('#delete-text')).toBeVisible();
  await page.locator('.confirm').getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.locator('.empty')).toBeVisible();
  expect(Object.keys(await readStore(session)).filter((k) => k.startsWith('site:'))).toEqual([]);

  await page.locator('#import-file').setInputFiles(path);
  await expect(page.locator('#import-text')).toHaveText('2 new sites, 0 with different choices, 0 identical.');
  // The file allows one purpose on one site: that is spelled out and must be acknowledged first.
  await expect(page.locator('.import-allows')).toContainText('1 new sites where at least one purpose is allowed');
  await expect(page.getByRole('button', { name: 'Keep my choices where they differ' })).toBeDisabled();
  await page.getByLabel('I have read this and want to import the file').check();
  await page.getByRole('button', { name: 'Keep my choices where they differ' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  const custom = await site('custom.localhost');
  expect([custom.choices.preferences, custom.setBy.preferences, custom.paused]).toEqual(['allow', 'user', true]);
  expect((await site('kept.localhost')).status).toBe('not_detected'); // a file cannot carry a result

  await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"something else"}') });
  await expect(page.locator('.toast')).toContainText('not a valid export');
});

test('settings and popup are available in French and pass the automated accessibility checks at phone width', async () => {
  await handled('boutique');
  const page = await session.context.newPage();
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(ext('options.html?lang=fr'));
  await expect(page.locator('h1')).toHaveText('Réglages');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('tbody tr').first()).toContainText('Refusé et confirmé');
  await expectAccessible(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await page.goto(ext(`popup.html?lang=fr&site=${encodeURIComponent(url('boutique', 'onetrust.html'))}`));
  await expect(page.locator('.result .status')).toContainText('Refusé et confirmé');
  // Checked folded, as it opens, and again with the choices unfolded.
  await expectAccessible(page);
  await page.locator('details.choices > summary').click();
  await expect(purpose(page, 'Publicité').getByLabel('Refuser', { exact: true })).toBeVisible();
  await expectAccessible(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test('a web page cannot reach the preference API through the content script channel', async () => {
  await handled('victim');
  const before = await readStore(session);
  // The only way a page can talk to the extension is by being a page: it has no runtime API.
  const page = await session.context.newPage();
  await page.goto(url('victim', 'unknown.html'));
  expect(await page.evaluate(() => typeof (globalThis as unknown as { chrome?: { runtime?: { sendMessage?: unknown } } }).chrome?.runtime?.sendMessage)).toBe('undefined');
  expect(await readStore(session)).toEqual(before);
});

test('the welcome page opens once after installation, explains the product and passes the accessibility checks', async () => {
  const welcome = () => session.context.pages().filter((p) => p.url().includes('/onboarding.html'));
  await expect.poll(() => welcome().length, { timeout: 10_000 }).toBe(1);
  const page = welcome()[0]!;
  await expect(page.locator('h1')).toHaveText('Cookie banners are refused for you, then checked.');
  await expect(page.locator('ol.steps li')).toHaveCount(3);
  await expect(page.locator('body')).toContainText('sends nothing anywhere');
  await expectAccessible(page);

  // The one control on the page changes the stored setting.
  await expect(page.getByLabel('On', { exact: true })).toBeChecked();
  await page.getByLabel('Off', { exact: true }).check();
  await expect.poll(async () => ((await readStore(session)).settings as { gpcEnabled: boolean }).gpcEnabled).toBe(false);

  // It is reachable again from the settings page, and nothing reopens it by itself.
  await page.getByRole('link', { name: 'Open settings' }).click();
  await expect(page.locator('h1')).toHaveText('Settings');
  await page.getByRole('link', { name: 'Results file for testers' }).click();
  await expect(page.locator('h1')).toHaveText('Sites handled so far');
  await page.goBack();
  await page.getByRole('link', { name: 'How Pievra works' }).click();
  await expect(page.locator('h1')).toHaveText('Cookie banners are refused for you, then checked.');
  expect(welcome().length).toBe(1);
});

test('the welcome page is available in French at phone width without overflow', async () => {
  const page = await session.context.newPage();
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(ext('onboarding.html?lang=fr'));
  await expect(page.locator('h1')).toHaveText('Les bandeaux cookies sont refusés pour vous, puis vérifiés.');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expectAccessible(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test('an import that would allow everything by default says so and cannot be applied without an explicit tick', async () => {
  const purposes = ['storage', 'preferences', 'analytics', 'content', 'advertising', 'other'];
  const all = (value: string) => Object.fromEntries(purposes.map((p) => [p, value]));
  const preset = { format: 'consent-memory-export', formatVersion: 1, sites: [], settings: { globalChoices: all('allow'), globalSetBy: all('user') } };
  const page = await session.context.newPage();
  await page.goto(ext('options.html'));
  await page.locator('#import-file').setInputFiles({ name: 'preset.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(preset)) });
  await expect(page.locator('#import-text')).toHaveText('0 new sites, 0 with different choices, 0 identical.');
  await expect(page.locator('.import-allows')).toContainText('On every site, by default: Storage and access, Preferences, Analytics, Content, Advertising and Other purposes');
  const take = page.getByRole('button', { name: 'Use the file’s choices where they differ' });
  await expect(take).toBeDisabled();
  await expectAccessible(page);
  // Cancelling leaves every default at refuse.
  await page.locator('.confirm').getByRole('button', { name: 'Cancel' }).click();
  const stored = (await readStore(session)).settings as { globalChoices: Record<string, string> } | undefined;
  expect(Object.values(stored?.globalChoices ?? all('refuse'))).toEqual(purposes.map(() => 'refuse'));
});

test('the toolbar button carries a mark for the result, and the popup says why a result is partial and what to do', async () => {
  const badge = async (page: import('@playwright/test').Page) => {
    const probe = await session.context.newPage();
    await probe.goto(ext('options.html'));
    const text = await probe.evaluate(async (wanted) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((t) => t.url === wanted);
      return tab?.id === undefined ? null : chrome.action.getBadgeText({ tabId: tab.id });
    }, page.url());
    await probe.close();
    return text;
  };
  // Confirmed refusal: a tick.
  const shop = await session.context.newPage();
  await shop.goto(`http://badge.localhost:${fx.port}/onetrust.html`);
  await waitForOutcome(session, 'badge.localhost');
  await expect.poll(() => badge(shop)).toBe('✓');
  // The same site on a later visit, with no banner this time: the mark is back from what is stored.
  await shop.reload();
  await expect.poll(() => badge(shop)).toBe('✓');

  // Consent refused, legitimate interest left: an exclamation mark, and the popup explains it.
  const li = await session.context.newPage();
  await li.goto(`http://badgeli.localhost:${fx.port}/onetrust.html?tcf=li`);
  await waitForOutcome(session, 'badgeli.localhost');
  await expect.poll(() => badge(li)).toBe('!');
  const popup = await session.context.newPage();
  await popup.goto(ext(`popup.html?site=${encodeURIComponent(`http://badgeli.localhost:${fx.port}/`)}`));
  await expect(popup.locator('.result')).toContainText('still claims “legitimate interest”');
  await expect(popup.locator('.next')).toContainText('What you can do');
  await expect(popup.locator('.next')).toContainText('switch off “legitimate interest”');

  // Pausing from the popup changes the mark on the open tab.
  await popup.getByRole('button', { name: 'Pause on this site' }).click();
  await expect.poll(() => badge(li)).toBe('II');

  // A page with no known banner: no mark.
  const plain = await session.context.newPage();
  await plain.goto(`http://badgenone.localhost:${fx.port}/unknown.html`);
  await plain.waitForTimeout(3000);
  expect(await badge(plain)).toBe('');
});

test('settings warn that allowing some purposes by default will read as "partly done" on most sites', async () => {
  const page = await session.context.newPage();
  await page.goto(ext('options.html'));
  await expect(page.locator('#defaults-mixed')).toHaveCount(0);
  await purpose(page, 'Preferences').getByLabel('Allow', { exact: true }).check();
  await expect(page.locator('#defaults-mixed')).toContainText('You allow Preferences by default');
  await expect(page.locator('#defaults-mixed')).toContainText('Partly done');
  await purpose(page, 'Preferences').getByLabel('Refuse', { exact: true }).check();
  await expect(page.locator('#defaults-mixed')).toHaveCount(0);
  // Allowing everything gets its own warning: accept can only be pressed on a few consent tools.
  for (const name of ['Storage and access', 'Preferences', 'Analytics', 'Content', 'Advertising', 'Other purposes']) await purpose(page, name).getByLabel('Allow', { exact: true }).check();
  await expect(page.locator('#defaults-all')).toContainText('On most sites it will click nothing');
  // The settings and the welcome page carry the brand header.
  await expect(page.getByRole('img', { name: 'Pievra' })).toBeVisible();
  await page.goto(ext('onboarding.html'));
  await expect(page.getByRole('img', { name: 'Pievra' })).toBeVisible();
});
