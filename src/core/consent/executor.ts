import { MAX_ACTION_ATTEMPTS } from '../../config/constants';
import { planAction, planWholeBannerAction, type ActionPlan, type EngineAction, type PurposeOffering } from './mappings';
import type { Resolution } from './resolver';
import { assertTransition, isTerminal, type MachineState } from './states';
import { decideVerdict, type Evidence, type EvidenceKind } from './verifier';

/** State of one consent run on one page load, in one frame. Plain data. */
export interface Run {
  state: MachineState;
  cmp?: string;
  plan?: ActionPlan;
  attempts: number;
  evidence: Evidence[];
  /** The engine finished its steps. Not evidence of anything by itself. */
  actionCompleted?: boolean;
  /** This run only checks the result of an earlier, interrupted run. It performs no action. */
  resumed?: boolean;
  /** Evidence sources asked for and not yet answered. */
  pending: EvidenceKind[];
  /** Short machine reason for SKIPPED, UNSUPPORTED or FAILED. */
  reason?: string;
}

export type EngineEvent =
  | { type: 'cmp_detected'; cmp: string }
  | { type: 'popup_found'; cmp: string }
  /** No banner is open, and an earlier run on this site acted without concluding. Check what the CMP stored. */
  | { type: 'resume_check'; cmp: string }
  /** `noRoute`: the engine has no steps for this action on this consent tool, so nothing was clicked. */
  | { type: 'action_result'; ok: boolean; selfTestAvailable: boolean; noRoute?: boolean }
  | { type: 'evidence'; evidence: Evidence }
  | { type: 'timeout' };

export type Command =
  | { type: 'run_action'; action: EngineAction }
  | { type: 'collect_evidence'; kind: EvidenceKind }
  | { type: 'report' };

export interface StepContext {
  resolution: Resolution;
  /** True when acting now could disturb the user (for example a filled password or card field). */
  unsafeContext: boolean;
  /** Consent tool name → purposes it lets us set one by one. Empty where that is not available (frames, feature off). */
  purposeOfferings?: Readonly<Record<string, PurposeOffering>>;
}

export interface StepResult {
  run: Run;
  commands: Command[];
}

export function createRun(): Run {
  return { state: 'NOT_DETECTED', attempts: 0, evidence: [], pending: [] };
}

function move(run: Run, to: MachineState, patch: Partial<Run> = {}): Run {
  return { ...run, ...patch, state: assertTransition(run.state, to) };
}

function conclude(run: Run): Run {
  const plan = run.plan ?? { unfulfilled: [] };
  const verdict = decideVerdict(run.evidence, plan);
  const cleared = { ...run, pending: [] };
  if (verdict === 'VERIFIED' || verdict === 'PARTIAL') {
    return move(move(cleared, 'ACTION_RECORDED'), verdict);
  }
  return move(cleared, verdict, verdict === 'FAILED' ? { reason: 'evidence_contradicts' } : {});
}

/**
 * Pure reducer for the consent state machine. It never touches the page:
 * the caller executes the returned commands and feeds results back as events.
 * Events that do not apply to the current state are ignored, which also
 * prevents duplicate or conflicting actions.
 */
