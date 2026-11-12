import type { ReportRequest } from '../adapters/shared/protocol';
import { MAX_EVIDENCE_LINE_LENGTH, MAX_EVIDENCE_LINES, RESUME_WINDOW_MS } from '../config/constants';
import { MAPPING_VERSION, type ActionPlan } from '../core/consent/mappings';
import { toConsentStatus, type ConsentStatus } from '../core/consent/states';
import { decideVerdict, type Evidence, type TcfSnapshot } from '../core/consent/verifier';
import { siteKeysForUrl } from '../core/domains/site-key';
import { wallMarker } from '../engines/walls';
import { newSiteRecord, type SiteRecord } from './schema';

/** Statuses that carry the outcome of an earlier action and must not be replaced by a mere detection. */
const OUTCOME_STATUSES: ReadonlySet<ConsentStatus> = new Set(['attempted', 'recorded', 'verified', 'partial', 'failed', 'inconclusive']);

/** Outcomes established by the site's own frames. A frame from another site can never replace them. */
const SITE_OWNED_OUTCOMES: ReadonlySet<ConsentStatus> = new Set(['recorded', 'verified', 'partial', 'failed']);
/** Statuses a frame from another site is not allowed to assert about the top level site. */
const SUCCESS_STATUSES: ReadonlySet<ConsentStatus> = new Set(['recorded', 'verified', 'partial']);

function evidenceLine(e: Evidence): string {
  const line = e.detail ? `${e.kind}: ${e.outcome} — ${e.detail}` : `${e.kind}: ${e.outcome}`;
  return line.slice(0, MAX_EVIDENCE_LINE_LENGTH);
}

/**
 * Folds a validated run report into the site record.
 * Returns null when nothing should be written:
 * - no CMP was detected (sites without a banner are not remembered at all);
 * - a CMP was detected without an open banner and an earlier outcome is on record.
 * User choices, `setBy` and `paused` are never modified here.
 *
 * `sameSite` is false when the report comes from an embedded frame whose site
 * differs from the top level page (decided by the background from the browser's
 * sender data, never from message content). Such a frame may host a real CMP,
 * but it may equally be an advertisement or other third party content, so it:
 * - cannot overwrite an outcome established by the site's own frames;
 * - cannot mark the site as verified, partial or recorded — its result is stored as inconclusive.
 */
export function applyReport(
  existing: SiteRecord | null,
  domain: string,
  report: ReportRequest,
  engineVersion: string,
  now: Date,
  sameSite: boolean,
): SiteRecord | null {
  if (report.state === 'NOT_DETECTED') return null;
  let status = toConsentStatus(report.state);
  if (status === 'detected' && existing && OUTCOME_STATUSES.has(existing.status)) return null;
  if (!sameSite) {
    // A frame from another site never creates or refreshes a record just by containing a consent tool.
    if (status === 'detected') return null;
    if (existing && SITE_OWNED_OUTCOMES.has(existing.status)) return null;
    // Nor may it displace an attempt by the site's own frames that is still waiting for its check.
    if (existing && existing.status === 'attempted' && existing.attemptOrigin === 'site') return null;
    if (SUCCESS_STATUSES.has(status)) status = 'inconclusive';
  }

  const record: SiteRecord = existing ?? newSiteRecord(domain, MAPPING_VERSION);
  record.status = status;
  delete record.wallSeenAt;
  record.engine = 'autoconsent';
  record.cmpRuleVersion = engineVersion;
  record.mappingVersion = MAPPING_VERSION;
  if (report.cmp) record.cmp = report.cmp;

  const lines = report.evidence.filter((e) => e.outcome !== 'unavailable' || e.detail !== undefined).map(evidenceLine);
  if (report.reason) lines.push(`reason: ${report.reason}`);
  if (!sameSite) lines.push('source: embedded frame from another site; not counted as verification');
  record.evidenceSummary = lines.slice(0, MAX_EVIDENCE_LINES);
  record.unfulfilled = [...report.unfulfilled];

  if (report.attempts > 0) {
    record.lastAttempted = now.toISOString();
    record.attemptOrigin = sameSite ? 'site' : 'other_site_frame';
  }
  if (status === 'verified') record.lastVerified = now.toISOString();
  return record;
}

