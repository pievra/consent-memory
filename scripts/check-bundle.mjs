// Inspects the built extension: reviewed permissions only, no network or dynamic code APIs.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = '.output/chrome-mv3';
const failures = [];

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const expect = (name, actual, wanted) => {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) failures.push(`${name}: expected ${JSON.stringify(wanted)}, found ${JSON.stringify(actual)}`);
};
expect('permissions', manifest.permissions, ['storage', 'scripting', 'declarativeNetRequestWithHostAccess', 'webRequest']);
expect('host_permissions', manifest.host_permissions, ['http://*/*', 'https://*/*']);
expect('name', manifest.name, 'Pievra: Consent Memory');
expect('default_locale', manifest.default_locale, 'en');
for (const locale of ['en', 'fr']) {
  const message = JSON.parse(readFileSync(join(root, '_locales', locale, 'messages.json'), 'utf8')).extDescription?.message ?? '';
  if (message.length === 0 || message.length > 132) failures.push(`_locales/${locale}: description must be 1 to 132 characters, found ${message.length}`);
}
if (/\{\{|\}\}/.test(JSON.stringify(manifest))) failures.push('manifest still contains a placeholder');
expect('optional_permissions', manifest.optional_permissions ?? [], []);
expect('web_accessible_resources', manifest.web_accessible_resources ?? [], []);
expect('externally_connectable', manifest.externally_connectable ?? null, null);
expect('extension_pages CSP', manifest.content_security_policy?.extension_pages, "script-src 'self'; object-src 'self'; connect-src 'none'");

const banned = [
  ['fetch(', /(?<![\w.$])fetch\s*\(/g],
  ['XMLHttpRequest', /XMLHttpRequest/g],
  ['WebSocket', /\bWebSocket\b/g],
  ['EventSource', /\bEventSource\b/g],
  ['sendBeacon', /sendBeacon/g],
  ['importScripts', /importScripts\s*\(/g],
  ['eval(', /(?<![\w.$])eval\s*\(/g],
  ['Function constructor', /(?<![\w.$])Function\s*\(/g],
  ['string timer', /set(?:Timeout|Interval)\s*\(\s*["'`]/g],
  ['storage.sync', /storage\.sync/g],
];
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
let total = 0;
for (const file of walk(root)) {
  total += statSync(file).size;
  if (!/\.(js|html)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const [name, pattern] of banned) {
    const hits = text.match(pattern);
    if (hits) failures.push(`${file}: ${hits.length} × ${name}`);
  }
}
console.log(`bundle size: ${(total / 1024).toFixed(1)} kB (target below 2048 kB)`);
if (failures.length) {
  console.error('FAIL\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
console.log('OK: permissions match the reviewed list; no network or dynamic code APIs in the bundle');
