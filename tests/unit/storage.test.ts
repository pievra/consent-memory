import { describe, expect, it } from 'vitest';
import type { ReportRequest } from '../../src/adapters/shared/protocol';
import { isValidSiteKey, siteKeysForUrl } from '../../src/core/domains/site-key';
import { applyReport, applyTopFrameEvidence, applyWall, resumableCmp, topFrameSnapshotFor } from '../../src/storage/apply-report';
import { openStore } from '../../src/storage/migrations';
import { InvalidRecordError, Repository, StoreReadOnlyError } from '../../src/storage/repository';
import { KEY, newSiteRecord, siteRecordSchema, type SiteRecord } from '../../src/storage/schema';
import { WALL_LABEL_MS, isWall } from '../../src/engines/walls';
import { FIXED_NOW, MemoryStorage } from './helpers';

const report = (over: Partial<ReportRequest>): ReportRequest => ({ type: 'page:report', state: 'DETECTED', evidence: [], unfulfilled: [], attempts: 0, ...over });
const verified = report({ state: 'VERIFIED', cmp: 'Onetrust', attempts: 1, evidence: [{ kind: 'cmp_self_test', outcome: 'confirms', detail: 'ok' }] });

describe('site keys', () => {
  it.each([
    ['https://www.example.co.uk/a?b=1', 'www.example.co.uk', 'example.co.uk'],
    ['https://shop.example.com:8443/', 'shop.example.com', 'example.com'],
    ['https://a.github.io/x', 'a.github.io', 'a.github.io'],
    ['http://localhost:3000/', 'localhost', 'localhost'],
    ['http://192.168.1.10/', '192.168.1.10', '192.168.1.10'],
    ['https://intranet/', 'intranet', 'intranet'],
    ['https://BÜCHER.example/', 'xn--bcher-kva.example', 'xn--bcher-kva.example'],
  ])('%s', (url, host, site) => {
    expect(siteKeysForUrl(url)).toEqual({ host, site });
    expect(isValidSiteKey(site)).toBe(true);
  });
  it('keeps sibling private suffix sites apart', () => {
    expect(siteKeysForUrl('https://a.github.io/')?.site).not.toBe(siteKeysForUrl('https://b.github.io/')?.site);
  });
  it.each(['chrome://extensions', 'about:blank', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url', ''])('rejects %s', (url) => {
    expect(siteKeysForUrl(url)).toBeNull();
  });
  it.each(['Example.com', 'example.com/path', 'https://example.com', 'example.com:80', '', 'a..b', '__proto__'])('rejects key %s', (key) => {
    expect(isValidSiteKey(key)).toBe(false);
  });
});

describe('schema', () => {
  const base = () => newSiteRecord('example.com', 1);
  it('accepts a new record and rejects unknown keys, missing purposes and bad values', () => {
    expect(siteRecordSchema.safeParse(base()).success).toBe(true);
    expect(siteRecordSchema.safeParse({ ...base(), extra: 1 }).success).toBe(false);
    const fewer: Record<string, string> = { ...base().choices };
    delete fewer.analytics;
    expect(siteRecordSchema.safeParse({ ...base(), choices: fewer }).success).toBe(false);
    expect(siteRecordSchema.safeParse({ ...base(), choices: { ...base().choices, analytics: 'maybe' } }).success).toBe(false);
    expect(siteRecordSchema.safeParse({ ...base(), domain: 'https://example.com/' }).success).toBe(false);
    expect(siteRecordSchema.safeParse({ ...base(), schemaVersion: 2 }).success).toBe(false);
  });
  it("rejects 'verified' without evidence, without a date, or with unfulfilled purposes", () => {
    const at = FIXED_NOW().toISOString();
    expect(siteRecordSchema.safeParse({ ...base(), status: 'verified' }).success).toBe(false);
    expect(siteRecordSchema.safeParse({ ...base(), status: 'verified', lastVerified: at, evidenceSummary: [] }).success).toBe(false);
    expect(siteRecordSchema.safeParse({ ...base(), status: 'verified', evidenceSummary: ['x'] }).success).toBe(false);
    expect(siteRecordSchema.safeParse({ ...base(), status: 'verified', lastVerified: at, evidenceSummary: ['x'], unfulfilled: ['content'] }).success).toBe(false);
    expect(siteRecordSchema.safeParse({ ...base(), status: 'verified', lastVerified: at, evidenceSummary: ['x'] }).success).toBe(true);
  });
});

