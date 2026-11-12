import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { features } from '../../src/config/features';
import { CONSENT_STATUSES } from '../../src/core/consent/states';
import { MAX_ROW_COUNT, MIN_LOCAL_COUNT, aggregate, isoWeek, recordKey } from '../../src/telemetry/aggregation';
import { UNAVAILABLE, initialConsent, mayObserve, reduceConsent } from '../../src/telemetry/consent-state';
import { createBus, type DomainEvent } from '../../src/telemetry/events';
import { NOTICE_VERSION, createTelemetry } from '../../src/telemetry/index';
import { cmpFamily, minimise, timeBand } from '../../src/telemetry/minimisation';
import { NoopTransport } from '../../src/telemetry/noop-transport';
import { findProhibited, validateBatch, validateRecord } from '../../src/telemetry/privacy-controls';
import type { TelemetryRecord } from '../../src/telemetry/schema';
import { FIXED_NOW } from './helpers';

// All data in this file is synthetic.
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const outcome = (cmpRule: string, status: (typeof CONSENT_STATUSES)[number] = 'verified', durationMs = 1500): DomainEvent => ({ type: 'consent_action_outcome', cmpRule, status, durationMs });
const rec = (over: Partial<TelemetryRecord> = {}): TelemetryRecord => ({ schemaVersion: 1, eventType: 'consent_action_outcome', cmpFamily: 'onetrust', consentStatus: 'verified', browserFamily: 'chromium', processingTimeBand: '1-3s', ...over });

