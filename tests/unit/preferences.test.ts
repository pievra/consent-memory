import { describe, expect, it } from 'vitest';
import { isOwnExtensionPage, parseUiRequest } from '../../src/adapters/shared/ui-messages';
import { MAX_SITE_RECORDS, SITE_EVICTION_BATCH } from '../../src/config/constants';
import { PURPOSES } from '../../src/core/consent/purposes';
import { resolvePreferences } from '../../src/core/consent/resolver';
import { en } from '../../src/locales/en';
import { fr } from '../../src/locales/fr';
import { applyReport } from '../../src/storage/apply-report';
import { Repository } from '../../src/storage/repository';
import { EXPORT_FORMAT, KEY, siteRecordSchema } from '../../src/storage/schema';
import { FIXED_NOW, MemoryStorage } from './helpers';

const open = async () => {
  const port = new MemoryStorage();
  const repo = new Repository(port, FIXED_NOW);
  await repo.init();
  return { repo, port };
};
const keys = (site: string) => ({ host: site, site });
const verifiedRecord = (domain: string) =>
  applyReport(null, domain, { type: 'page:report', state: 'VERIFIED', cmp: 'Onetrust', attempts: 1, unfulfilled: [], evidence: [{ kind: 'cmp_self_test', outcome: 'confirms' }] }, '1', FIXED_NOW(), true)!;

describe('site choices and pause', () => {
  it('a site choice overrides the default, and clearing it returns to the default', async () => {
    const { repo } = await open();
    await repo.setGlobalChoice('preferences', 'allow');
    await repo.setSiteChoice('example.com', 'preferences', 'refuse');
    await repo.setSiteChoice('example.com', 'content', 'allow');
    let r = resolvePreferences(await repo.resolverInput(keys('example.com')));
    if (r.paused) throw new Error('paused');
    expect([r.choices.preferences, r.sources.preferences]).toEqual(['refuse', 'site']);
    expect([r.choices.content, r.sources.content]).toEqual(['allow', 'site']);
    await repo.setSiteChoice('example.com', 'preferences', null);
    r = resolvePreferences(await repo.resolverInput(keys('example.com')));
    if (r.paused) throw new Error('paused');
    expect([r.choices.preferences, r.sources.preferences]).toEqual(['allow', 'global']);
  });
  it('pausing keeps choices and results', async () => {
    const { repo } = await open();
    await repo.updateSite('example.com', () => verifiedRecord('example.com'));
    await repo.setSiteChoice('example.com', 'content', 'allow');
    const paused = await repo.setPaused('example.com', true);
    expect(paused).toMatchObject({ paused: true, status: 'verified' });
    expect(paused!.choices.content).toBe('allow');
    expect(resolvePreferences(await repo.resolverInput(keys('example.com')))).toEqual({ paused: true });
    expect((await repo.setPaused('example.com', false))!.paused).toBe(false);
  });
});

describe('bulk operations', () => {
  it('forget returns what it removed and restore puts it back exactly', async () => {
    const { repo } = await open();
    for (const d of ['a.example', 'b.example', 'c.example']) await repo.updateSite(d, () => verifiedRecord(d));
    const before = await repo.listSites();
    const removed = await repo.forgetSites(['a.example', 'c.example', 'missing.example']);
    expect(removed.map((r) => r.domain)).toEqual(['a.example', 'c.example']);
    expect((await repo.listSites()).map((r) => r.domain)).toEqual(['b.example']);
    expect(await repo.restoreSites([...removed, { junk: true }])).toBe(2);
    expect(await repo.listSites()).toEqual(before);
  });
  it('refuse everywhere previews without writing, then changes defaults and site choices only where something was allowed', async () => {
    const { repo, port } = await open();
    await repo.setGlobalChoice('analytics', 'allow');
    await repo.setSiteChoice('a.example', 'analytics', 'allow');
    await repo.setSiteChoice('a.example', 'content', 'allow');
    await repo.setSiteChoice('b.example', 'advertising', 'refuse');
    const writes = port.writes;
    expect(await repo.refuseEverywhere(['analytics'], true)).toEqual({ sites: 1, defaults: 1 });
    expect(port.writes).toBe(writes);
    expect(await repo.refuseEverywhere(['analytics'], false)).toEqual({ sites: 1, defaults: 1 });
    expect((await repo.getSettings()).globalChoices.analytics).toBe('refuse');
    const a = (await repo.getSite('a.example'))!;
    expect([a.choices.analytics, a.setBy.analytics, a.choices.content]).toEqual(['refuse', 'default', 'allow']);
    expect(await repo.refuseEverywhere([...PURPOSES], false)).toEqual({ sites: 1, defaults: 0 });
    expect(await repo.refuseEverywhere([...PURPOSES], true)).toEqual({ sites: 0, defaults: 0 });
  });
  it('delete all removes choices and results and keeps the store usable', async () => {
    const { repo, port } = await open();
    await repo.setGlobalChoice('other', 'allow');
    await repo.updateSite('a.example', () => verifiedRecord('a.example'));
    expect(await repo.deleteAll()).toBe(1);
    expect([...port.data.keys()]).toEqual([KEY.meta]);
    await repo.setSiteChoice('b.example', 'other', 'allow');
    expect((await repo.listSites()).length).toBe(1);
  });
});

