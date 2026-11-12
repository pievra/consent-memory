import { PURPOSES, type Choices, type Purpose } from './purposes';
import type { ChoiceSource } from './resolver';

/** Stored with every site record. Bump when any table below changes. */
export const MAPPING_VERSION = 2;

/** IAB TCF v2.2 purpose id → user facing purpose. See docs/architecture/purpose-mapping.md. */
export const TCF_PURPOSE_MAP: Readonly<Record<number, Purpose>> = Object.freeze({
  1: 'storage',
  2: 'advertising',
  3: 'advertising',
  4: 'advertising',
  5: 'content',
  6: 'content',
  7: 'advertising',
  8: 'content',
  9: 'analytics',
  10: 'analytics',
  11: 'content',
});

/** 'purposes' sets each offered purpose separately; it exists only for consent tools with a purpose adapter. */
export type EngineAction = 'optOut' | 'optIn' | 'purposes';

export interface ActionPlan {
  action: EngineAction;
  /** Purposes the user allowed that the action does not grant. Non empty means at best "partial". */
  unfulfilled: Purpose[];
  /** With the 'purposes' action: the offered purposes to switch on. Every other offered purpose is switched off. */
  grant?: Purpose[];
  mappingVersion: number;
}

/**
 * Plan for an engine that can only act on the whole banner (Autoconsent).
 *
 * Opt in is chosen only when the user explicitly allowed every purpose.
 * Any other combination is a conservative refusal, with the allowed purposes
 * listed as unfulfilled so the result is never reported as complete.
 */
export function planWholeBannerAction(choices: Choices, sources: Record<Purpose, ChoiceSource>): ActionPlan {
  const allowed = PURPOSES.filter((p) => choices[p] === 'allow');
  const everyPurposeAllowedByUser = PURPOSES.every((p) => choices[p] === 'allow' && sources[p] !== 'default');
  if (everyPurposeAllowedByUser) {
    return { action: 'optIn', unfulfilled: [], mappingVersion: MAPPING_VERSION };
  }
  return { action: 'optOut', unfulfilled: allowed, mappingVersion: MAPPING_VERSION };
}

/** What a consent tool lets us set one by one, and what granting each of those necessarily involves. */
export interface PurposeOffering {
  offered: readonly Purpose[];
  /** Granting the key also means the listed purposes happen (for example, a cookie is stored). */
  implies: Partial<Record<Purpose, readonly Purpose[]>>;
}

/**
 * Plan for a consent tool that may be able to set purposes one by one.
 *
 * `offering` is null when the tool has no purpose adapter. All refused and all allowed keep the
 * whole banner actions. For a mixed choice, an offered purpose is granted only if the user
 * allowed it and also allowed everything that granting it implies: nothing the user refused is
 * ever brought about as a side effect. If nothing can be granted, the conservative refusal
 * applies. Allowed purposes that end up neither granted nor implied by a grant are unfulfilled.
 */
export function planAction(choices: Choices, sources: Record<Purpose, ChoiceSource>, offering: PurposeOffering | null): ActionPlan {
  const whole = planWholeBannerAction(choices, sources);
  if (whole.action === 'optIn' || whole.unfulfilled.length === 0 || offering === null) return whole;
  const allowed = (p: Purpose) => choices[p] === 'allow';
  const grant = offering.offered.filter((p) => allowed(p) && (offering.implies[p] ?? []).every(allowed));
  if (grant.length === 0) return whole;
  const covered = new Set<Purpose>([...grant, ...grant.flatMap((p) => offering.implies[p] ?? [])]);
  return { action: 'purposes', unfulfilled: whole.unfulfilled.filter((p) => !covered.has(p)), grant: [...grant], mappingVersion: MAPPING_VERSION };
}
