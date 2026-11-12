import { PURPOSES, type Choice, type Choices, type Purpose } from './purposes';

/** Where a resolved choice came from, in order of precedence. */
export type ChoiceSource = 'site' | 'global' | 'default';

export interface ResolverInput {
  /** Site is paused or excluded by the user. */
  paused: boolean;
  /** Choices the user set explicitly for this site. Absent purposes are not set. */
  site: Partial<Record<Purpose, Choice>>;
  /** Choices the user set as global defaults. Absent purposes are not set. */
  global: Partial<Record<Purpose, Choice>>;
}

export type Resolution =
  | { paused: true }
  | { paused: false; choices: Choices; sources: Record<Purpose, ChoiceSource> };

/**
 * Resolution order (specification section 7):
 * 1. site paused, 2. explicit site choice, 3. global user choice, 4. refusal.
 * Anything that is not exactly 'allow' or 'refuse' is ignored, so a missing or
 * malformed value can never resolve to acceptance.
 */
export function resolvePreferences(input: ResolverInput): Resolution {
  if (input.paused) return { paused: true };
  const choices = {} as Choices;
  const sources = {} as Record<Purpose, ChoiceSource>;
  for (const purpose of PURPOSES) {
    const site = input.site[purpose];
    const global = input.global[purpose];
    if (site === 'allow' || site === 'refuse') {
      choices[purpose] = site;
      sources[purpose] = 'site';
    } else if (global === 'allow' || global === 'refuse') {
      choices[purpose] = global;
      sources[purpose] = 'global';
    } else {
      choices[purpose] = 'refuse';
      sources[purpose] = 'default';
    }
  }
  return { paused: false, choices, sources };
}
