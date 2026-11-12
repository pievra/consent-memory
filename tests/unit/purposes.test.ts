import { describe, expect, it } from 'vitest';
import { parsePageRequest, validateSender } from '../../src/adapters/shared/messages';
import { createRun, step, type EngineEvent, type Run, type StepContext } from '../../src/core/consent/executor';
import { planAction, type PurposeOffering } from '../../src/core/consent/mappings';
import { PURPOSES, type Choices, type Purpose } from '../../src/core/consent/purposes';
import type { ChoiceSource } from '../../src/core/consent/resolver';
import { decideVerdict, evaluatePurposeState, evaluateTcf } from '../../src/core/consent/verifier';
import { applyCookiebotInPage, readCookiebotInPage } from '../../src/engines/purposes/cookiebot';
import { purposeAdapter, purposeOfferings } from '../../src/engines/purposes/registry';

const choose = (allowed: Purpose[]) => ({
  choices: Object.fromEntries(PURPOSES.map((p) => [p, allowed.includes(p) ? 'allow' : 'refuse'])) as Choices,
  sources: Object.fromEntries(PURPOSES.map((p) => [p, allowed.includes(p) ? 'site' : 'default'])) as Record<Purpose, ChoiceSource>,
});
const COOKIEBOT: Purpose[] = ['preferences', 'analytics', 'advertising'];
const OFFERING: PurposeOffering = { offered: COOKIEBOT, implies: { preferences: ['storage'], analytics: ['storage'], advertising: ['storage'] } };
const plan = (allowed: Purpose[], offering: PurposeOffering | null) => {
  const { choices, sources } = choose(allowed);
  return planAction(choices, sources, offering);
};

describe('planning a purpose by purpose action', () => {
  it('keeps the whole banner refusal when nothing is allowed, with or without an adapter', () => {
    expect(plan([], OFFERING)).toMatchObject({ action: 'optOut', unfulfilled: [] });
    expect(plan([], null)).toMatchObject({ action: 'optOut', unfulfilled: [] });
  });
  it('keeps the whole banner acceptance only when all six purposes are allowed by the user', () => {
    expect(plan([...PURPOSES], OFFERING)).toMatchObject({ action: 'optIn', unfulfilled: [] });
  });
  it('grants an offered purpose when the user allowed it and what it implies', () => {
    expect(plan(['storage', 'analytics'], OFFERING)).toEqual({ action: 'purposes', grant: ['analytics'], unfulfilled: [], mappingVersion: 2 });
    expect(plan(['storage', 'analytics', 'content'], OFFERING)).toMatchObject({ action: 'purposes', grant: ['analytics'], unfulfilled: ['content'] });
  });
  it('never brings about a refused purpose as a side effect: without storage allowed, nothing is granted', () => {
    expect(plan(['analytics'], OFFERING)).toMatchObject({ action: 'optOut', unfulfilled: ['analytics'] });
    expect(plan(['analytics', 'advertising', 'preferences'], OFFERING)).toMatchObject({ action: 'optOut' });
    expect(plan(['analytics'], OFFERING).grant).toBeUndefined();
  });
  it('refuses everything when the tool has no adapter, or offers none of the allowed purposes', () => {
    expect(plan(['storage', 'analytics'], null)).toMatchObject({ action: 'optOut', unfulfilled: ['storage', 'analytics'] });
    expect(plan(['storage', 'content', 'other'], OFFERING)).toMatchObject({ action: 'optOut', unfulfilled: ['storage', 'content', 'other'] });
  });
  it('five of six allowed is a purpose action, never an acceptance of the banner', () => {
    const five = PURPOSES.filter((p) => p !== 'advertising');
    expect(plan(five, OFFERING)).toMatchObject({ action: 'purposes', grant: ['preferences', 'analytics'], unfulfilled: ['content', 'other'] });
  });
});

