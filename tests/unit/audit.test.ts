import { describe, expect, it } from 'vitest';
import { AUDIT_CHECKS, buildAudit, summarise } from '../../src/audit/checks';
import { observedTracker, trackerFor } from '../../src/audit/classifications';
import { AFTER_WINDOW_MS, afterWindowComplete, claimActed, confirmClaim, markActed, markBanner, observe, settleClaims, startPageAudit } from '../../src/audit/collector';
import { TRACKERS, TRACKER_COUNT, TRACKER_LIST_VERSION } from '../../src/audit/trackers';
import { features } from '../../src/config/features';
import { applyReport } from '../../src/storage/apply-report';
import { Repository } from '../../src/storage/repository';
import { auditResultSchema, siteRecordSchema } from '../../src/storage/schema';
import { FIXED_NOW, MemoryStorage } from './helpers';

const T0 = FIXED_NOW().getTime();
const ctx = (over = {}) => ({ refused: true, gpcEnabled: true, now: T0 + 60_000, ...over });
const outcome = (audit: ReturnType<typeof buildAudit>, check: (typeof AUDIT_CHECKS)[number]) => audit.checks.find((c) => c.check === check)!;
const banner = () => markBanner(startPageAudit('example.com', T0), T0 + 500);

describe('tracker list and classification', () => {
  it('is built in, versioned, and matches a listed service on any subdomain', () => {
    expect(features.audit).toBe(true);
    expect(TRACKER_LIST_VERSION).toMatch(/^\d{4}\.\d{1,2}\.\d+$/);
    expect(TRACKER_COUNT).toBeGreaterThan(50);
    expect(trackerFor('stats.g.doubleclick.net')).toEqual({ service: 'doubleclick.net', category: 'advertising' });
    expect(trackerFor('www.google-analytics.com')).toEqual({ service: 'google-analytics.com', category: 'analytics' });
    expect(trackerFor('example.com')).toBeNull();
    expect(trackerFor('www.googletagmanager.com')).toBeNull(); // a tag loader is not itself tracking
    expect(trackerFor('notdoubleclick.net')).toBeNull();
    expect(trackerFor('doubleclick.net.evil.example')).toBeNull();
  });
  it('holds only bare lower case domains', () => {
    for (const domain of TRACKERS.keys()) expect(domain).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/);
  });
  it('counts a request only when it goes to another site', () => {
    expect(observedTracker('https://www.google-analytics.com/collect?v=1&cid=123', 'example.com')?.service).toBe('google-analytics.com');
    expect(observedTracker('https://www.criteo.com/', 'criteo.com')).toBeNull(); // the service's own site
    expect(observedTracker('https://cdn.example.com/app.js', 'example.com')).toBeNull();
    expect(observedTracker('data:text/plain,hi', 'example.com')).toBeNull();
  });
});

describe('page observation', () => {
  it('sorts services into before and after the refusal, without duplicates', () => {
    let page = banner();
    page = observe(observe(page, 'doubleclick.net'), 'doubleclick.net');
    page = markActed(page, T0 + 2000);
    page = observe(page, 'criteo.com');
    expect(page.before).toEqual(['doubleclick.net']);
    expect(page.after).toEqual(['criteo.com']);
    const same = observe(page, 'criteo.com');
    expect(same).toBe(page); // unchanged object: the caller skips the write
  });
  it('stores service domains only and caps the list', () => {
    let page = banner();
    for (let i = 0; i < 100; i++) page = observe(page, `service${i}.example`);
    expect(page.before.length).toBe(25);
    expect(JSON.stringify(page)).not.toMatch(/https?:|\?|\/collect/);
  });
  it('knows when the window after the refusal has been watched in full', () => {
    const page = markActed(banner(), T0 + 2000);
    expect(afterWindowComplete(page, T0 + 2000 + AFTER_WINDOW_MS - 1)).toBe(false);
    expect(afterWindowComplete(page, T0 + 2000 + AFTER_WINDOW_MS)).toBe(true);
    expect(afterWindowComplete(banner(), T0 + 999_999)).toBe(false);
  });
});

