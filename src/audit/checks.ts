import { AFTER_WINDOW_MS, afterWindowComplete, type PageAudit } from './collector';
import { TRACKER_COUNT, TRACKER_LIST_VERSION } from './trackers';

export const AUDIT_CHECKS = [
  'tracking_before_consent',
  'tracking_after_refusal',
  'refusal_accessibility',
  'optional_purposes_preselected',
  'consent_information_available',
  'gpc_behaviour',
] as const;
export type AuditCheckId = (typeof AUDIT_CHECKS)[number];

export const AUDIT_OUTCOMES = ['passed', 'signal_detected', 'inconclusive', 'not_applicable'] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export interface AuditCheckResult {
  check: AuditCheckId;
  outcome: AuditOutcome;
  /** Listed service domains, or a count. Never a URL, path or identifier. */
  services?: string[] | undefined;
  count?: number | undefined;
}

export interface AuditResult {
  schemaVersion: 1;
  trackerListVersion: string;
  trackersKnown: number;
  /** ISO date and hour; minutes are dropped. */
  observedAt: string;
  checks: AuditCheckResult[];
}

export interface AuditContext {
  /** The refusal was a refusal (not an opt in the user asked for). */
  refused: boolean;
  gpcEnabled: boolean;
  now: number;
}

/**
 * Turns one page's observations into the six technical checks.
 *
 * These are observations of what the browser could see, not findings about lawfulness:
 * a request to a listed service may be necessary or lawful. Missing evidence is always
 * "inconclusive", never "passed".
 */
export function buildAudit(page: PageAudit, ctx: AuditContext): AuditResult {
  const checks: AuditCheckResult[] = [];

  // 1. Tracking before consent: listed services contacted while the banner was unanswered.
  // "Passed" needs the unanswered banner to have been watched for long enough: until the refusal
  // completed, or for a full window. A page that navigates away at once proves nothing.
  const watchedBefore = page.actedAt !== undefined || (page.bannerSeenAt !== undefined && ctx.now - page.bannerSeenAt >= AFTER_WINDOW_MS);
  if (page.before.length > 0) checks.push({ check: 'tracking_before_consent', outcome: 'signal_detected', services: page.before.slice(0, 10), count: page.before.length });
  else checks.push({ check: 'tracking_before_consent', outcome: watchedBefore ? 'passed' : 'inconclusive' });

  // 2. Tracking after refusal: only judged when a refusal completed and the whole window was watched.
  if (!ctx.refused || page.actedAt === undefined) checks.push({ check: 'tracking_after_refusal', outcome: 'not_applicable' });
  else if (page.after.length > 0) checks.push({ check: 'tracking_after_refusal', outcome: 'signal_detected', services: page.after.slice(0, 10), count: page.after.length });
  else checks.push({ check: 'tracking_after_refusal', outcome: afterWindowComplete(page, ctx.now) ? 'passed' : 'inconclusive' });

  // 3. Refusal accessibility: how many steps the refusal took.
  if (!ctx.refused || page.actedAt === undefined) checks.push({ check: 'refusal_accessibility', outcome: 'not_applicable' });
  // Zero clicks means the refusal went through the consent tool's API: how many steps a person
  // would need was not observed.
  else if (page.clicks === undefined || page.clicks === 0) checks.push({ check: 'refusal_accessibility', outcome: 'inconclusive' });
  else checks.push({ check: 'refusal_accessibility', outcome: page.clicks <= 1 ? 'passed' : 'signal_detected', count: page.clicks });

  // 4. Optional purposes enabled by default: consent already set while the banner was still unanswered.
  const tcf = page.tcfBefore;
  if (!tcf || tcf.eventStatus !== 'cmpuishown') checks.push({ check: 'optional_purposes_preselected', outcome: 'inconclusive' });
  else checks.push({ check: 'optional_purposes_preselected', outcome: tcf.consented > 0 ? 'signal_detected' : 'passed', count: tcf.consented });

  // 5. Consent information available in a machine readable form.
  checks.push({ check: 'consent_information_available', outcome: tcf ? 'passed' : 'inconclusive' });

  // 6. Behaviour associated with GPC: only sites that expose a US privacy string can be read.
  if (!ctx.gpcEnabled || page.usp === undefined || page.usp === null) checks.push({ check: 'gpc_behaviour', outcome: 'not_applicable' });
  else if (!/^1[YN-][YN-][YN-]$/.test(page.usp)) checks.push({ check: 'gpc_behaviour', outcome: 'inconclusive' });
  else checks.push({ check: 'gpc_behaviour', outcome: page.usp[2] === 'Y' ? 'passed' : page.usp[2] === 'N' ? 'signal_detected' : 'inconclusive' });

  const observed = new Date(ctx.now);
  observed.setUTCMinutes(0, 0, 0);
  return { schemaVersion: 1, trackerListVersion: TRACKER_LIST_VERSION, trackersKnown: TRACKER_COUNT, observedAt: observed.toISOString(), checks };
}

export function summarise(audit: AuditResult): Record<AuditOutcome, number> {
  const totals: Record<AuditOutcome, number> = { passed: 0, signal_detected: 0, inconclusive: 0, not_applicable: 0 };
  for (const check of audit.checks) totals[check.outcome]++;
  return totals;
}
