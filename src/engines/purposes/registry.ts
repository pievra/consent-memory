// Consent tools whose purposes can be set one by one. An adapter is added only when the tool's
// categories mean the same thing on every site and the tool exposes a way to read back what it
// stored. See docs/architecture/purpose-level-execution.md for why third party click rules
// (Consent-O-Matic) were assessed and not used.
import type { PurposeOffering } from '../../core/consent/mappings';
import type { Purpose } from '../../core/consent/purposes';
import { applyCookiebotInPage, readCookiebotInPage, type CookiebotState } from './cookiebot';

export interface PurposeAdapter extends PurposeOffering {
  apply: { func: (...args: boolean[]) => boolean; args: (want: (purpose: Purpose) => boolean) => boolean[] };
  read: { func: () => unknown; states: (raw: unknown) => { settled: boolean; states: Partial<Record<Purpose, boolean>> } | null };
}

const cookiebot: PurposeAdapter = {
  offered: ['preferences', 'analytics', 'advertising'],
  // Each of Cookiebot's optional categories works by storing cookies on the device, and it has
  // no separate storage category. So none of them is granted unless storage is allowed too.
  // "Marketing" is mapped to advertising only (docs/architecture/purpose-level-execution.md).
  implies: { preferences: ['storage'], analytics: ['storage'], advertising: ['storage'] },
  apply: { func: applyCookiebotInPage, args: (want) => [want('preferences'), want('analytics'), want('advertising')] },
  read: {
    func: readCookiebotInPage,
    states: (raw) => {
      const state = raw as CookiebotState | null;
      if (!state || typeof state.preferences !== 'boolean' || typeof state.statistics !== 'boolean' || typeof state.marketing !== 'boolean') return null;
      return { settled: state.hasResponse === true, states: { preferences: state.preferences, analytics: state.statistics, advertising: state.marketing } };
    },
  },
};

/** Keyed by the name the detection engine gives the consent tool. */
const ADAPTERS: Readonly<Record<string, PurposeAdapter>> = Object.freeze({ Cybotcookiebot: cookiebot });

export function purposeAdapter(cmp: string | undefined): PurposeAdapter | null {
  return cmp !== undefined && Object.hasOwn(ADAPTERS, cmp) ? (ADAPTERS[cmp] ?? null) : null;
}

/** Consent tool name → what it offers. Plain data for the content script. */
export function purposeOfferings(): Record<string, PurposeOffering> {
  return Object.fromEntries(Object.entries(ADAPTERS).map(([cmp, adapter]) => [cmp, { offered: [...adapter.offered], implies: { ...adapter.implies } }]));
}
