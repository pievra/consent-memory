// Background side of the Autoconsent integration: bundled rules and page world snippets.
import { evalSnippets, filterCompactRules, type CompactCMPRuleset, type IndexedCMPRuleset } from '@duckduckgo/autoconsent';
import compactRules from '@duckduckgo/autoconsent/rules/compact-rules.json';

const RULES = compactRules as unknown as IndexedCMPRuleset;

/** Rules relevant to one frame. Bundled at build time; nothing is downloaded. */
export function rulesForFrame(url: string, mainFrame: boolean): CompactCMPRuleset {
  return filterCompactRules(RULES, { url, mainFrame });
}

/**
 * A snippet shipped inside the Autoconsent package, looked up by identifier.
 * Code strings sent by a content script are never executed.
 */
export function snippetById(id: string): (() => unknown) | null {
  if (!Object.hasOwn(evalSnippets, id)) return null;
  const snippet = (evalSnippets as Record<string, unknown>)[id];
  return typeof snippet === 'function' ? (snippet as () => unknown) : null;
}
