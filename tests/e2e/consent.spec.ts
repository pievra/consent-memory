/// <reference types="chrome" />
import { expect, test } from '@playwright/test';
import { clicks, launch, readStore, seed, siteRecord, startServer, stopServiceWorker, waitForFirstStart, waitForOutcome, type FixtureServer, type Session } from './harness';

let fx: FixtureServer;
let session: Session;
const url = (host: string, page: string) => `http://${host}.localhost:${fx.port}/${page}`;

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

test('refuses by default on a recognised CMP and verifies what the CMP stored', async () => {
  const page = await session.context.newPage();
  await page.goto(url('shop', 'onetrust.html'));
  const record = await waitForOutcome(session, 'shop.localhost');

  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(await page.locator('#onetrust-banner-sdk').count()).toBe(0);
  expect(record).toMatchObject({ status: 'verified', cmp: 'Onetrust', engine: 'autoconsent', paused: false, unfulfilled: [] });
  expect(record.evidenceSummary).toContain('cmp_self_test: confirms — CMP reports the refusal as stored');
  expect(record.lastVerified).toBeTruthy();
  expect(Object.values(record.choices as Record<string, string>)).toEqual(Array(6).fill('refuse'));
  expect(Object.values(record.setBy as Record<string, string>)).toEqual(Array(6).fill('default'));
});

test('does not report success when the CMP hides the banner but forgets the refusal', async () => {
  const page = await session.context.newPage();
  await page.goto(url('forgetful', 'onetrust.html?forget=1'));
  const record = await waitForOutcome(session, 'forgetful.localhost');

  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(await page.locator('#onetrust-banner-sdk').count()).toBe(0); // the banner is gone...
  expect(record.status).toBe('failed'); // ...and that is not treated as success
  expect(record.lastVerified).toBeUndefined();
});

test('reports partial when TCF legitimate interest remains declared after refusal', async () => {
  const page = await session.context.newPage();
  await page.goto(url('tcf', 'onetrust.html?tcf=li'));
  const record = await waitForOutcome(session, 'tcf.localhost');

  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(record.status).toBe('partial');
  expect(record.evidenceSummary).toContain('tcf_read: partial — TCF consent refused; legitimate interest still declared for 4 purposes');
});

test('clicks nothing on an unrecognised banner and remembers nothing about the site', async () => {
  const page = await session.context.newPage();
  await page.goto(url('news', 'unknown.html'));
  await page.waitForTimeout(6000); // longer than the engine's detection window

  expect(await clicks(page)).toEqual({ accept: 0, reject: 0, any: 0 });
  expect(await page.locator('#cookie-notice').isVisible()).toBe(true);
  expect(fx.hits).not.toContain('/purchase');
  const store = await readStore(session);
  expect(Object.keys(store).filter((k) => k.startsWith('site:'))).toEqual([]);
});

test('leaves a page alone when a password field is filled', async () => {
  const page = await session.context.newPage();
  await page.goto(url('bank', 'onetrust.html?login=1'));
  const record = await waitForOutcome(session, 'bank.localhost');

  expect(record.status).toBe('skipped');
  expect(record.evidenceSummary).toEqual(['reason: unsafe_context']);
  expect(await clicks(page)).toEqual({ accept: 0, reject: 0 });
  expect(await page.locator('#pw').inputValue()).toBe('hunter2');
  expect(fx.hits).not.toContain('/submitted');
});

test('keeps the record across a browser restart and a second visit without a banner', async () => {
  const first = await session.context.newPage();
  await first.goto(url('return', 'onetrust.html'));
  const before = await waitForOutcome(session, 'return.localhost');
  expect(before.status).toBe('verified');
  const profile = session.profile;
  await session.context.close();

  session = await launch(profile);
  const page = await session.context.newPage();
  await page.goto(url('return', 'onetrust.html'));
  await page.waitForTimeout(4000);
  expect(await page.locator('#onetrust-banner-sdk').isVisible()).toBe(false); // the site remembered the refusal
  expect(await clicks(page)).toEqual({ accept: 0, reject: 0 });
  const after = (await readStore(session))['site:return.localhost'];
  expect(after).toEqual(before);
});