describe('openStore', () => {
  it('creates meta on an empty store', async () => {
    const port = new MemoryStorage();
    expect((await openStore(port, FIXED_NOW)).mode).toBe('read_write');
    expect(port.data.get(KEY.meta)).toMatchObject({ schemaVersion: 1 });
  });
  it('opens a newer store read only and writes nothing', async () => {
    const port = new MemoryStorage();
    port.data.set(KEY.meta, { schemaVersion: 99, createdAt: FIXED_NOW().toISOString() });
    const before = port.writes;
    expect(await openStore(port, FIXED_NOW)).toEqual({ mode: 'read_only', reason: 'newer_store' });
    expect(port.writes).toBe(before);
  });
  it('does not adopt data that has no meta', async () => {
    const port = new MemoryStorage();
    port.data.set('site:example.com', { anything: true });
    expect(await openStore(port, FIXED_NOW)).toEqual({ mode: 'read_only', reason: 'invalid_meta' });
    expect(port.data.has(KEY.meta)).toBe(false);
  });
  it('migrates, then removes the backup', async () => {
    const port = new MemoryStorage();
    port.data.set(KEY.meta, { schemaVersion: 1, createdAt: FIXED_NOW().toISOString() });
    port.data.set('site:a.example', { v: 1 });
    const result = await openStore(port, FIXED_NOW, 2, { 1: (s) => ({ ...s, 'site:a.example': { v: 2 } }) });
    expect(result.mode).toBe('read_write');
    expect(port.data.get('site:a.example')).toEqual({ v: 2 });
    expect([...port.data.keys()].some((k) => k.startsWith(KEY.backupPrefix))).toBe(false);
  });
  it.each([
    ['a throwing migration', { 1: () => { throw new Error('boom'); } }, undefined],
    ['a missing migration', {}, undefined],
    ['a result that fails validation', { 1: (s: Record<string, unknown>) => ({ ...s, 'site:new.example': {} }) }, () => false],
  ])('rolls back and opens read only after %s', async (_name, migrations, validate) => {
    const port = new MemoryStorage();
    const meta = { schemaVersion: 1, createdAt: FIXED_NOW().toISOString() };
    port.data.set(KEY.meta, meta);
    port.data.set('site:a.example', { v: 1 });
    const result = await openStore(port, FIXED_NOW, 2, migrations, validate);
    expect(result).toEqual({ mode: 'read_only', reason: 'migration_failed' });
    expect(port.data.get('site:a.example')).toEqual({ v: 1 });
    expect(port.data.get(KEY.meta)).toEqual(meta);
    expect(port.data.has('site:new.example')).toBe(false);
  });
});