describe('claims from a frame on another site', () => {
  it('do not move the before/after line until the page itself confirms them', () => {
    let page = observe(banner(), 'doubleclick.net');
    page = claimActed(page, T0 + 2000);
    page = observe(page, 'criteo.com');
    expect(page.actedAt).toBeUndefined();
    expect(page.before).toEqual(['doubleclick.net']);
    expect(page.after).toEqual([]);
    expect(page.unconfirmed).toEqual(['criteo.com']);
  });
  it('once confirmed, the refusal counts from the moment it was claimed', () => {
    const page = confirmClaim(observe(claimActed(banner(), T0 + 2000), 'criteo.com'));
    expect(page).toMatchObject({ actedAt: T0 + 2000, after: ['criteo.com'] });
    expect(page.claimedAt).toBeUndefined();
    expect(outcome(buildAudit(page, ctx()), 'tracking_after_refusal')).toMatchObject({ outcome: 'signal_detected', services: ['criteo.com'] });
  });
  it('never confirmed: the claim is dropped and cannot produce any "after refusal" result', () => {
    const page = settleClaims(observe(claimActed(observe(banner(), 'doubleclick.net'), T0 + 2000), 'criteo.com'));
    expect(page.actedAt).toBeUndefined();
    expect(page.before).toEqual(['criteo.com', 'doubleclick.net']);
    const audit = buildAudit(page, ctx());
    expect(outcome(audit, 'tracking_after_refusal').outcome).toBe('not_applicable');
    expect(outcome(audit, 'refusal_accessibility').outcome).toBe('not_applicable');
    expect(outcome(audit, 'tracking_before_consent')).toMatchObject({ outcome: 'signal_detected', count: 2 });
  });
  it('cannot override a refusal the page itself reported, and is harmless when repeated', () => {
    const own = markActed(banner(), T0 + 1000);
    expect(claimActed(own, T0 + 5000)).toBe(own);
    const claimed = claimActed(banner(), T0 + 2000);
    expect(claimActed(claimed, T0 + 9000)).toBe(claimed);
    expect(confirmClaim(banner())).toEqual(banner());
    expect(settleClaims(own)).toBe(own);
  });
});