describe('disabled by default', () => {
  it('the feature switch is off in this build', () => {
    expect(features.telemetry).toBe(false);
  });
  it('with the feature off nothing subscribes, nothing is buffered, and no action can enable it', async () => {
    const bus = createBus();
    const transport = new NoopTransport();
    const telemetry = createTelemetry({ featureEnabled: features.telemetry, bus, browser: 'chromium', transport, now: FIXED_NOW });
    expect(telemetry.consent).toEqual({ status: 'unavailable' });
    expect(telemetry.decide({ type: 'opt_in', noticeVersion: NOTICE_VERSION })).toEqual({ status: 'unavailable' });
    for (let i = 0; i < 20; i++) bus.publish(outcome('Onetrust'));
    expect(bus.size).toBe(0);
    expect(telemetry.pending).toHaveLength(0);
    expect(await telemetry.flush()).toBe(false);
    expect(transport.received).toBe(0);
  });
  it('nothing in the extension imports the telemetry directory, and telemetry imports nothing privileged', () => {
    const sources = walk('src').filter((f) => /\.(ts|tsx)$/.test(f));
    const importers = sources.filter((f) => !f.startsWith(join('src', 'telemetry')) && /from\s+['"][^'"]*telemetry[^'"]*['"]/.test(readFileSync(f, 'utf8')));
    expect(importers).toEqual([]);
    for (const file of sources.filter((f) => f.startsWith(join('src', 'telemetry')))) {
      const text = readFileSync(file, 'utf8');
      expect(/from\s+['"](wxt|wxt\/[^'"]*|@duckduckgo\/[^'"]*)['"]/.test(text), file).toBe(false);
      expect(/from\s+['"][^'"]*(storage|adapters|entrypoints|engines|ui)\//.test(text), file).toBe(false);
    }
  });
  it('there is exactly one transport, it does not transmit, and no address or network call exists in the directory', () => {
    const files = walk(join('src', 'telemetry'));
    const implementers = files.filter((f) => /implements\s+TelemetryTransport/.test(readFileSync(f, 'utf8')));
    expect(implementers).toEqual([join('src', 'telemetry', 'noop-transport.ts')]);
    expect(new NoopTransport().transmits).toBe(false);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(/https?:\/\/|wss?:\/\//.test(text), `${file} contains an address`).toBe(false);
      expect(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|chrome\.|browser\./.test(text), `${file} can do I/O`).toBe(false);
    }
  });
});

describe('consent state', () => {
  const now = FIXED_NOW();
  it('is never opted in by default and unavailable is absorbing', () => {
    expect(initialConsent(false)).toBe(UNAVAILABLE);
    expect(initialConsent(true)).toEqual({ status: 'undecided' });
    for (const action of [{ type: 'opt_in', noticeVersion: 1 }, { type: 'decline' }, { type: 'withdraw' }] as const) {
      expect(reduceConsent(UNAVAILABLE, action, now)).toBe(UNAVAILABLE);
    }
  });
  it('opts in only through an explicit action naming a notice version', () => {
    const undecided = initialConsent(true);
    expect(mayObserve(undecided, 1)).toBe(false);
    expect(reduceConsent(undecided, { type: 'opt_in', noticeVersion: 0 }, now)).toEqual(undecided);
    expect(reduceConsent(undecided, { type: 'withdraw' }, now)).toEqual(undecided);
    const optedIn = reduceConsent(undecided, { type: 'opt_in', noticeVersion: 1 }, now);
    expect(optedIn).toEqual({ status: 'opted_in', decidedAt: now.toISOString(), noticeVersion: 1 });
    expect(mayObserve(optedIn, 1)).toBe(true);
  });
  it('an opt in for an old notice does not cover a new one', () => {
    const optedIn = reduceConsent(initialConsent(true), { type: 'opt_in', noticeVersion: 1 }, now);
    expect(mayObserve(optedIn, 2)).toBe(false);
  });
  it('decline and withdraw both stop observation', () => {
    const optedIn = reduceConsent(initialConsent(true), { type: 'opt_in', noticeVersion: 1 }, now);
    expect(mayObserve(reduceConsent(optedIn, { type: 'withdraw' }, now), 1)).toBe(false);
    expect(mayObserve(reduceConsent(optedIn, { type: 'decline' }, now), 1)).toBe(false);
  });
});

describe('pipeline with the feature switched on in a test', () => {
  const setup = () => {
    const bus = createBus();
    const transport = new NoopTransport();
    const telemetry = createTelemetry({ featureEnabled: true, bus, browser: 'chromium', transport, now: FIXED_NOW });
    return { bus, transport, telemetry };
  };
  it('observes nothing before opt in, and nothing from before opt in is ever buffered', () => {
    const { bus, telemetry } = setup();
    for (let i = 0; i < 10; i++) bus.publish(outcome('Onetrust'));
    expect(bus.size).toBe(0);
    telemetry.decide({ type: 'opt_in', noticeVersion: NOTICE_VERSION });
    expect(telemetry.pending).toHaveLength(0);
    bus.publish(outcome('Onetrust'));
    expect(telemetry.pending).toHaveLength(1);
  });
  it('withdrawal clears the buffer and stops observation', async () => {
    const { bus, transport, telemetry } = setup();
    telemetry.decide({ type: 'opt_in', noticeVersion: NOTICE_VERSION });
    for (let i = 0; i < 10; i++) bus.publish(outcome('Onetrust'));
    telemetry.decide({ type: 'withdraw' });
    expect(telemetry.pending).toHaveLength(0);
    expect(bus.size).toBe(0);
    bus.publish(outcome('Onetrust'));
    expect(telemetry.pending).toHaveLength(0);
    expect(await telemetry.flush()).toBe(false);
    expect(transport.received).toBe(0);
  });
  it('the user can clear what has not been sent', () => {
    const { bus, telemetry } = setup();
    telemetry.decide({ type: 'opt_in', noticeVersion: NOTICE_VERSION });
    bus.publish(outcome('Onetrust'));
    telemetry.clearPending();
    expect(telemetry.pending).toHaveLength(0);
  });
  it('hands the no-op transport one validated batch and keeps nothing', async () => {
    const { bus, transport, telemetry } = setup();
    telemetry.decide({ type: 'opt_in', noticeVersion: NOTICE_VERSION });
    for (let i = 0; i < 6; i++) bus.publish(outcome('Onetrust'));
    expect(await telemetry.flush()).toBe(true);
    expect(transport.received).toBe(1);
    expect(telemetry.pending).toHaveLength(0);
  });
  it('a throwing subscriber cannot disturb the publisher', () => {
    const bus = createBus();
    bus.subscribe(() => {
      throw new Error('boom');
    });
    expect(() => bus.publish(outcome('Onetrust'))).not.toThrow();
  });
});

describe('minimisation', () => {
  it('collapses rule names to broad families so a site named rule cannot leak the site', () => {
    expect(cmpFamily('Onetrust')).toBe('onetrust');
    expect(cmpFamily('Cybotcookiebot')).toBe('cookiebot');
    expect(cmpFamily('Sourcepoint-frame')).toBe('sourcepoint');
    for (const siteNamed of ['bbc.com', 'tesco', 'lefigaro.fr', 'my-bank.example', '']) expect(cmpFamily(siteNamed)).toBe('other');
  });
  it('bands durations', () => {
    expect([0, 999, 1000, 2999, 3000, 9999, 10000, NaN, -1].map(timeBand)).toEqual(['<1s', '<1s', '1-3s', '1-3s', '3-10s', '3-10s', '>10s', '>10s', '>10s']);
  });
  it('builds every record from enumerated values only and every record passes validation', () => {
    const events: DomainEvent[] = [{ type: 'cmp_detected', cmpRule: 'bbc.com' }, outcome('tesco', 'inconclusive', 4200), { type: 'privacy_signal_observed', signal: 'tracking_before_consent' }, { type: 'engine_failure', cmpRule: 'didomi' }, { type: 'performance_observation', durationMs: 12 }];
    for (const event of events) {
      const record = minimise(event, 'chromium');
      expect(validateRecord(record)).toEqual(record);
      expect(findProhibited(record)).toEqual([]);
      expect(JSON.stringify(record)).not.toMatch(/bbc|tesco|4200/);
    }
  });
  it('never recodes a status: only verified is reported as verified', () => {
    for (const status of CONSENT_STATUSES) expect(minimise(outcome('Onetrust', status), 'chromium').consentStatus).toBe(status);
  });
  it('ignores extra fields smuggled onto an event', () => {
    const tainted = { ...outcome('Onetrust'), url: 'https://example.com/account?id=7', installId: '6f1c2b1e-0d7a-4b7e-9c1d-2f6b8a9e4c11' } as unknown as DomainEvent;
    expect(Object.keys(minimise(tainted, 'chromium')).sort()).toEqual(['browserFamily', 'cmpFamily', 'consentStatus', 'eventType', 'processingTimeBand', 'schemaVersion']);
  });
});

describe('payload validation', () => {
  it('rejects every prohibited field, 100% of a hostile corpus', () => {
    const corpus: unknown[] = [
      { ...rec(), domain: 'example.com' },
      { ...rec(), url: 'https://example.com/a?b=1' },
      { ...rec(), cmpFamily: 'example.com' },
      { ...rec(), cmpFamily: 'bbc.com' },
      { ...rec(), timestamp: '2026-11-10T12:00:00Z' },
      { ...rec(), installId: '6f1c2b1e-0d7a-4b7e-9c1d-2f6b8a9e4c11' },
      { ...rec(), ip: '203.0.113.7' },
      { ...rec(), pageTitle: 'My account' },
      { ...rec(), cookie: 'sid=abc' },
      { ...rec(), browserFamily: 'Chrome/157.0.0.0' },
      { ...rec(), processingTimeBand: '1532ms' },
      { ...rec(), consentStatus: 'success' },
      { ...rec(), schemaVersion: 2 },
      { ...rec(), eventType: 'page_view' },
      { ...rec(), nested: { domain: 'example.com' } },
      null, 'record', 42, [], {},
    ];
    expect(corpus.map(validateRecord).filter((r) => r !== null)).toEqual([]);
  });
  it('the independent scan recognises each kind of prohibited content', () => {
    expect(findProhibited({ a: 'https://example.com/x' })).toContain('url');
    expect(findProhibited(['shop.example.co.uk'])).toContain('domain');
    expect(findProhibited('203.0.113.7')).toContain('ip_address');
    expect(findProhibited({ id: '6f1c2b1e-0d7a-4b7e-9c1d-2f6b8a9e4c11' })).toContain('uuid');
    expect(findProhibited('2026-11-10T12:34:00Z')).toContain('timestamp');
    expect(findProhibited('Zm9vYmFyYmF6cXV4cXV1eGNvcmdl')).toContain('long_token');
    expect(findProhibited('someone@example')).toContain('email');
    expect(findProhibited({ t: 1762776000000 })).toContain('large_number');
    expect(findProhibited({ 'example.com': 1 })).toContain('domain'); // keys are scanned too
  });
  it('rejects a batch with an extra key, a bad period, a zero count or a prohibited value', () => {
    const good = { schemaVersion: 1, period: '2026-W46', rows: [{ record: rec(), count: 7 }] };
    expect(validateBatch(good)).toEqual(good);
    expect(validateBatch({ ...good, deviceId: 'abc' })).toBeNull();
    expect(validateBatch({ ...good, period: '2026-11-10' })).toBeNull();
    expect(validateBatch({ ...good, rows: [{ record: rec(), count: 0 }] })).toBeNull();
    expect(validateBatch({ ...good, rows: [{ record: { ...rec(), site: 'example.com' }, count: 7 }] })).toBeNull();
    expect(validateBatch({ ...good, rows: [{ record: rec(), count: 7, firstSeen: '2026-11-10' }] })).toBeNull();
  });
});

describe('aggregation', () => {
  const many = (n: number, over: Partial<TelemetryRecord> = {}) => Array.from({ length: n }, () => rec(over));
  it('is reproducible: the same input in any order gives a byte identical batch', () => {
    const input = [...many(7), ...many(6, { cmpFamily: 'didomi', consentStatus: 'partial' }), ...many(9, { eventType: 'cmp_detected', consentStatus: undefined, processingTimeBand: undefined })];
    const shuffled = [...input].reverse();
    const a = JSON.stringify(aggregate(input, '2026-W46'));
    expect(JSON.stringify(aggregate(shuffled, '2026-W46'))).toBe(a);
    expect(JSON.stringify(aggregate(input, '2026-W46'))).toBe(a);
    expect(validateBatch(JSON.parse(a))).not.toBeNull();
  });
  it('merges rare combinations into "other" and drops what is still rare', () => {
    const batch = aggregate([...many(MIN_LOCAL_COUNT), ...many(3, { cmpFamily: 'axeptio' }), ...many(2, { cmpFamily: 'tealium' }), ...many(1, { cmpFamily: 'didomi', consentStatus: 'failed' })], '2026-W46');
    const rows = Object.fromEntries(batch.rows.map((r) => [`${r.record.cmpFamily}/${r.record.consentStatus}`, r.count]));
    expect(rows).toEqual({ 'onetrust/verified': MIN_LOCAL_COUNT, 'other/verified': 5 });
    expect(JSON.stringify(batch)).not.toMatch(/axeptio|tealium|didomi|failed/);
  });
  it('produces no rows at all from a small sample', () => {
    expect(aggregate(many(MIN_LOCAL_COUNT - 1), '2026-W46').rows).toEqual([]);
    expect(aggregate([], '2026-W46').rows).toEqual([]);
  });
  it('caps a row so one device cannot dominate a total', () => {
    expect(aggregate(many(500), '2026-W46').rows[0]!.count).toBe(MAX_ROW_COUNT);
  });
  it('counts inconclusive separately from verified', () => {
    const batch = aggregate([...many(6), ...many(6, { consentStatus: 'inconclusive' })], '2026-W46');
    expect(batch.rows.map((r) => [r.record.consentStatus, r.count]).sort()).toEqual([['inconclusive', 6], ['verified', 6]]);
  });
  it('keys are independent of field order, and weeks follow ISO 8601', () => {
    expect(recordKey({ schemaVersion: 1, eventType: 'cmp_detected', cmpFamily: 'didomi' })).toBe(recordKey({ cmpFamily: 'didomi', eventType: 'cmp_detected', schemaVersion: 1 }));
    expect(isoWeek(new Date('2026-11-10T12:00:00Z'))).toBe('2026-W46');
    expect(isoWeek(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53');
    expect(isoWeek(new Date('2024-12-30T00:00:00Z'))).toBe('2025-W01');
  });
});