describe('Repository', () => {
  const open = async (port = new MemoryStorage()) => {
    const repo = new Repository(port, FIXED_NOW);
    await repo.init();
    return { repo, port };
  };

  it('persists across instances (restart)', async () => {
    const { repo, port } = await open();
    await repo.setGlobalChoice('preferences', 'allow');
    await repo.updateSite('example.com', (r) => ({ ...(r ?? newSiteRecord('example.com', 1)), paused: true }));
    const again = new Repository(port, FIXED_NOW);
    await again.init();
    expect((await again.getSettings()).globalChoices.preferences).toBe('allow');
    expect((await again.getSite('example.com'))?.paused).toBe(true);
  });

  it('builds resolver input from user set choices only, host override first', async () => {
    const { repo } = await open();
    await repo.setGlobalChoice('analytics', 'allow');
    await repo.updateSite('example.com', () => {
      const r = newSiteRecord('example.com', 1);
      r.choices.advertising = 'allow'; // not user set: must be ignored
      r.choices.content = 'allow';
      r.setBy.content = 'user';
      return r;
    });
    const keys = { host: 'shop.example.com', site: 'example.com' };
    expect(await repo.resolverInput(keys)).toEqual({ paused: false, site: { content: 'allow' }, global: { analytics: 'allow' } });
    await repo.updateSite('shop.example.com', () => ({ ...newSiteRecord('shop.example.com', 1), paused: true }));
    expect((await repo.resolverInput(keys)).paused).toBe(true);
    await repo.setGlobalChoice('analytics', null);
    expect((await repo.resolverInput({ host: 'example.com', site: 'example.com' })).global).toEqual({});
  });

  it('quarantines a corrupt record instead of deleting it or inventing defaults', async () => {
    const { repo, port } = await open();
    port.data.set('site:example.com', { domain: 'example.com', choices: 'corrupt' });
    expect(await repo.getSite('example.com')).toBeNull();
    expect(port.data.has('site:example.com')).toBe(false);
    const quarantined = [...port.data.entries()].filter(([k]) => k.startsWith(KEY.quarantinePrefix));
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0]![1]).toMatchObject({ key: 'site:example.com', raw: { domain: 'example.com', choices: 'corrupt' } });
  });

  it('rejects invalid writes and leaves the stored record untouched', async () => {
    const { repo } = await open();
    await repo.updateSite('example.com', () => newSiteRecord('example.com', 1));
    await expect(repo.updateSite('example.com', (r) => ({ ...r!, status: 'verified' }))).rejects.toBeInstanceOf(InvalidRecordError);
    await expect(repo.updateSite('example.com', () => newSiteRecord('other.example', 1))).rejects.toBeInstanceOf(InvalidRecordError);
    expect((await repo.getSite('example.com'))?.status).toBe('not_detected');
  });

  it('surfaces a failed write (quota) instead of losing it silently, and keeps working afterwards', async () => {
    const { repo, port } = await open();
    port.failWrites = true;
    await expect(repo.setGlobalChoice('other', 'allow')).rejects.toThrow(/quota/i);
    port.failWrites = false;
    await repo.setGlobalChoice('other', 'allow');
    expect((await repo.getSettings()).globalSetBy.other).toBe('user');
  });

  it('serialises concurrent updates to one record', async () => {
    const { repo } = await open();
    await repo.updateSite('example.com', () => newSiteRecord('example.com', 1));
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        repo.updateSite('example.com', (r) => ({ ...r!, evidenceSummary: [...(r!.evidenceSummary ?? []), String(i)].slice(-10), cmp: String((Number(r!.cmp ?? 0) || 0) + 1) })),
      ),
    );
    expect((await repo.getSite('example.com'))?.cmp).toBe('25');
  });

  it('refuses writes on a read only store', async () => {
    const port = new MemoryStorage();
    port.data.set(KEY.meta, { schemaVersion: 99, createdAt: FIXED_NOW().toISOString() });
    const { repo } = await open(port);
    expect(repo.readOnly).toBe(true);
    await expect(repo.setGlobalChoice('other', 'allow')).rejects.toBeInstanceOf(StoreReadOnlyError);
  });

  it('lists and forgets sites', async () => {
    const { repo } = await open();
    for (const d of ['b.example', 'a.example']) await repo.updateSite(d, () => newSiteRecord(d, 1));
    expect((await repo.listSites()).map((r) => r.domain)).toEqual(['a.example', 'b.example']);
    await repo.forgetSite('a.example');
    expect((await repo.listSites()).map((r) => r.domain)).toEqual(['b.example']);
  });
});

