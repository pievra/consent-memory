import generated from './state-tests.json';

/**
 * Self tests written in code inside the Autoconsent package (lib/cmps), reviewed by hand at 18.1.0.
 * Each of these reads a cookie or the CMP's own API. 'Uniconsent' is deliberately absent:
 * its test only checks that the banner element is gone.
 */
export const CODE_RULE_NAMES: readonly string[] = ['consentmanager.net', 'Conversant', 'Cybotcookiebot', 'Klaro', 'Onetrust', 'tiktok.com', 'TrustArc-top', 'Uniconsent', 'Admiral', 'Evidon', 'Sourcepoint-frame'];
const CODE_RULES_WITH_STATE_TEST = ['consentmanager.net', 'Conversant', 'Cybotcookiebot', 'Klaro', 'Onetrust', 'tiktok.com', 'TrustArc-top'];

const STATE_TESTS: ReadonlySet<string> = new Set([...(generated as string[]), ...CODE_RULES_WITH_STATE_TEST]);

/**
 * True when the rule's self test reads what the CMP stored. For every other rule a passing
 * self test means only "the banner is no longer visible", which must never count as
 * confirmation (specification section 2.3).
 */
export function hasStateReadingTest(cmp: string): boolean {
  return STATE_TESTS.has(cmp);
}
