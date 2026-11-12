import { describe, expect, it } from 'vitest';
import { planWholeBannerAction, TCF_PURPOSE_MAP } from '../../src/core/consent/mappings';
import { PURPOSES, type Choice, type Purpose } from '../../src/core/consent/purposes';
import { resolvePreferences } from '../../src/core/consent/resolver';

type Level = Choice | undefined;
const LEVELS: Level[] = [undefined, 'allow', 'refuse'];

/** Every combination of (site, global) per purpose is 9^6; sample the full grid per purpose pair instead. */
function* grid(): Generator<{ site: Partial<Record<Purpose, Choice>>; global: Partial<Record<Purpose, Choice>> }> {
  // Exhaustive over all 3^6 site assignments crossed with 3 uniform global assignments, and vice versa.
  const assign = (n: number) => {
    const out: Partial<Record<Purpose, Choice>> = {};
    PURPOSES.forEach((p, i) => {
      const level = LEVELS[Math.floor(n / 3 ** i) % 3];
      if (level) out[p] = level;
    });
    return out;
  };
  for (let s = 0; s < 3 ** 6; s++) {
    for (const g of [0, 364, 728]) yield { site: assign(s), global: assign(g) };
    for (const g of [0, 364, 728]) yield { site: assign(g), global: assign(s) };
  }
}

describe('resolvePreferences', () => {
  it('refuses everything with no input', () => {
    const r = resolvePreferences({ paused: false, site: {}, global: {} });
    expect(r.paused).toBe(false);
    if (r.paused) return;
    for (const p of PURPOSES) {
      expect(r.choices[p]).toBe('refuse');
      expect(r.sources[p]).toBe('default');
    }
  });

  it('pause overrides every choice', () => {
    const all = Object.fromEntries(PURPOSES.map((p) => [p, 'allow'])) as Record<Purpose, Choice>;
    expect(resolvePreferences({ paused: true, site: all, global: all })).toEqual({ paused: true });
  });

  it('follows site → global → refusal for every combination', () => {
    let cases = 0;
    for (const input of grid()) {
      const r = resolvePreferences({ paused: false, ...input });
      if (r.paused) throw new Error('unexpected pause');
      for (const p of PURPOSES) {
        const expected = input.site[p] ?? input.global[p] ?? 'refuse';
        expect(r.choices[p]).toBe(expected);
        expect(r.sources[p]).toBe(input.site[p] ? 'site' : input.global[p] ? 'global' : 'default');
      }
      cases++;
    }
    expect(cases).toBe(3 ** 6 * 6);
  });

  it('never turns a malformed value into acceptance', () => {
    const junk = { analytics: 'ALLOW', advertising: true, content: 'yes', other: null } as unknown as Partial<Record<Purpose, Choice>>;
    const r = resolvePreferences({ paused: false, site: junk, global: junk });
    if (r.paused) throw new Error('unexpected pause');
    for (const p of PURPOSES) expect(r.choices[p]).toBe('refuse');
  });
});

describe('planWholeBannerAction', () => {
  const resolve = (site: Partial<Record<Purpose, Choice>>, global: Partial<Record<Purpose, Choice>> = {}) => {
    const r = resolvePreferences({ paused: false, site, global });
    if (r.paused) throw new Error('unexpected pause');
    return planWholeBannerAction(r.choices, r.sources);
  };

  it('opts out by default with nothing unfulfilled', () => {
    expect(resolve({})).toMatchObject({ action: 'optOut', unfulfilled: [] });
  });

  it('opts in only when the user allowed all six purposes', () => {
    const all = Object.fromEntries(PURPOSES.map((p) => [p, 'allow'])) as Record<Purpose, Choice>;
    expect(resolve(all).action).toBe('optIn');
    expect(resolve({}, all).action).toBe('optIn');
  });

  it('opts out for all 62 mixed combinations and lists what it cannot grant', () => {
    let mixed = 0;
    for (let n = 1; n < 2 ** 6 - 1; n++) {
      const site: Partial<Record<Purpose, Choice>> = {};
      PURPOSES.forEach((p, i) => (site[p] = n & (1 << i) ? 'allow' : 'refuse'));
      const plan = resolve(site);
      expect(plan.action).toBe('optOut');
      expect(plan.unfulfilled).toEqual(PURPOSES.filter((p) => site[p] === 'allow'));
      expect(plan.unfulfilled.length).toBeGreaterThan(0);
      mixed++;
    }
    expect(mixed).toBe(62);
  });

  it('maps TCF purposes 1 to 11 and nothing else', () => {
    expect(Object.keys(TCF_PURPOSE_MAP).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(new Set(Object.values(TCF_PURPOSE_MAP)).has('preferences')).toBe(false);
  });
});
