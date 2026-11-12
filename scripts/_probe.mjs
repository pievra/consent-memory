import { chromium } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const ext = resolve('.output/chrome-mv3');
const out = process.argv[2];
const sites = process.argv.slice(3);
for (const url of sites) {
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'pv-')), { executablePath: process.env.CHROMIUM_PATH, headless: true, locale: 'en-GB',
    args: ['--no-sandbox', '--headless=new', '--lang=en-GB', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`], viewport: { width: 1366, height: 850 } });
  try {
    const w = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const id = new URL(w.url()).host;
    const store = await ctx.newPage(); await store.goto(`chrome-extension://${id}/popup.html`);
    const page = await ctx.newPage();
    let status = null; try { status = (await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }))?.status(); } catch (e) { status = String(e.message).split('\n')[0]; }
    await page.bringToFront(); await page.waitForTimeout(14000);
    const host = new URL(url).hostname.replace(/^www\./, '');
    console.log(`\n=== ${url} http=${status} title=${(await page.title().catch(()=>'')).slice(0,60)}`);
    for (const f of page.frames()) {
      const info = await f.evaluate(() => {
        const q = (s) => document.querySelectorAll(s).length;
        const btns = [...document.querySelectorAll('button,[role=button],a.sp_choice_type_9,a[class*=choice]')].filter(b => b.offsetParent !== null).map(b => `${(b.className||'').toString().slice(0,60)}|${(b.textContent||'').trim().slice(0,40)}`).slice(0, 14);
        return { sp: [...new Set([...document.querySelectorAll('[class*=sp_choice_type_]')].map(e => [...e.classList].filter(c => c.startsWith('sp_choice_type_')).join(',')))], btns, didomi: q('#didomi-host,#didomi-popup'), appconsent: q('#appconsent,[id*=appconsent]'), ot: q('#onetrust-banner-sdk') };
      }).catch(() => null);
      if (info && (info.sp.length || info.btns.length && (f !== page.mainFrame() ? true : info.didomi + info.appconsent + info.ot > 0))) console.log(' frame', f.url().slice(0, 90), JSON.stringify(info));
    }
    const all = await store.evaluate(() => chrome.storage.local.get(null));
    console.log(' records', JSON.stringify(Object.entries(all).filter(([k]) => k.startsWith('site:')).map(([, v]) => ({ d: v.domain, s: v.status, cmp: v.cmp }))));
    await page.screenshot({ path: `${out}/wall-${host}.png` });
  } catch (e) { console.log(' ERR', String(e.message).split('\n')[0]); }
  await ctx.close();
}
