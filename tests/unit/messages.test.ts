import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePageRequest, validateSender } from '../../src/adapters/shared/messages';
import { features } from '../../src/config/features';
import { AUTOCONSENT_VERSION, autoconsentConfig } from '../../src/engines/autoconsent/config';
import { hasStateReadingTest } from '../../src/engines/autoconsent/test-kinds';
import { stateTestNames } from '../../scripts/gen-state-tests.mjs';

const OWN = 'abcdefghijklmnopabcdefghijklmnop';
const goodSender = { id: OWN, url: 'https://example.com/a', frameId: 0, tab: { id: 7, url: 'https://example.com/a' } };

describe('validateSender', () => {
  it('accepts our own content script in a tab', () => {
    expect(validateSender(goodSender, OWN)).toEqual({ tabId: 7, frameId: 0, frameUrl: 'https://example.com/a', tabUrl: 'https://example.com/a' });
    expect(validateSender({ ...goodSender, frameId: 3, url: 'about:blank' }, OWN)?.frameId).toBe(3);
  });
  it.each([
    ['another extension', { ...goodSender, id: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz' }],
    ['no id', { ...goodSender, id: undefined }],
    ['no tab (extension page or external)', { ...goodSender, tab: undefined }],
    ['no frame id', { ...goodSender, frameId: undefined }],
    ['a chrome:// tab', { ...goodSender, tab: { id: 7, url: 'chrome://settings' } }],
    ['a top frame that is not http', { ...goodSender, url: 'chrome-extension://x/popup.html' }],
    ['a negative tab id', { ...goodSender, tab: { id: -1, url: 'https://example.com' } }],
  ])('rejects %s', (_name, sender) => {
    expect(validateSender(sender, OWN)).toBeNull();
  });
});

describe('parsePageRequest', () => {
  const base = { type: 'page:report', state: 'DETECTED', evidence: [], unfulfilled: [], attempts: 0 };
  it('accepts the four request types', () => {
    expect(parsePageRequest({ type: 'page:init' })).not.toBeNull();
    expect(parsePageRequest({ type: 'page:tcf' })).not.toBeNull();
    expect(parsePageRequest({ type: 'page:eval', snippetId: 'EVAL_ONETRUST_1' })).not.toBeNull();
    expect(parsePageRequest(base)).not.toBeNull();
  });
  it('accepts audit events with a click count and a page load id, and nothing else in them', () => {
    expect(parsePageRequest({ type: 'page:audit', event: 'banner' })).not.toBeNull();
    expect(parsePageRequest({ type: 'page:audit', event: 'finish', clicks: 2, pageLoad: 1762776000000 })).not.toBeNull();
    expect(parsePageRequest({ type: 'page:audit', event: 'finish', site: 'example.com' })).toBeNull();
    expect(parsePageRequest({ type: 'page:audit', event: 'finish', services: ['x.example'] })).toBeNull();
    expect(parsePageRequest({ type: 'page:audit', event: 'reset' })).toBeNull();
    expect(parsePageRequest({ type: 'page:audit', event: 'finish', clicks: 9999 })).toBeNull();
  });
  it('rejects code strings, unknown keys and unknown types', () => {
    expect(parsePageRequest({ type: 'page:eval', snippetId: 'EVAL_0', code: 'alert(1)' })).toBeNull();
    expect(parsePageRequest({ type: 'page:eval', snippetId: 'alert(1)' })).toBeNull();
    expect(parsePageRequest({ type: 'page:eval', snippetId: '__proto__' })).toBeNull();
    expect(parsePageRequest({ type: 'page:init', domain: 'evil.example' })).toBeNull();
    expect(parsePageRequest({ ...base, domain: 'evil.example' })).toBeNull();
    expect(parsePageRequest({ type: 'storage:clear' })).toBeNull();
  });
  it('rejects a success claim that carries no supporting evidence', () => {
    const confirms = { kind: 'cmp_self_test', outcome: 'confirms' };
    expect(parsePageRequest({ ...base, state: 'VERIFIED', attempts: 1 })).toBeNull();
    expect(parsePageRequest({ ...base, state: 'VERIFIED', attempts: 1, evidence: [{ kind: 'tcf_read', outcome: 'unavailable' }] })).toBeNull();
    expect(parsePageRequest({ ...base, state: 'VERIFIED', attempts: 1, evidence: [confirms], unfulfilled: ['content'] })).toBeNull();
    expect(parsePageRequest({ ...base, state: 'VERIFIED', attempts: 1, evidence: [confirms, { kind: 'tcf_read', outcome: 'contradicts' }] })).toBeNull();
    expect(parsePageRequest({ ...base, state: 'PARTIAL', attempts: 1 })).toBeNull();
    expect(parsePageRequest({ ...base, state: 'VERIFIED', attempts: 1, evidence: [confirms] })).not.toBeNull();
  });
  it('survives 5,000 hostile and random payloads without throwing or accepting', () => {
    const atoms: unknown[] = [null, undefined, 0, -1, 1e308, NaN, '', 'page:init', 'VERIFIED', [], {}, true, 'x'.repeat(10000),
      { toString: 1 }, ['page:report'], { type: 'page:report' }, JSON.parse('{"__proto__":{"type":"page:init"}}'), Symbol.iterator, () => 1, 10n];
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const pick = () => atoms[Math.floor(rand() * atoms.length)];
    const keys = ['type', 'state', 'evidence', 'unfulfilled', 'attempts', 'cmp', 'reason', 'snippetId', 'code', 'constructor'];
    let accepted = 0;
    for (let i = 0; i < 5000; i++) {
      const candidate: Record<string, unknown> = {};
      for (const k of keys) if (rand() < 0.5) candidate[k] = pick();
      const input = rand() < 0.1 ? pick() : candidate;
      const parsed = parsePageRequest(input);
      if (parsed && parsed.type !== 'page:init' && parsed.type !== 'page:tcf') accepted++;
    }
    expect(accepted).toBe(0);
  });
});

describe('engine configuration', () => {
  it('disables every heuristic, generated and cosmetic path and never auto acts', () => {
    expect(autoconsentConfig()).toMatchObject({
      autoAction: null,
      heuristicMode: 'off',
      enablePopupMutationObserver: false,
      disabledCmps: ['sourcepoint-top'],
      enableHeuristicDetection: false,
      enableHeuristicHitTest: false,
      enableGeneratedRules: false,
      enableCosmeticRules: false,
      enablePrehide: false,
      isMainWorld: false,
    });
  });
  it('declares the engine version that is installed', () => {
    const pkg = JSON.parse(readFileSync('node_modules/@duckduckgo/autoconsent/package.json', 'utf8')) as { version: string; license: string };
    expect(pkg.version).toBe(AUTOCONSENT_VERSION);
    expect(pkg.license).toBe('MPL-2.0');
  });
  it('ships with telemetry switched off, and GPC, the audit and purpose level execution on', () => {
    expect(features).toEqual({ telemetry: false, gpc: true, audit: true, purposeLevelExecution: true, testerInvitation: true });
  });
  it('knows which self tests read stored consent state, and the list matches the installed rules', () => {
    const committed = JSON.parse(readFileSync('src/engines/autoconsent/state-tests.json', 'utf8')) as string[];
    expect(committed).toEqual(stateTestNames());
    for (const name of ['Onetrust', 'Cybotcookiebot', 'didomi', 'bbc.com', 'tesco', 'Tealium']) expect(hasStateReadingTest(name), name).toBe(true);
    // These tests only check that the banner is gone.
    for (const name of ['AppConsent', 'Uniconsent', 'binogi', 'Sourcepoint-frame', 'unknown-rule']) expect(hasStateReadingTest(name), name).toBe(false);
  });
});