test('does not act on a banner inside a frame from another site, and records nothing for the page', async () => {
  // Autoconsent runs this CMP's rule in the top frame only. Frame specific rules exist for other CMPs;
  // what such a frame may report about the page is limited in applyReport and covered by unit tests.
  const page = await session.context.newPage();
  const framed = encodeURIComponent(url('adnetwork', 'onetrust.html'));
  await page.goto(url('publisher', `frame-host.html?src=${framed}`));
  await page.waitForTimeout(6000);

  const frame = page.frames().find((f) => f.url().startsWith('http://adnetwork.localhost'));
  expect(frame).toBeTruthy();
  expect(await frame!.evaluate(() => (window as unknown as { __clicks: Record<string, number> }).__clicks)).toEqual({ accept: 0, reject: 0 });
  const store = await readStore(session);
  expect(Object.keys(store).filter((k) => k.startsWith('site:'))).toEqual([]);
});

test('requests only the reviewed permissions and stores nothing in sync storage', async () => {
  const info = await session.worker.evaluate(async () => ({
    permissions: (await chrome.permissions.getAll()).permissions?.sort(),
    origins: (await chrome.permissions.getAll()).origins?.sort(),
    sync: await chrome.storage.sync.get(null),
  }));
  expect(info.permissions).toEqual(['declarativeNetRequestWithHostAccess', 'scripting', 'storage', 'webRequest']);
  expect(info.origins).toEqual(['http://*/*', 'https://*/*']);
  expect(info.sync).toEqual({});
});

const ALL = ['storage', 'preferences', 'analytics', 'content', 'advertising', 'other'];

test('refuses and verifies on a second CMP family whose detection and check run through the page API', async () => {
  const page = await session.context.newPage();
  await page.goto(url('travel', 'cookiebot.html'));
  const record = await waitForOutcome(session, 'travel.localhost');

  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(record).toMatchObject({ status: 'verified', cmp: 'Cybotcookiebot' });
  expect(await page.evaluate(() => (window as unknown as { Cookiebot: { declined: boolean; consented: boolean } }).Cookiebot)).toMatchObject({ declined: true, consented: false });
});

test('accepts only when the user allowed all six purposes, and does not call that verified without evidence', async () => {
  await seed(session, { 'site:optin.localhost': siteRecord('optin.localhost', ALL) });
  const page = await session.context.newPage();
  await page.goto(url('optin', 'onetrust.html'));
  const record = await waitForOutcome(session, 'optin.localhost');

  expect(await clicks(page)).toEqual({ accept: 1, reject: 0 });
  expect(record.status).toBe('inconclusive'); // no source confirms what the CMP stored after an opt in
  expect(record.lastVerified).toBeUndefined();
  expect(record.choices).toEqual(Object.fromEntries(ALL.map((p) => [p, 'allow']))); // user choices untouched
});

test('refuses everything when five of six purposes are allowed, and reports partial', async () => {
  const five = ALL.filter((p) => p !== 'advertising');
  await seed(session, { 'site:mixed.localhost': siteRecord('mixed.localhost', five) });
  const page = await session.context.newPage();
  await page.goto(url('mixed', 'onetrust.html'));
  const record = await waitForOutcome(session, 'mixed.localhost');

  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(record.status).toBe('partial');
  expect(record.unfulfilled).toEqual(five);
});

test('does nothing on a paused site', async () => {
  await seed(session, { 'site:paused.localhost': { ...siteRecord('paused.localhost', []), paused: true } });
  const page = await session.context.newPage();
  await page.goto(url('paused', 'onetrust.html'));
  await page.waitForTimeout(5000);

  expect(await clicks(page)).toEqual({ accept: 0, reject: 0 });
  expect(await page.locator('#onetrust-banner-sdk').isVisible()).toBe(true);
  expect((await readStore(session))['site:paused.localhost']).toMatchObject({ paused: true, status: 'not_detected' });
});

test('makes no network request of its own during a full run', async () => {
  const fromExtension: string[] = [];
  session.context.on('request', (request) => {
    const initiator = request.serviceWorker()?.url() ?? request.frame().url();
    if (initiator.startsWith('chrome-extension://') && !request.url().startsWith('chrome-extension://')) fromExtension.push(request.url());
  });
  const before = fx.hits.length;
  const page = await session.context.newPage();
  await page.goto(url('quiet', 'onetrust.html'));
  await waitForOutcome(session, 'quiet.localhost');
  const popup = await session.context.newPage();
  await popup.goto(`chrome-extension://${session.extensionId}/popup.html`);
  await popup.waitForTimeout(1000);

  expect(fromExtension).toEqual([]);
  // The only requests the fixture server saw are the page itself and the browser's own favicon lookup.
  expect(fx.hits.slice(before).filter((h) => h !== '/favicon.ico')).toEqual(['/onetrust.html']);
});

