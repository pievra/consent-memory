// State of one page's observation. Plain data, so it can live in session storage and
// survive the background being stopped.

/** How long after a refusal requests are watched before the "after refusal" check can conclude. */
export const AFTER_WINDOW_MS = 8000;
const MAX_SERVICES = 25;

export interface PageAudit {
  site: string;
  startedAt: number;
  /** A consent banner was open on this page. Without one there is nothing to audit. */
  bannerSeenAt?: number;
  /** The refusal steps completed. */
  actedAt?: number;
  /** Listed services contacted before the refusal completed. */
  before: string[];
  /** Listed services contacted after the refusal completed. */
  after: string[];
  /**
   * A frame from another site said its refusal steps completed. Until the page itself
   * confirms it, this is only a claim: services seen from then on wait in `unconfirmed`.
   */
  claimedAt?: number;
  unconfirmed?: string[];
  clicks?: number;
  tcfBefore?: { eventStatus?: string | undefined; consented: number } | null;
  usp?: string | null;
}

export function startPageAudit(site: string, now: number): PageAudit {
  return { site, startedAt: now, before: [], after: [] };
}

/** Records a contacted service. Returns the same object when nothing changed, so callers can skip a write. */
export function observe(audit: PageAudit, service: string): PageAudit {
  const key = audit.actedAt !== undefined ? 'after' : audit.claimedAt !== undefined ? 'unconfirmed' : 'before';
  const list = audit[key] ?? [];
  if (list.includes(service) || list.length >= MAX_SERVICES) return audit;
  return { ...audit, [key]: [...list, service].sort() };
}

const merge = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])].sort().slice(0, MAX_SERVICES);

/** A frame from another site claims its refusal completed. Changes nothing about the verdict by itself. */
export function claimActed(audit: PageAudit, now: number): PageAudit {
  return audit.actedAt === undefined && audit.claimedAt === undefined ? { ...audit, claimedAt: now, unconfirmed: [] } : audit;
}

/** The page's own state confirmed the claim: the refusal counts from the moment it was claimed. */
export function confirmClaim(audit: PageAudit): PageAudit {
  if (audit.actedAt !== undefined || audit.claimedAt === undefined) return audit;
  const { claimedAt, unconfirmed, ...rest } = audit;
  return { ...rest, actedAt: claimedAt, after: merge(audit.after, unconfirmed ?? []) };
}

/**
 * Called before the checks are built. A claim that was never confirmed is dropped, and what
 * was seen after it counts as "before any confirmed refusal", which is the cautious reading:
 * an unconfirmed frame can never make "tracking after refusal" look better or worse.
 */
export function settleClaims(audit: PageAudit): PageAudit {
  if (audit.claimedAt === undefined) return audit;
  const { claimedAt: _claimedAt, unconfirmed, ...rest } = audit;
  void _claimedAt;
  return { ...rest, before: merge(audit.before, unconfirmed ?? []) };
}

export const markBanner = (audit: PageAudit, now: number): PageAudit => (audit.bannerSeenAt === undefined ? { ...audit, bannerSeenAt: now } : audit);
export const markActed = (audit: PageAudit, now: number): PageAudit => (audit.actedAt === undefined ? { ...audit, actedAt: now } : audit);

/** True once requests have been watched for the whole window after the refusal. */
export function afterWindowComplete(audit: PageAudit, now: number): boolean {
  return audit.actedAt !== undefined && now - audit.actedAt >= AFTER_WINDOW_MS;
}
