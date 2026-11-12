// Renders the Chrome Web Store screenshots (1280 x 800) and the small promotional tile (440 x 280)
// from the built extension, with sample records. Run by hand when the interface changes:
// CHROMIUM_PATH=/path/to/chrome node scripts/make-store-assets.mjs <outDir>
// The sites named are examples of the result kinds, seeded here; they are not measurements.
import { chromium } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'store-assets');
mkdirSync(out, { recursive: true });
const ext = resolve('.output/chrome-mv3');
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'pv-')), {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, locale: 'en-GB', deviceScaleFactor: 1,
  args: ['--no-sandbox', '--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`], viewport: { width: 1280, height: 800 },
});
const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const id = new URL(worker.url()).host;
const page = await ctx.newPage();
await page.goto(`chrome-extension://${id}/options.html`);
await page.waitForTimeout(800);
const P = ['storage', 'preferences', 'analytics', 'content', 'advertising', 'other'];
const now = new Date().toISOString();
const rec = (domain, status, cmp, extra = {}) => ({ domain, cmp, engine: 'autoconsent', cmpRuleVersion: '18.1.0', choices: Object.fromEntries(P.map((p) => [p, 'refuse'])), setBy: Object.fromEntries(P.map((p) => [p, 'default'])), status, paused: false, mappingVersion: 2, schemaVersion: 1, lastAttempted: now, attemptOrigin: 'site', unfulfilled: [], evidenceSummary: [], ...extra });
const audit = { schemaVersion: 1, trackerListVersion: '2026.11.2', trackersKnown: 65, observedAt: now.slice(0, 13) + ':00:00.000Z', checks: [
  { check: 'tracking_before_consent', outcome: 'passed' }, { check: 'tracking_after_refusal', outcome: 'signal_detected', services: ['doubleclick.net', 'googlesyndication.com'], count: 2 },
  { check: 'refusal_accessibility', outcome: 'passed', count: 1 }, { check: 'optional_purposes_preselected', outcome: 'passed', count: 0 }, { check: 'consent_information_available', outcome: 'passed' }, { check: 'gpc_behaviour', outcome: 'not_applicable' }] };
const records = [
  rec('example-shop.co.uk', 'verified', 'Onetrust', { lastVerified: now, evidenceSummary: ['cmp_self_test: confirms — CMP reports the refusal as stored', 'tcf_read: confirms — TCF consent and legitimate interest refused for all purposes'], audit }),
  rec('example-news.co.uk', 'partial', 'quantcast', { evidenceSummary: ['tcf_read: partial — TCF consent refused; legitimate interest still declared for 6 purposes'] }),
  rec('example-daily.com', 'detected', 'Sourcepoint-frame', { wallSeenAt: now, lastAttempted: undefined, attemptOrigin: undefined }),
  rec('example-travel.fr', 'verified', 'didomi', { lastVerified: now, evidenceSummary: ['cmp_self_test: confirms — CMP reports the refusal as stored', 'tcf_read: confirms — TCF consent and legitimate interest refused for all purposes'] }),
  rec('example-store.com', 'verified', 'Cybotcookiebot', { lastVerified: now, evidenceSummary: ['cmp_state_read: confirms — CMP reports your choice for each of its 3 purposes'] }),
  rec('example-grocer.co.uk', 'attempted', 'tesco'),
].map((r) => JSON.parse(JSON.stringify(r)));
await page.evaluate(async (r) => { await chrome.storage.local.set(Object.fromEntries(r.map((x) => ['site:' + x.domain, x]))); }, records);

const shot = async (url, width, height, clipHeight) => {
  await page.setViewportSize({ width, height });
  await page.goto(`chrome-extension://${id}/${url}`);
  await page.waitForTimeout(700);
  const buffer = await page.screenshot(clipHeight ? { clip: { x: 0, y: 0, width, height: clipHeight } } : { fullPage: true });
  return `data:image/png;base64,${buffer.toString('base64')}`;
};
const popup = (site) => shot(`popup.html?site=https://${site}/`, 380, 600);
const images = {
  verified: await popup('example-shop.co.uk'),
  partial: await popup('example-news.co.uk'),
  wall: await popup('example-daily.com'),
  settings: await shot('options.html', 1040, 800),
  welcome: await shot('onboarding.html', 760, 800, 900),
};
// The settings shot is cropped to the sites table.
await page.setViewportSize({ width: 1040, height: 800 });
await page.goto(`chrome-extension://${id}/options.html`); await page.waitForTimeout(700);
images.sites = `data:image/png;base64,${(await page.locator('section', { has: page.locator('table') }).screenshot()).toString('base64')}`;