test('completes a run when the service worker is stopped before the visit and again during it', async () => {
  const page = await session.context.newPage();
  await page.goto('about:blank');
  await waitForFirstStart(session);
  expect(await stopServiceWorker(session, page)).toBe(1);

  await page.goto(url('restart', 'onetrust.html'));
  // Stop the worker three more times across the run (around the click, the check and the report).
  // Stopping it every 150 ms for two seconds was also tried: about 1 run in 5 then never starts,
  // clicks nothing and records nothing, which is the intended fail safe.
  for (const pause of [250, 600, 900]) {
    await page.waitForTimeout(pause);
    await stopServiceWorker(session, page);
  }

  const record = await waitForOutcome(session, 'restart.localhost');
  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(record).toMatchObject({ status: 'verified', cmp: 'Onetrust' });
});

test('results page lists handled sites and downloads them as a file, without writing or sending anything', async () => {
  const page = await session.context.newPage();
  await page.goto(url('listed', 'onetrust.html'));
  await waitForOutcome(session, 'listed.localhost');
  const before = await readStore(session);

  const results = await session.context.newPage();
  await results.goto(`chrome-extension://${session.extensionId}/results.html`);
  const row = results.locator('tbody tr', { hasText: 'listed.localhost' });
  await expect(row).toContainText('Refused and confirmed');
  await expect(row).toContainText('OneTrust');
  await expect(results.locator('#summary')).toHaveText('1 sites recorded · 1 verified');

  const downloadFile = async (button: string, name: RegExp) => {
    const [file] = await Promise.all([results.waitForEvent('download'), results.getByRole('button', { name: button, exact: true }).click()]);
    expect(file.suggestedFilename()).toMatch(name);
    const stream = await file.createReadStream();
    let text = '';
    for await (const chunk of stream) text += chunk;
    return { text, exported: JSON.parse(text) as { format: string; siteNames: string; timeZone?: string; sites: Array<{ domain: string; status: string }> } };
  };
  // One button for each kind of file, each saying what it contains. Without names, the file does not show where the user has been.
  const redacted = await downloadFile('Download without site names', /^pievra-results-\d{4}-\d{2}-\d{2}-no-site-names\.json$/);
  expect(redacted.exported.format).toBe('consent-memory-test-results');
  expect(redacted.exported.siteNames).toBe('removed');
  expect(redacted.exported.sites.map((s) => [s.domain, s.status])).toEqual([['site-1', 'verified']]);
  expect(redacted.text).not.toContain('listed.localhost');
  expect(redacted.exported.timeZone).toBeUndefined();
  // Site names are included only through the button that says so.
  const named = await downloadFile('Download with site names', /^pievra-results-\d{4}-\d{2}-\d{2}\.json$/);
  expect(named.exported.siteNames).toBe('included');
  expect(named.exported.sites.map((s) => [s.domain, s.status])).toEqual([['listed.localhost', 'verified']]);
  expect(await readStore(session)).toEqual(before);
});

test('does not call it verified when the rule can only see that the banner closed', async () => {
  const page = await session.context.newPage();
  await page.goto(url('school', 'visibility-only.html'));
  const record = await waitForOutcome(session, 'school.localhost');

  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(await page.locator('#binogi_cookie_notice').count()).toBe(0); // the banner did close
  expect(record.status).toBe('inconclusive');
  expect(record.lastVerified).toBeUndefined();
  expect(record.evidenceSummary).toEqual(['cmp_self_test: unavailable — Banner closed; this banner product gives no way to read what was stored']);
});

test('checks the result on the next page load when the site reloads itself after the refusal', async () => {
  const page = await session.context.newPage();
  await page.goto(url('reloader', 'onetrust.html?reload=1'));
  const record = await waitForOutcome(session, 'reloader.localhost');

  expect(record).toMatchObject({ status: 'verified', cmp: 'Onetrust' });
  expect(record.evidenceSummary).toContain('cmp_self_test: confirms — CMP reports the refusal as stored');
  expect(await clicks(page)).toEqual({ accept: 0, reject: 0 }); // nothing was clicked on the reloaded page
  expect(await page.locator('#onetrust-banner-sdk').isVisible()).toBe(false);
});