describe('applyReport', () => {
  const now = FIXED_NOW();
  it('stores nothing for a site with no CMP', () => {
    expect(applyReport(null, 'example.com', report({ state: 'NOT_DETECTED' }), '1', now, true)).toBeNull();
  });
  it('produces a schema valid verified record with evidence and dates', () => {
    const r = applyReport(null, 'example.com', verified, '18.1.0', now, true)!;
    expect(siteRecordSchema.safeParse(r).success).toBe(true);
    expect(r).toMatchObject({ status: 'verified', cmp: 'Onetrust', engine: 'autoconsent', cmpRuleVersion: '18.1.0', lastVerified: now.toISOString(), lastAttempted: now.toISOString() });
    expect(r.evidenceSummary).toEqual(['cmp_self_test: confirms — ok']);
  });
  it('does not let a later bare detection replace an outcome', () => {
    const first = applyReport(null, 'example.com', verified, '1', now, true)!;
    expect(applyReport(first, 'example.com', report({ state: 'DETECTED', cmp: 'Onetrust' }), '1', now, true)).toBeNull();
  });
  it('never changes user choices, setBy or pause', () => {
    const existing: SiteRecord = { ...newSiteRecord('example.com', 1), paused: true };
    existing.choices.content = 'allow';
    existing.setBy.content = 'user';
    const r = applyReport(structuredClone(existing), 'example.com', report({ state: 'FAILED', attempts: 3, reason: 'action_failed' }), '1', now, true)!;
    expect(r.choices).toEqual(existing.choices);
    expect(r.setBy).toEqual(existing.setBy);
    expect(r.paused).toBe(true);
    expect(r.status).toBe('failed');
    expect(r.lastVerified).toBeUndefined();
    expect(r.evidenceSummary).toEqual(['reason: action_failed']);
  });

  describe('reports from an embedded frame on another site', () => {
    it('can never mark the top level site verified, partial or recorded', () => {
      for (const state of ['VERIFIED', 'PARTIAL', 'ACTION_RECORDED'] as const) {
        const r = applyReport(null, 'example.com', { ...verified, state }, '1', now, false)!;
        expect(r.status).toBe('inconclusive');
        expect(r.lastVerified).toBeUndefined();
        expect(r.evidenceSummary).toContain('source: embedded frame from another site; not counted as verification');
        expect(siteRecordSchema.safeParse(r).success).toBe(true);
      }
    });
    it('cannot overwrite an outcome established by the site itself', () => {
      for (const status of ['verified', 'partial', 'failed', 'recorded'] as const) {
        const own = { ...applyReport(null, 'example.com', verified, '1', now, true)!, status } as SiteRecord;
        if (status !== 'verified') delete own.lastVerified;
        for (const state of ['FAILED', 'VERIFIED', 'INCONCLUSIVE', 'SKIPPED', 'ACTION_ATTEMPTED'] as const) {
          expect(applyReport(structuredClone(own), 'example.com', report({ state, attempts: 1, evidence: verified.evidence }), '1', now, false)).toBeNull();
        }
      }
    });
    it('creates no record just because a consent tool was detected inside it', () => {
      expect(applyReport(null, 'example.com', report({ state: 'DETECTED', cmp: 'Onetrust' }), '1', now, false)).toBeNull();
    });
    it('cannot displace an attempt by the site itself that is still waiting for its check', () => {
      const own = applyReport(null, 'example.com', report({ state: 'ACTION_ATTEMPTED', cmp: 'Onetrust', attempts: 1 }), '1', now, true)!;
      expect(own).toMatchObject({ status: 'attempted', attemptOrigin: 'site' });
      for (const state of ['FAILED', 'INCONCLUSIVE', 'ACTION_ATTEMPTED', 'VERIFIED'] as const) {
        expect(applyReport(structuredClone(own), 'example.com', report({ state, attempts: 1, evidence: verified.evidence }), '1', now, false)).toBeNull();
      }
    });
    it('may still record that a banner was handled without confirmation', () => {
      const r = applyReport(null, 'example.com', report({ state: 'FAILED', attempts: 3 }), '1', now, false)!;
      expect(r.status).toBe('failed');
      const again = applyReport(applyReport(null, 'example.com', verified, '1', now, false), 'example.com', verified, '1', now, false)!;
      expect(again.status).toBe('inconclusive');
    });
    it('is replaced by a later report from the site itself', () => {
      const framed = applyReport(null, 'example.com', verified, '1', now, false)!;
      expect(applyReport(framed, 'example.com', verified, '1', now, true)!.status).toBe('verified');
    });
  });
});