export function step(run: Run, event: EngineEvent, ctx: StepContext): StepResult {
  if (isTerminal(run.state)) return { run, commands: [] };

  switch (event.type) {
    case 'cmp_detected': {
      if (run.state !== 'NOT_DETECTED') return { run, commands: [] };
      return { run: move(run, 'DETECTED', { cmp: event.cmp }), commands: [{ type: 'report' }] };
    }

    case 'popup_found': {
      if (run.state !== 'NOT_DETECTED' && run.state !== 'DETECTED') return { run, commands: [] };
      let next = run.state === 'NOT_DETECTED' ? move(run, 'DETECTED', { cmp: event.cmp }) : { ...run, cmp: event.cmp };
      if (ctx.resolution.paused) {
        return { run: move(next, 'SKIPPED', { reason: 'paused' }), commands: [{ type: 'report' }] };
      }
      const offered = ctx.purposeOfferings && Object.hasOwn(ctx.purposeOfferings, event.cmp) ? (ctx.purposeOfferings[event.cmp] ?? null) : null;
      const plan = planAction(ctx.resolution.choices, ctx.resolution.sources, offered);
      next = move(next, 'PREFERENCES_RESOLVED', { plan });
      if (ctx.unsafeContext) {
        return { run: move(next, 'SKIPPED', { reason: 'unsafe_context' }), commands: [{ type: 'report' }] };
      }
      next = move(next, 'ACTION_ATTEMPTED', { attempts: 1 });
      return { run: next, commands: [{ type: 'report' }, { type: 'run_action', action: plan.action }] };
    }

    case 'resume_check': {
      if (run.state !== 'DETECTED' || ctx.resolution.paused) return { run, commands: [] };
      const plan = planWholeBannerAction(ctx.resolution.choices, ctx.resolution.sources);
      // Only a refusal can be checked this way, and nothing is clicked on this page load.
      if (plan.action !== 'optOut') return { run, commands: [] };
      const next = move(move({ ...run, cmp: event.cmp }, 'PREFERENCES_RESOLVED', { plan }), 'ACTION_ATTEMPTED', {
        pending: ['cmp_self_test'],
        resumed: true,
      });
      return { run: next, commands: [{ type: 'collect_evidence', kind: 'cmp_self_test' }] };
    }

    case 'action_result': {
      if (run.state !== 'ACTION_ATTEMPTED' || !run.plan || run.pending.length > 0) return { run, commands: [] };
      if (run.plan.action === 'purposes') {
        if (!event.ok) {
          // The purpose interface was not usable on this page. Nothing was submitted, the banner is
          // still open: fall back to refusing everything, the same as on any other consent tool.
          if (ctx.resolution.paused) return { run, commands: [] }; // cannot happen: a paused site never gets a plan
          const plan = planWholeBannerAction(ctx.resolution.choices, ctx.resolution.sources);
          return { run: { ...run, plan }, commands: [{ type: 'run_action', action: plan.action }] };
        }
        return {
          run: { ...run, pending: ['cmp_state_read'], actionCompleted: true },
          commands: [{ type: 'report' }, { type: 'collect_evidence', kind: 'cmp_state_read' }],
        };
      }
      if (event.noRoute === true) {
        // Nothing was clicked and nothing will be: say so instead of calling it an attempt that could not be confirmed.
        return { run: move({ ...run, pending: [], attempts: 0 }, 'INCONCLUSIVE', { reason: 'no_accept_route' }), commands: [{ type: 'report' }] };
      }
      if (!event.ok) {
        if (run.attempts < MAX_ACTION_ATTEMPTS) {
          return {
            run: { ...run, attempts: run.attempts + 1 },
            commands: [{ type: 'run_action', action: run.plan.action }],
          };
        }
        return { run: move(run, 'FAILED', { reason: 'action_failed' }), commands: [{ type: 'report' }] };
      }
      const pending: EvidenceKind[] = event.selfTestAvailable ? ['cmp_self_test', 'tcf_read'] : ['tcf_read'];
      // Report straight away that the action completed: a CMP frame is often removed by its
      // own refusal, before this run can collect evidence. The background can then verify
      // from the top level page.
      return {
        run: { ...run, pending, actionCompleted: true },
        commands: [{ type: 'report' }, ...pending.map((kind) => ({ type: 'collect_evidence', kind }) as const)],
      };
    }

    case 'evidence': {
      const kind = event.evidence.kind;
      if (run.state !== 'ACTION_ATTEMPTED' || !run.pending.includes(kind)) return { run, commands: [] };
      const next: Run = {
        ...run,
        evidence: [...run.evidence, event.evidence],
        pending: run.pending.filter((k) => k !== kind),
      };
      if (next.pending.length > 0) return { run: next, commands: [] };
      return { run: conclude(next), commands: [{ type: 'report' }] };
    }

    case 'timeout': {
      if (run.state !== 'ACTION_ATTEMPTED') return { run, commands: [] };
      return { run: conclude(run), commands: [{ type: 'report' }] };
    }
  }
}
