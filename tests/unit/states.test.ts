import { describe, expect, it } from 'vitest';
import { MAX_ACTION_ATTEMPTS } from '../../src/config/constants';
import { createRun, step, type EngineEvent, type Run, type StepContext } from '../../src/core/consent/executor';
import { REFUSE_ALL, PURPOSES, type Purpose } from '../../src/core/consent/purposes';
import type { ChoiceSource } from '../../src/core/consent/resolver';
import { assertTransition, canTransition, CONSENT_STATUSES, IllegalTransitionError, MACHINE_STATES, toConsentStatus, TRANSITIONS } from '../../src/core/consent/states';
import { decideVerdict, evaluateTcf, type Evidence, type EvidenceOutcome } from '../../src/core/consent/verifier';

const sources = (s: ChoiceSource) => Object.fromEntries(PURPOSES.map((p) => [p, s])) as Record<Purpose, ChoiceSource>;
const refuseAll: StepContext = { resolution: { paused: false, choices: { ...REFUSE_ALL }, sources: sources('default') }, unsafeContext: false };
const mixed: StepContext = {
  resolution: { paused: false, choices: { ...REFUSE_ALL, preferences: 'allow' }, sources: { ...sources('default'), preferences: 'site' } },
  unsafeContext: false,
};

function play(events: EngineEvent[], ctx: StepContext = refuseAll): { run: Run; commands: string[] } {
  let run = createRun();
  const commands: string[] = [];
  for (const e of events) {
    const r = step(run, e, ctx);
    run = r.run;
    commands.push(...r.commands.map((c) => (c.type === 'run_action' ? `run:${c.action}` : c.type === 'collect_evidence' ? `collect:${c.kind}` : c.type)));
  }
  return { run, commands };
}
const ev = (kind: Evidence['kind'], outcome: EvidenceOutcome): EngineEvent => ({ type: 'evidence', evidence: { kind, outcome } });

describe('transition table', () => {
  it('allows exactly the specified transitions (all 121 pairs)', () => {
    const allowed = new Set([
      'NOT_DETECTED>DETECTED',
      'DETECTED>PREFERENCES_RESOLVED', 'DETECTED>SKIPPED', 'DETECTED>UNSUPPORTED',
      'PREFERENCES_RESOLVED>ACTION_ATTEMPTED', 'PREFERENCES_RESOLVED>SKIPPED', 'PREFERENCES_RESOLVED>UNSUPPORTED',
      'ACTION_ATTEMPTED>ACTION_RECORDED', 'ACTION_ATTEMPTED>FAILED', 'ACTION_ATTEMPTED>INCONCLUSIVE',
      'ACTION_RECORDED>VERIFIED', 'ACTION_RECORDED>PARTIAL',
    ]);
    let pairs = 0;
    for (const from of MACHINE_STATES) {
      for (const to of MACHINE_STATES) {
        expect(canTransition(from, to), `${from}>${to}`).toBe(allowed.has(`${from}>${to}`));
        pairs++;
      }
    }
    expect(pairs).toBe(121);
    expect(() => assertTransition('ACTION_ATTEMPTED', 'VERIFIED')).toThrow(IllegalTransitionError);
  });

  it('reaches VERIFIED only through ACTION_RECORDED', () => {
    for (const from of MACHINE_STATES) {
      if (TRANSITIONS[from].includes('VERIFIED')) expect(from).toBe('ACTION_RECORDED');
    }
  });

  it("maps only VERIFIED to the 'verified' status", () => {
    for (const s of MACHINE_STATES) {
      expect(CONSENT_STATUSES).toContain(toConsentStatus(s));
      expect(toConsentStatus(s) === 'verified').toBe(s === 'VERIFIED');
    }
  });
});