describe('import', () => {
  const allRefuse = Object.fromEntries(PURPOSES.map((p) => [p, 'refuse']));
  const allDefault = Object.fromEntries(PURPOSES.map((p) => [p, 'default']));
  const entry = (domain: string, over: object = {}) => ({ domain, choices: allRefuse, setBy: allDefault, paused: false, ...over });
  const file = (sites: unknown[], extra: object = {}) => ({ format: EXPORT_FORMAT, formatVersion: 1, sites, ...extra });

  it('rejects files that are not exports, without writing', async () => {
    const { repo, port } = await open();
    const writes = port.writes;
    for (const bad of [null, 'x', {}, { format: 'other', formatVersion: 1, sites: [] }, file([{ domain: 'https://evil.example/', choices: allRefuse, setBy: allDefault, paused: false }]), file([entry('a.example', { choices: { ...allRefuse, analytics: 'yes' } })]), { ...file([]), formatVersion: 2 }]) {
      expect((await repo.importData(bad, 'take_imported', false)).valid).toBe(false);
    }
    expect(port.writes).toBe(writes);
  });
  it('cannot import a result: status, evidence and dates in the file are ignored', async () => {
    const { repo } = await open();
    const forged = entry('a.example', { status: 'verified', lastVerified: FIXED_NOW().toISOString(), evidenceSummary: ['cmp_self_test: confirms'], cmp: 'Onetrust' });
    expect(await repo.importData(file([forged]), 'take_imported', false)).toMatchObject({ valid: true, added: 1 });
    const stored = (await repo.getSite('a.example'))!;
    expect(stored.status).toBe('not_detected');
    expect(stored.lastVerified).toBeUndefined();
    expect(stored.evidenceSummary).toBeUndefined();
    expect(stored.cmp).toBeUndefined();
    expect(siteRecordSchema.safeParse(stored).success).toBe(true);
  });
  it('previews, then follows the chosen policy and never touches existing results', async () => {
    const { repo, port } = await open();
    await repo.updateSite('same.example', () => verifiedRecord('same.example'));
    await repo.updateSite('differs.example', () => verifiedRecord('differs.example'));
    const incoming = file([entry('same.example'), entry('differs.example', { paused: true, choices: { ...allRefuse, content: 'allow' }, setBy: { ...allDefault, content: 'user' } }), entry('new.example')], { settings: { globalChoices: { ...allRefuse, other: 'allow' }, globalSetBy: { ...allDefault, other: 'user' } } });
    const writes = port.writes;
    expect(await repo.importData(incoming, 'take_imported', true)).toEqual({ valid: true, added: 1, changed: 1, unchanged: 1, skipped: 0, addedAllowing: 0, changedAllowing: 1, defaultsAllowing: ['other'] });
    expect(port.writes).toBe(writes);

    expect(await repo.importData(incoming, 'keep_mine', false)).toMatchObject({ valid: true, added: 1, changed: 0, unchanged: 1, skipped: 1, changedAllowing: 0 });
    expect((await repo.getSite('differs.example'))!.paused).toBe(false);
    expect((await repo.getSettings()).globalChoices.other).toBe('refuse');

    expect(await repo.importData(incoming, 'take_imported', false)).toMatchObject({ changed: 1, added: 0 });
    const differs = (await repo.getSite('differs.example'))!;
    expect(differs).toMatchObject({ paused: true, status: 'verified', cmp: 'Onetrust' });
    expect(differs.choices.content).toBe('allow');
    expect((await repo.getSettings()).globalChoices.other).toBe('allow');
  });
  it('a file with no sites that switches every default to allow is reported, never silent', async () => {
    const { repo } = await open();
    const allAllow = Object.fromEntries(PURPOSES.map((p) => [p, 'allow']));
    const allUser = Object.fromEntries(PURPOSES.map((p) => [p, 'user']));
    const preset = file([entry('new.example', { choices: allAllow, setBy: allUser })], { settings: { globalChoices: allAllow, globalSetBy: allUser } });
    const preview = await repo.importData(preset, 'take_imported', true);
    expect(preview.defaultsAllowing).toEqual([...PURPOSES]);
    expect(preview.addedAllowing).toBe(1);
    // Nothing was written by the preview, and "keep mine" never changes the defaults.
    await repo.importData(preset, 'keep_mine', false);
    expect(Object.values((await repo.getSettings()).globalChoices)).toEqual(PURPOSES.map(() => 'refuse'));
    // Once applied, the same file reports nothing new to allow by default.
    await repo.importData(preset, 'take_imported', false);
    expect((await repo.importData(preset, 'take_imported', true)).defaultsAllowing).toEqual([]);
  });
});

