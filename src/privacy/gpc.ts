// Global Privacy Control: the request header `Sec-GPC: 1` and the page property
// `navigator.globalPrivacyControl`. Pure builders only; the browser calls are in the adapter.

export const GPC_RULE_ID = 1;
export const GPC_SCRIPT_ID = 'gpc-signal';
export const GPC_SCRIPT_FILE = 'gpc-signal.js';

export interface GpcHeaderRule {
  id: number;
  priority: number;
  action: { type: 'modifyHeaders'; requestHeaders: Array<{ header: string; operation: 'set'; value: string }> };
  condition: {
    urlFilter: string;
    resourceTypes: string[];
    excludedRequestDomains?: string[];
    excludedInitiatorDomains?: string[];
  };
}

const RESOURCE_TYPES = ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'];

/**
 * The header rule, or null when GPC is off. On a paused site the extension does nothing,
 * so requests to that site and requests made by its pages are left untouched.
 */
export function gpcHeaderRule(enabled: boolean, pausedDomains: readonly string[]): GpcHeaderRule | null {
  if (!enabled) return null;
  const paused = excludable(pausedDomains);
  return {
    id: GPC_RULE_ID,
    priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Sec-GPC', operation: 'set', value: '1' }] },
    condition: {
      urlFilter: '*',
      resourceTypes: RESOURCE_TYPES,
      ...(paused.length > 0 ? { excludedRequestDomains: paused, excludedInitiatorDomains: paused } : {}),
    },
  };
}

export interface GpcScriptRegistration {
  id: string;
  js: string[];
  matches: string[];
  excludeMatches?: string[];
  runAt: 'document_start';
  world: 'MAIN';
  allFrames: true;
  persistAcrossSessions: true;
}

/**
 * Paused sites that can be expressed as an exclusion. A bracketed IPv6 literal is not valid in a
 * match pattern or a domain list, and one invalid entry would make the browser reject the whole
 * update, so such a site is left out: it stays paused for consent handling but still receives GPC.
 */
export function excludable(pausedDomains: readonly string[]): string[] {
  return [...new Set(pausedDomains)].filter((d) => !d.includes(':') && !d.includes('[')).sort();
}

/** Match patterns covering a site and its subdomains, any port. */
export function sitePatterns(domain: string): string[] {
  return [`*://${domain}/*`, `*://*.${domain}/*`];
}

/** Registration for the page signal script, or null when GPC is off. Paused sites are excluded. */
export function gpcScriptRegistration(enabled: boolean, pausedDomains: readonly string[]): GpcScriptRegistration | null {
  if (!enabled) return null;
  const excluded = excludable(pausedDomains).flatMap(sitePatterns);
  return {
    id: GPC_SCRIPT_ID,
    js: [GPC_SCRIPT_FILE],
    matches: ['http://*/*', 'https://*/*'],
    ...(excluded.length > 0 ? { excludeMatches: excluded } : {}),
    runAt: 'document_start',
    world: 'MAIN',
    allFrames: true,
    persistAcrossSessions: true,
  };
}

/** True when an existing registration already covers exactly the sites the wanted one does. */
export function sameScriptTargets(
  existing: { matches?: string[] | undefined; excludeMatches?: string[] | undefined },
  wanted: Pick<GpcScriptRegistration, 'matches' | 'excludeMatches'>,
): boolean {
  const key = (list: readonly string[] | undefined) => [...(list ?? [])].sort().join('\n');
  return key(existing.matches) === key(wanted.matches) && key(existing.excludeMatches) === key(wanted.excludeMatches);
}