describe('decideVerdict', () => {
  const outcomes: EvidenceOutcome[] = ['confirms', 'partial', 'contradicts', 'unavailable'];
  it('is VERIFIED only with confirmation, no partial, no contradiction, nothing unfulfilled (all 512 cases)', () => {
    let cases = 0;
    for (let mask = 0; mask < 2 ** 8; mask++) {
      const evidence: Evidence[] = [];
      outcomes.forEach((o, i) => {
        if (mask & (1 << i)) evidence.push({ kind: 'cmp_self_test', outcome: o });
        if (mask & (1 << (i + 4))) evidence.push({ kind: 'tcf_read', outcome: o });
      });
      for (const unfulfilled of [[], ['analytics']] as Purpose[][]) {
        const has = (o: EvidenceOutcome) => evidence.some((e) => e.outcome === o);
        const verdict = decideVerdict(evidence, { unfulfilled });
        expect(verdict === 'VERIFIED').toBe(has('confirms') && !has('partial') && !has('contradicts') && unfulfilled.length === 0);
        if (!has('confirms') && !has('partial')) expect(['FAILED', 'INCONCLUSIVE']).toContain(verdict);
        cases++;
      }
    }
    expect(cases).toBe(512);
  });
  it('is INCONCLUSIVE with no evidence', () => {
    expect(decideVerdict([], { unfulfilled: [] })).toBe('INCONCLUSIVE');
    expect(decideVerdict([{ kind: 'tcf_read', outcome: 'unavailable' }], { unfulfilled: [] })).toBe('INCONCLUSIVE');
  });
});

describe('evaluateTcf', () => {
  const flags = (ids: number[]) => Object.fromEntries(ids.map((i) => [String(i), true]));
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  it('is unavailable without a settled snapshot', () => {
    expect(evaluateTcf(null, 'optOut').outcome).toBe('unavailable');
    expect(evaluateTcf({ eventStatus: 'cmpuishown', consents: {}, legitimateInterests: {} }, 'optOut').outcome).toBe('unavailable');
    expect(evaluateTcf({ consents: {}, legitimateInterests: {} }, 'optOut').outcome).toBe('unavailable');
  });
  it('confirms a refusal only when consent and legitimate interest are both off', () => {
    expect(evaluateTcf({ eventStatus: 'useractioncomplete', consents: {}, legitimateInterests: {} }, 'optOut').outcome).toBe('confirms');
    expect(evaluateTcf({ eventStatus: 'useractioncomplete', consents: {}, legitimateInterests: flags([2, 7]) }, 'optOut').outcome).toBe('partial');
    expect(evaluateTcf({ eventStatus: 'tcloaded', consents: flags([1]), legitimateInterests: {} }, 'optOut').outcome).toBe('contradicts');
  });
  it('judges an opt in only when all or none of the purposes are set', () => {
    expect(evaluateTcf({ eventStatus: 'tcloaded', consents: flags(all), legitimateInterests: {} }, 'optIn').outcome).toBe('confirms');
    expect(evaluateTcf({ eventStatus: 'tcloaded', consents: {}, legitimateInterests: {} }, 'optIn').outcome).toBe('contradicts');
    expect(evaluateTcf({ eventStatus: 'tcloaded', consents: flags([1, 2]), legitimateInterests: {} }, 'optIn').outcome).toBe('unavailable');
  });
});