const icon = `data:image/svg+xml;base64,${Buffer.from(readFileSync('assets/icon.svg')).toString('base64')}`;
const css = `*{box-sizing:border-box}html,body{margin:0}body{width:1280px;height:800px;background:#FEFDFB;color:#18181B;font:20px/1.5 ui-sans-serif,system-ui,sans-serif;display:grid;grid-template-columns:1fr auto;gap:64px;align-items:center;padding:64px 80px;overflow:hidden}
h1{font:600 52px/1.1 ui-serif,Georgia,serif;letter-spacing:-0.02em;margin:0 0 24px}p{margin:0 0 16px;color:#52525B;max-width:30ch;font-size:22px}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:40px;font:italic 30px ui-serif,Georgia,serif}.brand img{width:40px;height:40px}.brand b{color:#F97316;font-weight:400}
.frame{border:1px solid #E4E4E7;border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(24,24,27,.14);background:#fff;max-height:672px}.frame img{display:block}
body.wide{display:block;padding:48px 80px}body.wide h1{font-size:44px;margin:0 0 12px}body.wide p{max-width:none;margin:0 0 28px}body.wide .brand{margin-bottom:24px}body.wide .frame{max-height:none;padding:20px 24px 0;background:#fbfaf7;width:fit-content}`;
const side = (title, text, img, width) => `<style>${css}</style><div><div class="brand"><img src="${icon}"><span>pievra<b>.</b></span></div><h1>${title}</h1>${text.map((t) => `<p>${t}</p>`).join('')}</div><div class="frame"><img src="${img}" width="${width}"></div>`;
const wide = (title, text, img) => `<style>${css}</style><body class="wide"><div class="brand"><img src="${icon}"><span>pievra<b>.</b></span></div><h1>${title}</h1><p>${text}</p><div class="frame"><img src="${img}"></div></body>`;
const compositions = {
  '1-refused-and-confirmed': side('Cookie banners refused for you, then checked.', ['Pievra presses “refuse”, then asks the site’s consent tool what it stored.', '“Confirmed” appears only when the site says so.'], images.verified, 420),
  '2-honest-when-partly-done': side('It tells you when a refusal is only partly done.', ['Some sites keep “legitimate interest” after you refuse.', 'Pievra says so, and what you can do.'], images.partial, 420),
  '3-accept-or-pay': side('It never accepts or pays for you.', ['On “accept or pay” walls, Pievra clicks nothing and leaves the choice to you.'], images.wall, 420),
  '4-every-site-remembered': wide('Every site remembered, with the evidence.', 'Stored in your browser only. No account, no server, nothing sent.', images.sites),
  '5-what-it-does': side('Clear about what it does and does not do.', ['Free and open source.', 'Your choices stay on your device.'], images.welcome, 560),
};
await page.setViewportSize({ width: 1280, height: 800 });
for (const [name, html] of Object.entries(compositions)) {
  await page.setContent(html); await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `screenshot-${name}.png`), clip: { x: 0, y: 0, width: 1280, height: 800 } });
}
await page.setViewportSize({ width: 440, height: 280 });
await page.setContent(`<style>html,body{margin:0}body{width:440px;height:280px;background:#FEFDFB;color:#18181B;display:grid;place-content:center;justify-items:center;gap:14px;font:17px/1.35 ui-sans-serif,system-ui,sans-serif;text-align:center}.b{display:flex;align-items:center;gap:12px;font:italic 44px ui-serif,Georgia,serif}.b img{width:56px;height:56px}.b b{color:#F97316;font-weight:400}p{margin:0;color:#52525B;max-width:26ch}</style><div class="b"><img src="${icon}"><span>pievra<b>.</b></span></div><p>Cookie banners refused for you, then checked.</p>`);
await page.screenshot({ path: join(out, 'promo-tile-440x280.png'), clip: { x: 0, y: 0, width: 440, height: 280 } });
await ctx.close();
console.log('written to', out);
