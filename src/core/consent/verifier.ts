import { TCF_PURPOSE_MAP, type ActionPlan, type EngineAction } from './mappings';
import type { Purpose } from './purposes';

/** `cmp_state_read`: per purpose state read by the background through a purpose adapter. */
export const EVIDENCE_KINDS = ['cmp_self_test', 'tcf_read', 'cmp_state_read'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/**
 * confirms    — the CMP state matches the executed action.
 * partial     — matches in part (for example legitimate interest still declared).
 * contradicts — the CMP state shows the opposite of the executed action.
 * unavailable — the source could not be read; counts for nothing.
 */
export const EVIDENCE_OUTCOMES = ['confirms', 'partial', 'contradicts', 'unavailable'] as const;
export type EvidenceOutcome = (typeof EVIDENCE_OUTCOMES)[number];

export interface Evidence {
  kind: EvidenceKind;
  outcome: EvidenceOutcome;
  detail?: string;
}

export type Verdict = 'VERIFIED' | 'PARTIAL' | 'FAILED' | 'INCONCLUSIVE';

/**
 * Decide the outcome of a run from collected evidence.
 * A completed click sequence or a hidden banner is not evidence and never reaches here.
 * With no usable evidence the verdict is INCONCLUSIVE, never a success.
 */
export function decideVerdict(evidence: readonly Evidence[], plan: Pick<ActionPlan, 'unfulfilled'>): Verdict {
  const confirms = evidence.some((e) => e.outcome === 'confirms');
  const partial = evidence.some((e) => e.outcome === 'partial');
  const contradicts = evidence.some((e) => e.outcome === 'contradicts');

  if (contradicts) return confirms || partial ? 'INCONCLUSIVE' : 'FAILED';
  if (confirms && !partial && plan.unfulfilled.length === 0) return 'VERIFIED';
  if (confirms || partial) return 'PARTIAL';
  return 'INCONCLUSIVE';
}

/** Minimal projection of TCF TCData. Built by the reader; never written back to the page. */
export interface TcfSnapshot {
  eventStatus?: string | undefined;
  consents: Record<string, boolean>;
  legitimateInterests: Record<string, boolean>;
}

const SETTLED_TCF_STATES = new Set(['tcloaded', 'useractioncomplete']);

/**
 * Compare a read only TCF snapshot with the action that was executed.
 * Legitimate interest that remains declared after a refusal is reported as an
 * observation ("partial"); it is not a statement about lawfulness.
 */
export function evaluateTcf(snapshot: TcfSnapshot | null, action: EngineAction): Evidence {
  if (!snapshot || !snapshot.eventStatus || !SETTLED_TCF_STATES.has(snapshot.eventStatus)) {
    return { kind: 'tcf_read', outcome: 'unavailable' };
  }
  // A purpose by purpose choice is checked against the consent tool's own state, not against TCF.
  if (action === 'purposes') return { kind: 'tcf_read', outcome: 'unavailable' };
  const ids = Object.keys(TCF_PURPOSE_MAP);
  const consented = ids.filter((id) => snapshot.consents[id] === true);
  const withInterest = ids.filter((id) => snapshot.legitimateInterests[id] === true);

  if (action === 'optOut') {
    if (consented.length > 0) {
      return { kind: 'tcf_read', outcome: 'contradicts', detail: `TCF consent still set for ${consented.length} purposes` };
    }
    if (withInterest.length > 0) {
      return {
        kind: 'tcf_read',
        outcome: 'partial',
        detail: `TCF consent refused; legitimate interest still declared for ${withInterest.length} purposes`,
      };
    }
    return { kind: 'tcf_read', outcome: 'confirms', detail: 'TCF consent and legitimate interest refused for all purposes' };
  }

  if (consented.length === ids.length) {
    return { kind: 'tcf_read', outcome: 'confirms', detail: 'TCF consent set for all purposes' };
  }
  if (consented.length === 0) {
    return { kind: 'tcf_read', outcome: 'contradicts', detail: 'TCF consent not set for any purpose' };
  }
  // A site may not use every purpose, so a subset cannot be judged.
  return { kind: 'tcf_read', outcome: 'unavailable' };
}

/**
 * Compare what a consent tool reports as stored, purpose by purpose, with what was asked of it:
 * the purposes in `grant` on, every other offered purpose off.
 * - a purpose that should be off and is reported on contradicts: never a success;
 * - a purpose that should be on and is reported off is "partial": nothing unwanted is on, the grant did not take;
 * - `settled` false means the tool has not recorded an answer yet: nothing can be concluded.
 */
export function evaluatePurposeState(read: { settled: boolean; states: Partial<Record<Purpose, boolean>> } | null, grant: readonly Purpose[]): Evidence {
  if (!read || !read.settled) return { kind: 'cmp_state_read', outcome: 'unavailable' };
  const offered = Object.keys(read.states) as Purpose[];
  if (offered.length === 0) return { kind: 'cmp_state_read', outcome: 'unavailable' };
  const stillOn = offered.filter((p) => !grant.includes(p) && read.states[p] === true);
  const notGranted = offered.filter((p) => grant.includes(p) && read.states[p] === false);
  if (stillOn.length > 0) return { kind: 'cmp_state_read', outcome: 'contradicts', detail: `CMP reports ${stillOn.length} refused purposes as on` };
  if (notGranted.length > 0) return { kind: 'cmp_state_read', outcome: 'partial', detail: `CMP reports ${notGranted.length} allowed purposes as off` };
  return { kind: 'cmp_state_read', outcome: 'confirms', detail: `CMP reports your choice for each of its ${offered.length} purposes` };
}