describe('executor', () => {
  const found: EngineEvent = { type: 'popup_found', cmp: 'Onetrust' };
  const ok = (selfTestAvailable: boolean): EngineEvent => ({ type: 'action_result', ok: true, selfTestAvailable });
  const fail: EngineEvent = { type: 'action_result', ok: false, selfTestAvailable: false };

  it('refuses by default and verifies with a confirming self test', () => {
    const { run, commands } = play([found, ok(true), ev('cmp_self_test', 'confirms'), ev('tcf_read', 'unavailable')]);
    expect(run.state).toBe('VERIFIED');
    expect(commands).toEqual(['report', 'run:optOut', 'report', 'collect:cmp_self_test', 'collect:tcf_read', 'report']);
  });

  it('never reports success when the action completed but nothing could be read back', () => {
    expect(play([found, ok(false), ev('tcf_read', 'unavailable')]).run.state).toBe('INCONCLUSIVE');
    expect(play([found, ok(true), { type: 'timeout' }]).run.state).toBe('INCONCLUSIVE');
  });

  it('fails when the CMP contradicts the action', () => {
    expect(play([found, ok(true), ev('cmp_self_test', 'contradicts'), ev('tcf_read', 'unavailable')]).run.state).toBe('FAILED');
  });

  it('is partial when TCF legitimate interest remains or preferences were mixed', () => {
    expect(play([found, ok(true), ev('cmp_self_test', 'confirms'), ev('tcf_read', 'partial')]).run.state).toBe('PARTIAL');
    const m = play([found, ok(true), ev('cmp_self_test', 'confirms'), ev('tcf_read', 'confirms')], mixed);
    expect(m.run.state).toBe('PARTIAL');
    expect(m.run.plan?.unfulfilled).toEqual(['preferences']);
    expect(m.commands).toContain('run:optOut');
    expect(m.commands).not.toContain('run:optIn');
  });

  it(`retries at most ${MAX_ACTION_ATTEMPTS} times then fails`, () => {
    const { run, commands } = play([found, fail, fail, fail, fail, fail]);
    expect(run.state).toBe('FAILED');
    expect(run.attempts).toBe(MAX_ACTION_ATTEMPTS);
    expect(commands.filter((c) => c.startsWith('run:')).length).toBe(MAX_ACTION_ATTEMPTS);
  });

  it('does nothing when paused or when the context is unsafe', () => {
    const paused = play([found], { resolution: { paused: true }, unsafeContext: false });
    expect(paused.run.state).toBe('SKIPPED');
    expect(paused.commands).toEqual(['report']);
    const unsafe = play([found], { ...refuseAll, unsafeContext: true });
    expect(unsafe.run).toMatchObject({ state: 'SKIPPED', reason: 'unsafe_context' });
    expect(unsafe.commands.some((c) => c.startsWith('run:'))).toBe(false);
  });

  it('ignores duplicate and out of order events', () => {
    const { run, commands } = play([found, found, { type: 'cmp_detected', cmp: 'x' }, ok(true), ok(true), ev('cmp_self_test', 'confirms'), ev('cmp_self_test', 'confirms'), ev('tcf_read', 'confirms'), found, fail]);
    expect(run.state).toBe('VERIFIED');
    expect(commands.filter((c) => c.startsWith('run:')).length).toBe(1);
    expect(run.evidence.length).toBe(2);
    expect(play([ev('cmp_self_test', 'confirms')]).run.state).toBe('NOT_DETECTED');
    expect(play([ok(true)]).run.state).toBe('NOT_DETECTED');
  });

  it('never issues an opt in for any event sequence under default preferences (random walk, 20,000 steps)', () => {
    const events: EngineEvent[] = [found, { type: 'cmp_detected', cmp: 'c' }, ok(true), ok(false), fail, { type: 'timeout' },
      ev('cmp_self_test', 'confirms'), ev('cmp_self_test', 'contradicts'), ev('tcf_read', 'confirms'), ev('tcf_read', 'partial'), ev('tcf_read', 'unavailable')];
    let seed = 42;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
    let run = createRun();
    for (let i = 0; i < 20000; i++) {
      if (i % 12 === 0) run = createRun();
      const r = step(run, events[Math.floor(rand() * events.length)]!, refuseAll);
      for (const c of r.commands) if (c.type === 'run_action') expect(c.action).toBe('optOut');
      if (r.run.state === 'VERIFIED') expect(r.run.evidence.some((e) => e.outcome === 'confirms')).toBe(true);
      run = r.run;
    }
  });

  describe('resume_check', () => {
    const detected: EngineEvent = { type: 'cmp_detected', cmp: 'Onetrust' };
    const resume: EngineEvent = { type: 'resume_check', cmp: 'Onetrust' };
    it('checks the stored result without issuing any action', () => {
      const { run, commands } = play([detected, resume, ev('cmp_self_test', 'confirms')]);
      expect(run.state).toBe('VERIFIED');
      expect(run.attempts).toBe(0);
      expect(commands).toEqual(['report', 'collect:cmp_self_test', 'report']);
      expect(commands.some((c) => c.startsWith('run:'))).toBe(false);
    });
    it('fails when the CMP does not report the refusal, and stays inconclusive without an answer', () => {
      expect(play([detected, resume, ev('cmp_self_test', 'contradicts')]).run.state).toBe('FAILED');
      expect(play([detected, resume, { type: 'timeout' }]).run.state).toBe('INCONCLUSIVE');
    });
    it('does nothing when paused, when a banner is open, before detection, or when the user allowed everything', () => {
      expect(play([detected, resume], { resolution: { paused: true }, unsafeContext: false }).run.state).toBe('DETECTED');
      expect(play([resume]).run.state).toBe('NOT_DETECTED');
      const afterPopup = play([{ type: 'popup_found', cmp: 'Onetrust' }, resume]);
      expect(afterPopup.commands.filter((c) => c.startsWith('collect:'))).toEqual([]);
      const allowAll: StepContext = { resolution: { paused: false, choices: Object.fromEntries(PURPOSES.map((p) => [p, 'allow'])) as Record<Purpose, 'allow'>, sources: sources('site') }, unsafeContext: false };
      expect(play([detected, resume], allowAll).run.state).toBe('DETECTED');
    });
  });
});

