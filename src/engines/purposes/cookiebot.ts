// Purpose level adapter for Cookiebot, through the product's own documented interface.
// The two functions below run in the page's own JavaScript world: they must be self contained
// (no imports, no closures) and they never receive anything from the page or from a message.
//
// Why this adapter can be trusted to grant the right purpose: Cookiebot's categories are fixed
// by the product for every site (necessary, preferences, statistics, marketing). Nothing is
// inferred from position, wording or a site's configuration.

export interface CookiebotState {
  hasResponse: boolean;
  preferences: boolean;
  statistics: boolean;
  marketing: boolean;
}

interface CookiebotApi {
  submitCustomConsent?: (preferences: boolean, statistics: boolean, marketing: boolean) => unknown;
  hide?: () => unknown;
  hasResponse?: unknown;
  dialog?: { visible?: unknown } | null;
  consent?: { preferences?: unknown; statistics?: unknown; marketing?: unknown } | null;
}

/** Submits exactly the three category choices. Returns false when the interface is not there. */
export function applyCookiebotInPage(preferences: boolean, statistics: boolean, marketing: boolean): boolean {
  const api = (window as unknown as { Cookiebot?: CookiebotApi }).Cookiebot;
  if (!api || typeof api.submitCustomConsent !== 'function') return false;
  try {
    api.submitCustomConsent(preferences === true, statistics === true, marketing === true);
    if (api.dialog?.visible === true && typeof api.hide === 'function') api.hide();
    return true;
  } catch {
    return false;
  }
}

/** Reads what Cookiebot reports as stored. Read only. */
export function readCookiebotInPage(): CookiebotState | null {
  const api = (window as unknown as { Cookiebot?: CookiebotApi }).Cookiebot;
  const consent = api?.consent;
  if (!api || !consent) return null;
  if (typeof consent.preferences !== 'boolean' || typeof consent.statistics !== 'boolean' || typeof consent.marketing !== 'boolean') return null;
  return { hasResponse: api.hasResponse === true, preferences: consent.preferences, statistics: consent.statistics, marketing: consent.marketing };
}
