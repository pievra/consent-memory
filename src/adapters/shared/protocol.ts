// Message shapes between the content script and the background.
// Types only: importing this file adds no code to the content script.
import type { Config } from '@duckduckgo/autoconsent';
import type { CompactCMPRuleset } from '@duckduckgo/autoconsent';
import type { PurposeOffering } from '../../core/consent/mappings';
import type { Purpose } from '../../core/consent/purposes';
import type { Resolution } from '../../core/consent/resolver';
import type { MachineState } from '../../core/consent/states';
import type { Evidence, TcfSnapshot } from '../../core/consent/verifier';

export interface InitRequest {
  type: 'page:init';
}
export interface EvalRequest {
  type: 'page:eval';
  snippetId: string;
}
export interface TcfRequest {
  type: 'page:tcf';
}
export interface ReportRequest {
  type: 'page:report';
  state: MachineState;
  cmp?: string | undefined;
  reason?: string | undefined;
  evidence: Evidence[];
  unfulfilled: Purpose[];
  attempts: number;
  /** The engine finished its steps on this page load. */
  actionCompleted?: boolean | undefined;
}
/** Marks moments of the page's audit. `finish` is sent once the watch window after the run has passed. */
export interface AuditRequest {
  type: 'page:audit';
  event: 'banner' | 'finish';
  /** Steps the engine took to refuse, when known. */
  clicks?: number | undefined;
  /** With `finish`: the identifier of the page load, as returned by the `banner` event. */
  pageLoad?: number | undefined;
}
export interface AuditResponse {
  ok: boolean;
  /** Identifies the page load being observed. A `finish` for any other page load is ignored. */
  pageLoad?: number;
}
/**
 * Purpose by purpose handling through a purpose adapter, top frame only. The message names the
 * consent tool and nothing else: what to set is decided by the background from stored choices.
 */
export interface PurposesRequest {
  type: 'page:purposes';
  op: 'apply' | 'read';
  cmp: string;
}
export interface PurposesResponse {
  applied?: boolean;
  evidence?: Evidence;
}
/**
 * The consent tool in this frame shows an "accept or pay" wall: no free refusal exists and nothing
 * was clicked. Changes only the wording shown to the user, and only for the site's own frames.
 */
export interface WallRequest {
  type: 'page:wall';
  cmp: string;
}
/**
 * A refusal went through on this consent tool: object to legitimate interest too, where the tool
 * documents how. The message names the tool only; whether and what to run is decided by the
 * background from stored choices (see handleObject).
 */
export interface ObjectRequest {
  type: 'page:object';
  cmp: string;
}
export type PageRequest = InitRequest | EvalRequest | TcfRequest | ReportRequest | AuditRequest | PurposesRequest | WallRequest | ObjectRequest;

export type InitResponse =
  | { mode: 'skip'; reason: 'paused' | 'unsupported_page' | 'store_unavailable' }
  | {
      mode: 'run';
      resolution: Extract<Resolution, { paused: false }>;
      rules: CompactCMPRuleset;
      config: Config;
      /** Rules, among those sent, whose self test reads stored consent state. */
      stateTests: string[];
      /**
       * Set when an earlier run by this site's own frames acted and was cut short (for example
       * by a reload): the name of the CMP whose stored result should be checked. Null otherwise.
       */
      resumeCmp: string | null;
      /** Consent tool name → purposes that can be set one by one. Empty in frames. */
      purposeOfferings: Record<string, PurposeOffering>;
    };
export interface EvalResponse {
  result: boolean;
}
export interface TcfResponse {
  snapshot: TcfSnapshot | null;
}
export interface ReportResponse {
  stored: boolean;
}