describe('judging what the consent tool reports, purpose by purpose', () => {
  const grant: Purpose[] = ['analytics'];
  const read = (states: Partial<Record<Purpose, boolean>>, settled = true) => ({ settled, states });
  it('confirms only an exact match on every offered purpose', () => {
    expect(evaluatePurposeState(read({ preferences: false, analytics: true, advertising: false }), grant).outcome).toBe('confirms');
  });
  it('a purpose that should be off and is reported on contradicts, whatever else matches', () => {
    const e = evaluatePurposeState(read({ preferences: false, analytics: true, advertising: true }), grant);
    expect(e).toMatchObject({ outcome: 'contradicts', detail: 'CMP reports 1 refused purposes as on' });
    expect(decideVerdict([e], { unfulfilled: [] })).toBe('FAILED');
    // Also when the user allowed it but it could not be granted (what it implies was refused).
    expect(evaluatePurposeState(read({ preferences: true, analytics: true, advertising: false }), grant).outcome).toBe('contradicts');
  });
  it('a purpose that should be on and is reported off is partial, never verified', () => {
    const e = evaluatePurposeState(read({ preferences: false, analytics: false, advertising: false }), grant);
    expect(e.outcome).toBe('partial');
    expect(decideVerdict([e], { unfulfilled: [] })).toBe('PARTIAL');
  });
  it('concludes nothing before the tool has recorded an answer, or with nothing to compare', () => {
    expect(evaluatePurposeState(read({ preferences: false, analytics: true, advertising: false }, false), grant).outcome).toBe('unavailable');
    expect(evaluatePurposeState(null, grant).outcome).toBe('unavailable');
    expect(evaluatePurposeState(read({}), grant).outcome).toBe('unavailable');
  });
  it('a confirmed match with a purpose the tool does not offer is partial, not verified', () => {
    const e = evaluatePurposeState(read({ preferences: false, analytics: true, advertising: false }), grant);
    expect(decideVerdict([e], { unfulfilled: ['content'] })).toBe('PARTIAL');
    expect(decideVerdict([e], { unfulfilled: [] })).toBe('VERIFIED');
  });
  it('TCF is not used to judge a purpose by purpose choice', () => {
    expect(evaluateTcf({ eventStatus: 'useractioncomplete', consents: { 1: true }, legitimateInterests: {} }, 'purposes').outcome).toBe('unavailable');
  });
});

describe('the run, step by step', () => {
  const ctx = (allowed: Purpose[], offerings: Record<string, PurposeOffering> = { Cybotcookiebot: OFFERING }): StepContext => ({
    resolution: { paused: false, ...choose(allowed) },
    unsafeContext: false,
    purposeOfferings: offerings,
  });
  const play = (events: EngineEvent[], context: StepContext) => {
    let run: Run = createRun();
    const commands: string[] = [];
    for (const event of events) {
      const result = step(run, event, context);
      run = result.run;
      commands.push(...result.commands.map((c) => (c.type === 'run_action' ? `run:${c.action}` : c.type === 'collect_evidence' ? `collect:${c.kind}` : c.type)));
    }
    return { run, commands };
  };
  const popup: EngineEvent = { type: 'popup_found', cmp: 'Cybotcookiebot' };

  it('sets purposes, then asks only the consent tool for evidence, and verifies on a match', () => {
    const { run, commands } = play(
      [popup, { type: 'action_result', ok: true, selfTestAvailable: false }, { type: 'evidence', evidence: { kind: 'cmp_state_read', outcome: 'confirms' } }],
      ctx(['storage', 'analytics']),
    );
    expect(commands).toEqual(['report', 'run:purposes', 'report', 'collect:cmp_state_read', 'report']);
    expect(run.state).toBe('VERIFIED');
  });
  it('falls back to refusing everything, once, when the purpose interface is not usable', () => {
    const { run, commands } = play([popup, { type: 'action_result', ok: false, selfTestAvailable: false }], ctx(['storage', 'analytics']));
    expect(commands).toEqual(['report', 'run:purposes', 'run:optOut']);
    expect(run.plan).toMatchObject({ action: 'optOut', unfulfilled: ['storage', 'analytics'] });
    expect(run.attempts).toBe(1);
  });
  it('never uses the purpose action for a consent tool without an adapter, or in a frame', () => {
    expect(play([{ type: 'popup_found', cmp: 'Onetrust' }], ctx(['storage', 'analytics'])).commands).toEqual(['report', 'run:optOut']);
    expect(play([popup], ctx(['storage', 'analytics'], {})).commands).toEqual(['report', 'run:optOut']);
    expect(play([{ type: 'popup_found', cmp: 'constructor' }], ctx(['storage', 'analytics'])).commands).toEqual(['report', 'run:optOut']);
  });
  it('without evidence the result is "applied, not confirmed"', () => {
    const { run } = play(
      [popup, { type: 'action_result', ok: true, selfTestAvailable: false }, { type: 'evidence', evidence: { kind: 'cmp_state_read', outcome: 'unavailable' } }],
      ctx(['storage', 'analytics']),
    );
    expect(run.state).toBe('INCONCLUSIVE');
  });
});