describe('the six checks', () => {
  it('always reports all six, in a fixed order, as a schema valid result with the hour only', () => {
    const audit = buildAudit(banner(), ctx());
    expect(audit.checks.map((c) => c.check)).toEqual([...AUDIT_CHECKS]);
    expect(auditResultSchema.safeParse(audit).success).toBe(true);
    expect(audit.observedAt).toMatch(/:00:00\.000Z$/);
    expect(audit).toMatchObject({ trackerListVersion: TRACKER_LIST_VERSION, trackersKnown: TRACKER_COUNT });
  });
  it('tracking before consent: signal with the services, otherwise passed', () => {
    expect(outcome(buildAudit(observe(banner(), 'doubleclick.net'), ctx()), 'tracking_before_consent')).toEqual({ check: 'tracking_before_consent', outcome: 'signal_detected', services: ['doubleclick.net'], count: 1 });
    expect(outcome(buildAudit(banner(), ctx()), 'tracking_before_consent').outcome).toBe('passed');
  });
  it('tracking before consent: a page that leaves at once, with the banner unanswered, proves nothing', () => {
    const cutShort = { refused: true, gpcEnabled: true, now: banner().bannerSeenAt! + 500 };
    expect(outcome(buildAudit(banner(), cutShort), 'tracking_before_consent').outcome).toBe('inconclusive');
    expect(outcome(buildAudit(observe(banner(), 'doubleclick.net'), cutShort), 'tracking_before_consent').outcome).toBe('signal_detected');
  });
  it('tracking after refusal: never "passed" unless the whole window was watched', () => {
    const acted = markActed(banner(), T0 + 2000);
    expect(outcome(buildAudit(acted, ctx({ now: T0 + 3000 })), 'tracking_after_refusal').outcome).toBe('inconclusive');
    expect(outcome(buildAudit(acted, ctx({ now: T0 + 2000 + AFTER_WINDOW_MS })), 'tracking_after_refusal').outcome).toBe('passed');
    expect(outcome(buildAudit(observe(acted, 'criteo.com'), ctx({ now: T0 + 3000 })), 'tracking_after_refusal')).toMatchObject({ outcome: 'signal_detected', services: ['criteo.com'] });
    expect(outcome(buildAudit(banner(), ctx()), 'tracking_after_refusal').outcome).toBe('not_applicable'); // nothing was refused
    expect(outcome(buildAudit(acted, ctx({ refused: false })), 'tracking_after_refusal').outcome).toBe('not_applicable'); // the user allowed everything
  });
  it('refusal accessibility: one step passes, more is a signal, unknown is inconclusive', () => {
    const acted = markActed(banner(), T0 + 2000);
    expect(outcome(buildAudit({ ...acted, clicks: 1 }, ctx()), 'refusal_accessibility')).toMatchObject({ outcome: 'passed', count: 1 });
    expect(outcome(buildAudit({ ...acted, clicks: 4 }, ctx()), 'refusal_accessibility')).toMatchObject({ outcome: 'signal_detected', count: 4 });
    expect(outcome(buildAudit(acted, ctx()), 'refusal_accessibility').outcome).toBe('inconclusive');
    expect(outcome(buildAudit({ ...acted, clicks: 0 }, ctx()), 'refusal_accessibility').outcome).toBe('inconclusive'); // done through an API, steps not observed
  });
  it('preselected purposes: judged only from a state read while the banner was unanswered', () => {
    const at = (tcfBefore: object | null) => outcome(buildAudit({ ...banner(), tcfBefore } as never, ctx()), 'optional_purposes_preselected');
    expect(at({ eventStatus: 'cmpuishown', consented: 3 })).toMatchObject({ outcome: 'signal_detected', count: 3 });
    expect(at({ eventStatus: 'cmpuishown', consented: 0 }).outcome).toBe('passed');
    expect(at({ eventStatus: 'tcloaded', consented: 5 }).outcome).toBe('inconclusive'); // an earlier choice, not a default
    expect(at(null).outcome).toBe('inconclusive');
  });
  it('consent information: passed only when a machine readable state exists', () => {
    expect(outcome(buildAudit({ ...banner(), tcfBefore: { eventStatus: 'cmpuishown', consented: 0 } }, ctx()), 'consent_information_available').outcome).toBe('passed');
    expect(outcome(buildAudit(banner(), ctx()), 'consent_information_available').outcome).toBe('inconclusive');
  });
  it('GPC: read only from a US privacy string, and not applicable when GPC is off or no string exists', () => {
    const at = (usp: string | null, gpcEnabled = true) => outcome(buildAudit({ ...banner(), usp }, ctx({ gpcEnabled })), 'gpc_behaviour').outcome;
    expect(at('1YYN')).toBe('passed');
    expect(at('1YNN')).toBe('signal_detected');
    expect(at('1---')).toBe('inconclusive');
    expect(at('junk')).toBe('inconclusive');
    expect(at(null)).toBe('not_applicable');
    expect(at('1YNN', false)).toBe('not_applicable');
  });
  it('never turns missing evidence into a pass', () => {
    // A page with a banner where nothing else could be observed.
    const totals = summarise(buildAudit(banner(), ctx()));
    expect(totals).toEqual({ passed: 1, signal_detected: 0, inconclusive: 2, not_applicable: 3 });
  });
});

describe('storage', () => {
  it('keeps an audit on a record and removes it after the retention period, leaving choices and result alone', async () => {
    const port = new MemoryStorage();
    let now = FIXED_NOW();
    const repo = new Repository(port, () => now);
    await repo.init();
    const base = applyReport(null, 'example.com', { type: 'page:report', state: 'VERIFIED', cmp: 'Onetrust', attempts: 1, unfulfilled: [], evidence: [{ kind: 'cmp_self_test', outcome: 'confirms' }] }, '1', now, true)!;
    const audit = buildAudit(observe(banner(), 'doubleclick.net'), ctx());
    const stored = await repo.updateSite('example.com', () => ({ ...base, audit }));
    expect(siteRecordSchema.safeParse(stored).success).toBe(true);
    expect(await repo.pruneAudits(90 * 86_400_000)).toBe(0);
    now = new Date(now.getTime() + 91 * 86_400_000);
    expect(await repo.pruneAudits(90 * 86_400_000)).toBe(1);
    const after = (await repo.getSite('example.com'))!;
    expect(after.audit).toBeUndefined();
    expect(after).toMatchObject({ status: 'verified', cmp: 'Onetrust' });
  });
  it('rejects an audit carrying a URL or an unknown field', () => {
    const audit = buildAudit(banner(), ctx());
    expect(auditResultSchema.safeParse({ ...audit, checks: [{ check: 'tracking_before_consent', outcome: 'signal_detected', services: ['https://x.example/a?id=1'] }] }).success).toBe(false);
    expect(auditResultSchema.safeParse({ ...audit, url: 'https://example.com/' }).success).toBe(false);
  });
});