describe('toolbar mark', () => {
  const now = Date.parse('2026-11-11T12:00:00.000Z');
  const rec = (status: string, extra: Record<string, unknown> = {}) => ({ status, paused: false, ...extra });
  it('gives each kind of result its own character, and nothing when nothing was done', async () => {
    const { badgeFor } = await import('../../src/core/consent/badge');
    expect(badgeFor(null, now)).toBeNull();
    expect(badgeFor(rec('verified', { lastVerified: '2026-11-10T12:00:00.000Z' }), now)?.text).toBe('✓');
    expect(badgeFor(rec('partial'), now)?.text).toBe('!');
    expect(badgeFor(rec('attempted'), now)?.text).toBe('?');
    expect(badgeFor(rec('inconclusive'), now)?.text).toBe('?');
    expect(badgeFor(rec('failed'), now)?.text).toBe('×');
    for (const status of ['detected', 'not_detected', 'skipped', 'unsupported']) expect(badgeFor(rec(status), now)).toBeNull();
    expect(badgeFor(rec('detected', { wallSeenAt: '2026-11-11T11:00:00.000Z' }), now)?.text).toBe('!');
    expect(badgeFor(rec('verified', { paused: true, lastVerified: '2026-11-10T12:00:00.000Z' }), now)?.text).toBe('II');
  });
  it('never shows a tick for anything but a current, verified result', async () => {
    const { badgeFor } = await import('../../src/core/consent/badge');
    expect(badgeFor(rec('verified', { lastVerified: '2026-01-01T12:00:00.000Z' }), now)).toBeNull();
    for (const status of ['partial', 'recorded', 'attempted', 'inconclusive', 'failed', 'detected', 'not_detected', 'skipped', 'unsupported']) {
      expect(badgeFor(rec(status, { lastVerified: '2026-11-10T12:00:00.000Z' }), now)?.text).not.toBe('✓');
    }
  });
});

describe('accepting on a consent tool with no accept steps', () => {
  it('ends without an attempt and with a reason, never as a success or a retry', async () => {
    const { createRun, step } = await import('../../src/core/consent/executor');
    const all = Object.fromEntries(['storage', 'preferences', 'analytics', 'content', 'advertising', 'other'].map((p) => [p, 'allow']));
    const user = Object.fromEntries(Object.keys(all).map((p) => [p, 'site']));
    const ctx = { resolution: { paused: false, choices: all, sources: user }, unsafeContext: false } as never;
    let r = step(createRun(), { type: 'popup_found', cmp: 'didomi' }, ctx);
    expect(r.commands.at(-1)).toEqual({ type: 'run_action', action: 'optIn' });
    r = step(r.run, { type: 'action_result', ok: false, selfTestAvailable: false, noRoute: true }, ctx);
    expect(r.run.state).toBe('INCONCLUSIVE');
    expect(r.run.reason).toBe('no_accept_route');
    expect(r.run.attempts).toBe(0);
    expect(r.commands).toEqual([{ type: 'report' }]);
  });
});
