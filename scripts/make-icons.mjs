// Renders assets/icon.svg to the PNG sizes the manifest needs. Run by hand when the icon changes:
// CHROMIUM_PATH=/path/to/chrome node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('assets/icon.svg', 'utf8');
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
  await page.close();
}
await browser.close();