describe('bounded storage', () => {
  it('evicts the oldest records without a user choice once the cap is reached, and keeps user choices and paused sites', async () => {
    const { repo, port } = await open();
    await repo.setSiteChoice('chosen.example', 'analytics', 'allow');
    await repo.setPaused('paused.example', true);
    const seeded: Record<string, unknown> = {};
    for (let i = 0; i < MAX_SITE_RECORDS; i++) {
      const domain = `s${String(i).padStart(5, '0')}.example`;
      seeded[KEY.site(domain)] = { ...verifiedRecord(domain), lastAttempted: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString() };
    }
    await port.set(seeded);
    await repo.updateSite('fresh.example', () => verifiedRecord('fresh.example'));
    const sites = await repo.listSites();
    expect(sites.length).toBe(MAX_SITE_RECORDS + 3 - (SITE_EVICTION_BATCH + 2));
    const domains = new Set(sites.map((s) => s.domain));
    expect(domains.has('chosen.example') && domains.has('paused.example') && domains.has('fresh.example')).toBe(true);
    expect(domains.has('s00000.example')).toBe(false);
    expect(domains.has(`s${String(MAX_SITE_RECORDS - 1).padStart(5, '0')}.example`)).toBe(true);
  });
});

describe('preference API access', () => {
  const ID = 'abcdefghijklmnopabcdefghijklmnop';
  it('accepts only this extension’s own pages', () => {
    expect(isOwnExtensionPage({ id: ID, url: `chrome-extension://${ID}/popup.html` }, ID)).toBe(true);
    expect(isOwnExtensionPage({ id: ID, url: `chrome-extension://${ID}/options.html`, frameId: 0, tab: { id: 3, url: `chrome-extension://${ID}/options.html` } }, ID)).toBe(true);
  });
  it.each([
    ['a content script in a web page', { id: ID, url: 'https://example.com/', frameId: 0, tab: { id: 1, url: 'https://example.com/' } }],
    ['an extension page framed inside a web page', { id: ID, url: `chrome-extension://${ID}/popup.html`, frameId: 4, tab: { id: 1, url: 'https://example.com/' } }],
    ['an extension page in a tab showing a web page', { id: ID, url: `chrome-extension://${ID}/popup.html`, frameId: 0, tab: { id: 1, url: 'https://example.com/' } }],
    ['another extension', { id: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', url: 'chrome-extension://zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz/x.html' }],
    ['a look-alike address', { id: ID, url: `chrome-extension://${ID}.evil.example/popup.html` }],
    ['no address', { id: ID }],
  ])('rejects %s', (_name, sender) => {
    expect(isOwnExtensionPage(sender, ID)).toBe(false);
  });
  it('validates requests strictly', () => {
    expect(parseUiRequest({ type: 'ui:setSiteChoice', domain: 'example.com', purpose: 'content', choice: null })).not.toBeNull();
    expect(parseUiRequest({ type: 'ui:setSiteChoice', domain: 'https://example.com', purpose: 'content', choice: 'allow' })).toBeNull();
    expect(parseUiRequest({ type: 'ui:setSiteChoice', domain: 'example.com', purpose: 'everything', choice: 'allow' })).toBeNull();
    expect(parseUiRequest({ type: 'ui:setGlobalChoice', purpose: 'content', choice: 'yes' })).toBeNull();
    expect(parseUiRequest({ type: 'ui:forget', domains: [] })).toBeNull();
    expect(parseUiRequest({ type: 'ui:deleteAll', confirm: true })).toBeNull();
    expect(parseUiRequest({ type: 'page:init' })).toBeNull();
  });
});

describe('localisation', () => {
  it('French has every English key, no empty text, and the same placeholders', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(fr[key].trim().length, key).toBeGreaterThan(0);
      expect(vars(fr[key]), key).toEqual(vars(en[key]));
    }
  });
  it('uses the decided product name in both languages, with no placeholder left in any text', () => {
    expect(en.appName).toBe('Pievra');
    expect(fr.appName).toBe('Pievra');
    for (const text of [...Object.values(en), ...Object.values(fr)]) expect(text).not.toMatch(/\{\{|\}\}/);
  });
});