describe('applyTopFrameEvidence', () => {
  const now = FIXED_NOW();
  const attempted = () => applyReport(null, 'example.com', report({ state: 'ACTION_ATTEMPTED', attempts: 1, cmp: 'Sourcepoint-frame' }), '1', now, false)!;
  const confirms = { kind: 'tcf_read', outcome: 'confirms', detail: 'TCF consent and legitimate interest refused for all purposes' } as const;

  it('verifies a frame attempt only from evidence read on the page itself', () => {
    expect(attempted().status).toBe('attempted');
    const r = applyTopFrameEvidence(attempted(), confirms, { unfulfilled: [] }, now)!;
    expect(r.status).toBe('verified');
    expect(r.lastVerified).toBe(now.toISOString());
    expect(r.evidenceSummary).toEqual([`tcf_read: confirms — ${confirms.detail}`, 'source: read from the page after the banner frame acted']);
    expect(siteRecordSchema.safeParse(r).success).toBe(true);
  });
  it('maps partial, contradicting and mixed preference cases without overstating', () => {
    expect(applyTopFrameEvidence(attempted(), { kind: 'tcf_read', outcome: 'partial' }, { unfulfilled: [] }, now)!.status).toBe('partial');
    expect(applyTopFrameEvidence(attempted(), { kind: 'tcf_read', outcome: 'contradicts' }, { unfulfilled: [] }, now)!.status).toBe('failed');
    expect(applyTopFrameEvidence(attempted(), confirms, { unfulfilled: ['content'] }, now)!.status).toBe('partial');
  });
  it('changes nothing without usable evidence, without a record, or when the record is not awaiting a result', () => {
    expect(applyTopFrameEvidence(attempted(), { kind: 'tcf_read', outcome: 'unavailable' }, { unfulfilled: [] }, now)).toBeNull();
    expect(applyTopFrameEvidence(null, confirms, { unfulfilled: [] }, now)).toBeNull();
    for (const status of ['verified', 'failed', 'detected', 'skipped', 'inconclusive'] as const) {
      const other = { ...attempted(), status } as SiteRecord;
      if (status === 'verified') Object.assign(other, { lastVerified: now.toISOString(), evidenceSummary: ['x'] });
      expect(applyTopFrameEvidence(other, confirms, { unfulfilled: [] }, now)).toBeNull();
    }
  });
});

describe('topFrameSnapshotFor', () => {
  const snap = (eventStatus = 'useractioncomplete') => ({ eventStatus, consents: {}, legitimateInterests: {} });
  const here = 'https://www.example.com/news';
  it('accepts a read made while the tab stayed on the site, after a user action', () => {
    expect(topFrameSnapshotFor('example.com', snap(), here, 'https://example.com/other')).not.toBeNull();
  });
  it('rejects a read when the tab was on another site before or after it', () => {
    for (const elsewhere of ['https://other.example/', 'https://example.com.evil.test/', 'about:blank', 'chrome://newtab/', undefined]) {
      expect(topFrameSnapshotFor('example.com', snap(), elsewhere, here)).toBeNull();
      expect(topFrameSnapshotFor('example.com', snap(), here, elsewhere)).toBeNull();
    }
  });
  it('ignores any address the page itself supplies', () => {
    const lying = { ...snap(), pageUrl: here } as ReturnType<typeof snap>;
    expect(topFrameSnapshotFor('example.com', lying, 'https://other.example/', 'https://other.example/')).toBeNull();
  });
  it('rejects a choice loaded from an earlier visit, a banner still showing, and a missing snapshot', () => {
    expect(topFrameSnapshotFor('example.com', snap('tcloaded'), here, here)).toBeNull();
    expect(topFrameSnapshotFor('example.com', snap('cmpuishown'), here, here)).toBeNull();
    expect(topFrameSnapshotFor('example.com', null, here, here)).toBeNull();
  });
});

