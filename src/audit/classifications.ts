import { siteKeysForUrl } from '../core/domains/site-key';
import { TRACKERS, type TrackerCategory } from './trackers';

export interface TrackerMatch {
  /** The listed service domain, not the full request host. */
  service: string;
  category: TrackerCategory;
}

/** Matches a request host against the list: the host itself or any parent domain. */
export function trackerFor(host: string): TrackerMatch | null {
  let candidate = host.toLowerCase();
  for (;;) {
    const category = TRACKERS.get(candidate);
    if (category) return { service: candidate, category };
    const dot = candidate.indexOf('.');
    if (dot === -1) return null;
    candidate = candidate.slice(dot + 1);
  }
}

/**
 * A request counts only when it goes to a listed service on a different site from the page.
 * A tracking company's own website loading its own domain is not an observation about
 * consent.
 */
export function observedTracker(requestUrl: string, pageSite: string): TrackerMatch | null {
  const keys = siteKeysForUrl(requestUrl);
  if (!keys || keys.site === pageSite) return null;
  return trackerFor(keys.host);
}