/**
 * Marks a record as an "accept or pay" wall. Only wording changes: the status stays 'detected',
 * no attempt or verification is recorded and no choice is touched. It applies only when
 * - the frame that saw the wall is the site's own (an advert must not be able to label the page);
 * - the consent tool is one with a known wall marker, and is the tool on record for the site;
 * - the record says nothing more than "detected". An outcome from an earlier visit is kept.
 * The mark is dropped by the next report for the site and lapses on its own after WALL_LABEL_MS,
 * for the case where no further report comes.
 */
export function applyWall(existing: SiteRecord | null, cmp: string, sameSite: boolean, now: Date): SiteRecord | null {
  if (!sameSite || wallMarker(cmp) === null) return null;
  if (!existing || existing.status !== 'detected' || existing.cmp !== cmp) return null;
  existing.wallSeenAt = now.toISOString();
  return existing;
}

/**
 * Decides whether a snapshot read from a tab's top level page may be used to conclude
 * a frame's attempt on `site`. Two conditions:
 *
 * 1. The tab is on `site` both immediately before and immediately after the read. The
 *    addresses come from the browser (tabs API), never from the page, which could lie. The read happens a moment after
 *    the frame's report, and the tab may have navigated elsewhere in between; another
 *    site's consent state must never be written against this one.
 * 2. The page reports a user action completed in this page load. 'tcloaded' (a choice
 *    loaded from an earlier visit) says nothing about what this run did, so it is not
 *    accepted here.
 */
export function topFrameSnapshotFor(
  site: string,
  snapshot: TcfSnapshot | null,
  tabUrlBefore: string | undefined,
  tabUrlAfter: string | undefined,
): TcfSnapshot | null {
  if (!snapshot || snapshot.eventStatus !== 'useractioncomplete') return null;
  for (const url of [tabUrlBefore, tabUrlAfter]) {
    if (!url || siteKeysForUrl(url)?.site !== site) return null;
  }
  return snapshot;
}

/**
 * Completes a record left at 'attempted' by an embedded frame, using evidence the
 * background read itself from the top level page (never evidence supplied by the frame).
 *
 * CMPs that live in a frame (Sourcepoint style) remove that frame when the user's choice
 * is made, so the frame's own run cannot finish. The frame's only contribution is "the
 * refusal steps completed"; whether the site is verified is decided here from the page's
 * own consent state. Returns null when there is nothing to conclude.
 */
export function applyTopFrameEvidence(
  existing: SiteRecord | null,
  evidence: Evidence,
  plan: Pick<ActionPlan, 'unfulfilled'>,
  now: Date,
): SiteRecord | null {
  if (!existing || existing.status !== 'attempted' || evidence.outcome === 'unavailable') return null;
  const verdict = decideVerdict([evidence], plan);
  const record = existing;
  record.status = verdict === 'VERIFIED' ? 'verified' : verdict === 'PARTIAL' ? 'partial' : verdict === 'FAILED' ? 'failed' : 'inconclusive';
  record.evidenceSummary = [evidenceLine(evidence), 'source: read from the page after the banner frame acted'];
  record.unfulfilled = [...plan.unfulfilled];
  if (record.status === 'verified') record.lastVerified = now.toISOString();
  return record;
}

/**
 * Decides whether a later page load may check the result of an earlier, unfinished attempt,
 * and for which CMP. All of these must hold:
 * - the record is still 'attempted' and the attempt is recent;
 * - the attempt was made by the site's own frames. An attempt reported by an embedded frame
 *   from another site never qualifies: such a frame must not be able to arrange for the
 *   site's ordinary stored state to be read later and presented as a verified refusal;
 * - the CMP is known. The content script checks only this CMP, and only if it is the one
 *   it detects on the page.
 */
export function resumableCmp(record: SiteRecord | null, now: Date): string | null {
  if (!record || record.status !== 'attempted' || record.attemptOrigin !== 'site') return null;
  if (!record.cmp || !record.lastAttempted) return null;
  const age = now.getTime() - Date.parse(record.lastAttempted);
  return age >= 0 && age < RESUME_WINDOW_MS ? record.cmp : null;
}