describe('resumableCmp', () => {
  const now = FIXED_NOW();
  const attemptedBy = (sameSite: boolean) => applyReport(null, 'example.com', report({ state: 'ACTION_ATTEMPTED', attempts: 1, cmp: 'Onetrust' }), '1', now, sameSite)!;
  const later = (ms: number) => new Date(now.getTime() + ms);

  it("allows a recheck of the site's own recent attempt, for that CMP only", () => {
    expect(attemptedBy(true).attemptOrigin).toBe('site');
    expect(resumableCmp(attemptedBy(true), later(5_000))).toBe('Onetrust');
  });
  it('never allows a recheck of an attempt reported by a frame from another site', () => {
    expect(attemptedBy(false).attemptOrigin).toBe('other_site_frame');
    expect(resumableCmp(attemptedBy(false), later(5_000))).toBeNull();
  });
  it('refuses when the attempt is old, in the future, already concluded, has no CMP, or predates origin tracking', () => {
    expect(resumableCmp(attemptedBy(true), later(11 * 60_000))).toBeNull();
    expect(resumableCmp(attemptedBy(true), later(-60_000))).toBeNull();
    expect(resumableCmp({ ...attemptedBy(true), status: 'inconclusive' }, later(5_000))).toBeNull();
    const { cmp: _cmp, ...noCmp } = attemptedBy(true);
    void _cmp;
    expect(resumableCmp(noCmp as SiteRecord, later(5_000))).toBeNull();
    const { attemptOrigin: _origin, ...legacy } = attemptedBy(true);
    void _origin;
    expect(resumableCmp(legacy as SiteRecord, later(5_000))).toBeNull();
    expect(resumableCmp(null, now)).toBeNull();
  });
});

describe('"accept or pay" walls', () => {
  const now = FIXED_NOW();
  const detected = () => applyReport(null, 'news.example', report({ state: 'DETECTED', cmp: 'Sourcepoint-frame' }), '1', now, true)!;

  it('marks a detected record as a wall: wording only, no attempt, no verification, choices untouched', () => {
    const before = detected();
    const after = applyWall(structuredClone(before), 'Sourcepoint-frame', true, now)!;
    expect(isWall(after, now.getTime())).toBe(true);
    expect(after).toEqual({ ...before, wallSeenAt: now.toISOString() });
    expect(after.status).toBe('detected');
    expect(after.lastAttempted).toBeUndefined();
    expect(after.lastVerified).toBeUndefined();
    expect(siteRecordSchema.safeParse(after).success).toBe(true);
  });
  it('is refused from a frame of another site, so an advert cannot label the page', () => {
    expect(applyWall(detected(), 'Sourcepoint-frame', false, now)).toBeNull();
  });
  it('is refused for a consent tool without a known marker, for another tool than the one on record, and without a record', () => {
    expect(applyWall(detected(), 'Onetrust', true, now)).toBeNull();
    expect(applyWall({ ...detected(), cmp: 'Onetrust' }, 'Sourcepoint-frame', true, now)).toBeNull();
    expect(applyWall(null, 'Sourcepoint-frame', true, now)).toBeNull();
    expect(applyWall(detected(), 'constructor', true, now)).toBeNull();
  });
  it('never replaces an outcome from an earlier visit', () => {
    const outcome = applyReport(null, 'news.example', verified, '1', now, true)!;
    expect(applyWall(outcome, 'Sourcepoint-frame', true, now)).toBeNull();
  });
  it('is dropped by the next report for the site', () => {
    const wall = applyWall(detected(), 'Sourcepoint-frame', true, now)!;
    const next = applyReport(wall, 'news.example', report({ state: 'DETECTED', cmp: 'Sourcepoint-frame' }), '1', now, true)!;
    expect(next.wallSeenAt).toBeUndefined();
    expect(isWall(next, now.getTime())).toBe(false);
  });
  it('lapses on its own when no further report comes, and cannot be set through a report', () => {
    const wall = applyWall(detected(), 'Sourcepoint-frame', true, now)!;
    expect(isWall(wall, now.getTime() + WALL_LABEL_MS - 1)).toBe(true);
    expect(isWall(wall, now.getTime() + WALL_LABEL_MS)).toBe(false);
    const viaReason = applyReport(null, 'news.example', report({ state: 'DETECTED', cmp: 'Sourcepoint-frame', reason: 'pay_wall' }), '1', now, true)!;
    expect(isWall(viaReason, now.getTime())).toBe(false);
  });
});