test('an "accept or pay" wall is left alone and reported as such, never as "no banner open"', async () => {
  // The site's own message frame offers only "accept all" or "subscribe".
  const page = await session.context.newPage();
  const framed = encodeURIComponent(url('paper', 'index.html?message_id=1'));
  await page.goto(url('paper', `frame-host.html?src=${framed}`));
  await expect.poll(async () => (await readStore(session))['site:paper.localhost'], { timeout: 20_000 }).toMatchObject({ status: 'detected', cmp: 'Sourcepoint-frame', wallSeenAt: expect.any(String) });
  const frame = page.frames().find((f) => f !== page.mainFrame() && f.url().includes('message_id'))!;
  expect(await frame.evaluate(() => (window as unknown as { __clicks: Record<string, number> }).__clicks)).toEqual({ accept: 0, pay: 0 });
  const record = (await readStore(session))['site:paper.localhost'] as Record<string, unknown>;
  expect(record.lastAttempted).toBeUndefined();
  expect(record.lastVerified).toBeUndefined();

  const popup = await session.context.newPage();
  await popup.goto(`chrome-extension://${session.extensionId}/popup.html?site=${encodeURIComponent(url('paper', ''))}`);
  await expect(popup.locator('.result')).toContainText('Accept or pay: your choice');
  await expect(popup.locator('.result')).toContainText('never accepts on your behalf');
  await expect(popup.locator('.result')).not.toContainText('No banner open');
});

test('a wall shown by a frame from another site says nothing about the page', async () => {
  const page = await session.context.newPage();
  const framed = encodeURIComponent(url('adwall', 'index.html?message_id=1'));
  await page.goto(url('gazette', `frame-host.html?src=${framed}`));
  await page.waitForTimeout(14_000);
  expect((await readStore(session))['site:gazette.localhost']).toBeUndefined();
});

const objections = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __objections: number }).__objections);

test('objects to legitimate interest as part of a refusal where the consent tool documents how, and verifies it from the page state', async () => {
  const page = await session.context.newPage();
  await page.goto(url('journal', 'didomi.html'));
  const record = await waitForOutcome(session, 'journal.localhost');
  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(await objections(page)).toBe(1);
  expect(record.status).toBe('verified');
  expect(record.evidenceSummary).toContain('tcf_read: confirms — TCF consent and legitimate interest refused for all purposes');
});

test('an objection that changes nothing is not believed: the result stays partial', async () => {
  const page = await session.context.newPage();
  await page.goto(url('deaf', 'didomi.html?deaf'));
  const record = await waitForOutcome(session, 'deaf.localhost');
  expect(await clicks(page)).toEqual({ accept: 0, reject: 1 });
  expect(record.status).toBe('partial');
  expect(record.evidenceSummary).toContain('tcf_read: partial — TCF consent refused; legitimate interest still declared for 6 purposes');
});

test('no objection is made on a paused site, even if a frame asks for one', async () => {
  await seed(session, { 'site:resting.localhost': { ...siteRecord('resting.localhost', []), paused: true } });
  const page = await session.context.newPage();
  await page.goto(url('resting', 'didomi.html'));
  await page.waitForTimeout(6000);
  expect(await clicks(page)).toEqual({ accept: 0, reject: 0 });
  expect(await objections(page)).toBe(0);
});

test('no objection is made when the user allowed everything', async () => {
  await seed(session, { 'site:allin.localhost': siteRecord('allin.localhost', ALL) });
  const page = await session.context.newPage();
  await page.goto(url('allin', 'didomi.html'));
  const record = await waitForOutcome(session, 'allin.localhost');
  await page.waitForTimeout(2000);
  expect(await objections(page)).toBe(0);
  expect((await clicks(page)).reject).toBe(0);
  // The bundled rule format carries no accept steps for this consent tool: nothing is clicked
  // and the popup says so (see docs/qa/gap-analysis.md).
  expect((await clicks(page)).accept).toBe(0);
  expect(record.status).toBe('inconclusive');
  expect(record.evidenceSummary).toEqual(['reason: no_accept_route']);
  const popup = await session.context.newPage();
  await popup.goto(`chrome-extension://${session.extensionId}/popup.html?site=${encodeURIComponent(url('allin', ''))}`);
  await expect(popup.locator('.result')).toContainText('Not accepted: over to you');
  await expect(popup.locator('.result')).not.toContainText('Applied');
  await expect(popup.locator('.next')).toContainText('Answer the banner yourself');
});
