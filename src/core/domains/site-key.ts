import { parse } from 'tldts';

export interface SiteKeys {
  /** Full host, lower case, punycode. */
  host: string;
  /**
   * Key under which a site's record is stored: the registrable domain
   * (private suffixes honoured, so a.github.io ≠ b.github.io), or the host
   * itself for IP addresses, localhost and single label names.
   */
  site: string;
}

/** Returns null for anything that is not an http(s) page. */
export function siteKeysForUrl(rawUrl: string): SiteKeys | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return null;
  const parsed = parse(host, { allowPrivateDomains: true });
  const site = !parsed.isIp && parsed.domain ? parsed.domain : host;
  return { host, site };
}

const DOMAIN_PATTERN = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

/** Validates a stored or imported key: a bare host, no scheme, port, path or upper case. */
export function isValidSiteKey(value: string): boolean {
  return DOMAIN_PATTERN.test(value) || /^\[[0-9a-f:]+\]$/.test(value);
}