describe('the adapter and its messages', () => {
  it('exists only for consent tools with fixed categories', () => {
    expect(purposeOfferings()).toEqual({ Cybotcookiebot: OFFERING });
    expect(purposeAdapter('Onetrust')).toBeNull();
    expect(purposeAdapter('constructor')).toBeNull();
    expect(purposeAdapter(undefined)).toBeNull();
  });
  it('passes the three category values in the tool’s own order: preferences, statistics, marketing', () => {
    const adapter = purposeAdapter('Cybotcookiebot')!;
    expect(adapter.apply.args((p) => p === 'analytics')).toEqual([false, true, false]);
    expect(adapter.apply.args((p) => p === 'advertising' || p === 'storage')).toEqual([false, false, true]);
  });
  it('maps what the tool reports back to purposes, and rejects anything malformed', () => {
    const adapter = purposeAdapter('Cybotcookiebot')!;
    expect(adapter.read.states({ hasResponse: true, preferences: false, statistics: true, marketing: false })).toEqual({ settled: true, states: { preferences: false, analytics: true, advertising: false } });
    expect(adapter.read.states({ hasResponse: true, preferences: 'yes', statistics: true, marketing: false })).toBeNull();
    expect(adapter.read.states(null)).toBeNull();
  });
  it('page functions do nothing without the tool’s interface', () => {
    const g = globalThis as unknown as { window?: unknown };
    g.window = {};
    expect(applyCookiebotInPage(false, true, false)).toBe(false);
    expect(readCookiebotInPage()).toBeNull();
    const calls: boolean[][] = [];
    g.window = { Cookiebot: { submitCustomConsent: (...a: boolean[]) => calls.push(a), consent: { preferences: false, statistics: true, marketing: false }, hasResponse: true } };
    expect(applyCookiebotInPage(false, true, false)).toBe(true);
    expect(calls).toEqual([[false, true, false]]);
    expect(readCookiebotInPage()).toEqual({ hasResponse: true, preferences: false, statistics: true, marketing: false });
    delete g.window;
  });
  it('the sender keeps the browser’s document identifier, which pins where anything is injected', () => {
    const sender = { id: 'me', frameId: 0, url: 'https://a.example/', documentId: 'DOC1', tab: { id: 3, url: 'https://a.example/' } };
    expect(validateSender(sender, 'me')).toMatchObject({ documentId: 'DOC1', frameUrl: 'https://a.example/' });
    expect(validateSender({ ...sender, documentId: undefined }, 'me')?.documentId).toBeUndefined();
  });
  it('the request names a consent tool and carries no choices', () => {
    expect(parsePageRequest({ type: 'page:purposes', op: 'apply', cmp: 'Cybotcookiebot' })).not.toBeNull();
    expect(parsePageRequest({ type: 'page:purposes', op: 'apply', cmp: 'Cybotcookiebot', analytics: true })).toBeNull();
    expect(parsePageRequest({ type: 'page:purposes', op: 'write', cmp: 'Cybotcookiebot' })).toBeNull();
  });
});

describe('objection to legitimate interest', () => {
  it('is listed only for tools with a documented refuse-everything call, by the engine snippet name', async () => {
    const { objectionSnippet } = await import('../../src/engines/objections');
    const { snippetById } = await import('../../src/engines/autoconsent/background');
    expect(objectionSnippet('didomi')).toBe('EVAL_DIDOMI_OPT_OUT');
    expect(typeof snippetById('EVAL_DIDOMI_OPT_OUT')).toBe('function');
    for (const cmp of ['quantcast', 'Sourcepoint-frame', 'Onetrust', 'constructor', '__proto__', undefined]) expect(objectionSnippet(cmp)).toBeNull();
  });
  it('the snippet can only refuse: it calls setUserDisagreeToAll and nothing else', async () => {
    const { snippetById } = await import('../../src/engines/autoconsent/background');
    const source = String(snippetById('EVAL_DIDOMI_OPT_OUT'));
    expect(source).toContain('setUserDisagreeToAll');
    expect(source).not.toMatch(/Agree\b(?!ToAll)|setUserAgreeToAll|setCurrentUserStatus/);
  });
});
