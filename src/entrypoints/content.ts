import AutoConsent, { type ContentScriptMessage } from '@duckduckgo/autoconsent';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type { AuditResponse, EvalResponse, InitResponse, PageRequest, PurposesResponse, ReportResponse, TcfResponse } from '../adapters/shared/protocol';
import { EVIDENCE_DELAY_MS, RESUME_AFTER_MS, RUN_TIMEOUT_MS, SEND_ATTEMPTS, SEND_RETRY_DELAY_MS, SEND_TIMEOUT_MS, WALL_CHECK_INTERVAL_MS, WALL_CHECKS } from '../config/constants';
import { objectionSnippet } from '../engines/objections';
import { wallMarker } from '../engines/walls';
import { AFTER_WINDOW_MS } from '../audit/collector';
import { isTerminal } from '../core/consent/states';
import { createRun, step, type Command, type EngineEvent, type Run, type StepContext } from '../core/consent/executor';
import type { Evidence, EvidenceKind } from '../core/consent/verifier';
import { evaluateTcf } from '../core/consent/verifier';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  runAt: 'document_end',
  main() {
    void start();
  },
});

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The background service worker can be stopped by the browser at any moment,
 * including while a message is in flight; the call then rejects. Every request
 * is safe to repeat (reads, or a report that overwrites itself), so retry a few
 * times: the next message starts the worker again.
 */
async function send<T>(request: PageRequest, attempts = SEND_ATTEMPTS): Promise<T | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      // Every valid request gets an object back. An empty answer means the worker
      // went away before replying, which Chrome may report without an error.
      // A message can also be left unanswered for good when the worker is stopped at
      // the wrong moment, so each attempt has a time limit.
      const response = (await Promise.race([
        browser.runtime.sendMessage(request),
        wait(SEND_TIMEOUT_MS).then(() => null),
      ])) as T | null | undefined;
      if (response !== null && response !== undefined) return response;
    } catch {
      /* fall through to the retry */
    }
    await wait(SEND_RETRY_DELAY_MS * (attempt + 1));
  }
  // Background unavailable (extension reloaded or disabled). Do nothing rather than act blind.
  return null;
}

/** True when acting now could disturb the user: a password or payment card field already has content. */
function unsafeContext(): boolean {
  const filled = (selector: string) =>
    Array.from(document.querySelectorAll<HTMLInputElement>(selector)).some((input) => input.value.length > 0);
  return filled('input[type="password"]') || filled('input[autocomplete^="cc-"]');
}

async function start(): Promise<void> {
  const init = await send<InitResponse>({ type: 'page:init' });
  if (!init || init.mode !== 'run') return;

  let run: Run = createRun();
  const stateTests = new Set(init.stateTests);
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const context = (): StepContext => ({ resolution: init.resolution, unsafeContext: unsafeContext(), purposeOfferings: init.purposeOfferings });

  const dispatch = (event: EngineEvent): void => {
    const result = step(run, event, context());
    run = result.run;
    for (const command of result.commands) void execute(command);
  };

  const collect = async (kind: EvidenceKind): Promise<void> => {
    await wait(EVIDENCE_DELAY_MS);
    if (kind === 'cmp_self_test') {
      // The answer comes back through onEngineMessage as 'selfTestResult'.
      await engine.receiveMessageCallback({ type: 'selfTest' });
      return;
    }
    if (kind === 'cmp_state_read') {
      // Read by the background from the page; this script only passes the answer on.
      const response = run.cmp ? await send<PurposesResponse>({ type: 'page:purposes', op: 'read', cmp: run.cmp }) : null;
      dispatch({ type: 'evidence', evidence: response?.evidence ?? { kind: 'cmp_state_read', outcome: 'unavailable' } });
      return;
    }
    const action = run.plan?.action;
    // The read itself always targets the top frame and is done by the background. A frame from
    // another site may ask too: what it can then claim about the page is limited in applyReport.
    if (!action) {
      dispatch({ type: 'evidence', evidence: { kind: 'tcf_read', outcome: 'unavailable' } });
      return;
    }
    const response = await send<TcfResponse>({ type: 'page:tcf' });
    dispatch({ type: 'evidence', evidence: evaluateTcf(response?.snapshot ?? null, action) });
  };

  const execute = async (command: Command): Promise<void> => {
    switch (command.type) {
      case 'report':
        await send({
          type: 'page:report',
          state: run.state,
          cmp: run.cmp,
          reason: run.reason,
          evidence: run.evidence,
          unfulfilled: run.plan?.unfulfilled ?? [],
          attempts: run.attempts,
          actionCompleted: run.actionCompleted,
        });
        // Once the run has an outcome, keep the page under observation for the audit window, then conclude it.
        if (isTerminal(run.state) && !auditFinishScheduled) {
          auditFinishScheduled = true;
          setTimeout(() => void send({ type: 'page:audit', event: 'finish', clicks: engineClicks, pageLoad: auditPageLoad }), AFTER_WINDOW_MS + 500);
        }
        return;
      case 'run_action':
        timeout ??= setTimeout(() => dispatch({ type: 'timeout' }), RUN_TIMEOUT_MS);
        // Let the engine finish its current step first; back off before a retry.
        await wait(run.attempts > 1 ? 500 : 0);
        if (command.action === 'purposes') {
          // Set through the consent tool's own interface by the background. Nothing is clicked.
          // Sent once: submitting a choice is not something to repeat. With no answer at all the
          // submission may or may not have happened, so the run goes on to read what was stored
          // and never falls back to clicking. Only an explicit "not applied" falls back.
          const response = run.cmp ? await send<PurposesResponse>({ type: 'page:purposes', op: 'apply', cmp: run.cmp }, 1) : { applied: false };
          engineClicks = 0;
          dispatch({ type: 'action_result', ok: response === null || response.applied === true, selfTestAvailable: false });
          return;
        }
        if (command.action === 'optIn') {
          // The engine's bundled rules carry no accept steps for consent tools described as data;
          // asking it to accept would click nothing and report success. Report the truth instead.
          const steps = (engine.foundCmp as { rule?: { optIn?: unknown } } | null)?.rule?.optIn;
          if (Array.isArray(steps) && steps.length === 0) {
            engineClicks = 0;
            dispatch({ type: 'action_result', ok: false, selfTestAvailable: false, noRoute: true });
            return;
          }
        }
        await engine.receiveMessageCallback({ type: command.action });
        return;
      case 'collect_evidence':
        await collect(command.kind);
        return;
    }
  };

  /**
   * What a self test result is worth depends on what the test reads. Only tests that read
   * the CMP's stored state can confirm a refusal. The rest check that the banner is gone,
   * which is recorded and counts for nothing.
   */
  const selfTestEvidence = (cmp: string, passed: boolean): Evidence => {
    if (stateTests.has(cmp)) {
      return passed
        ? { kind: 'cmp_self_test', outcome: 'confirms', detail: 'CMP reports the refusal as stored' }
        : { kind: 'cmp_self_test', outcome: 'contradicts', detail: 'CMP does not report the refusal as stored' };
    }
    return passed
      ? { kind: 'cmp_self_test', outcome: 'unavailable', detail: 'Banner closed; this banner product gives no way to read what was stored' }
      : { kind: 'cmp_self_test', outcome: 'contradicts', detail: 'Banner still open after the refusal steps' };
  };

  /**
   * An earlier run acted and was cut short, typically because the site reloaded after the
   * refusal. If no banner opens on this load, check what the CMP stored. Nothing is clicked.
   */
  let bannerAnnounced = false;
  let auditPageLoad: number | undefined;
  let auditFinishScheduled = false;
  let engineClicks: number | undefined;
  let resumeScheduled = false;
  const scheduleResume = (cmp: string): void => {
    if (resumeScheduled) return;
    resumeScheduled = true;
    setTimeout(() => {
      const rule = engine.rules.find((candidate) => candidate.name === cmp);
      if (run.state !== 'DETECTED' || !rule || !rule.hasSelfTest || !stateTests.has(cmp)) return;
      engine.foundCmp = rule;
      dispatch({ type: 'resume_check', cmp });
    }, RESUME_AFTER_MS);
  };

  /**
   * The engine found a consent tool but no banner it may answer. If that tool is showing its
   * "accept or pay" wall, say so. Nothing is clicked: the marker is only looked for.
   */
  let wallChecks = 0;
  const scheduleWallCheck = (cmp: string): void => {
    const marker = wallMarker(cmp);
    if (marker === null || wallChecks > 0) return;
    const check = (): void => {
      wallChecks += 1;
      if (run.state !== 'DETECTED') return;
      const el = document.querySelector(marker);
      if (el instanceof HTMLElement && el.getClientRects().length > 0) void send<ReportResponse>({ type: 'page:wall', cmp }, 1);
      else if (wallChecks < WALL_CHECKS) setTimeout(check, WALL_CHECK_INTERVAL_MS);
    };
    setTimeout(check, WALL_CHECK_INTERVAL_MS);
  };

  const onEngineMessage = async (message: ContentScriptMessage): Promise<void> => {
    switch (message.type) {
      case 'eval': {
        // Only snippets shipped with the engine run, selected by identifier. `message.code` is ignored.
        const response = message.snippetId ? await send<EvalResponse>({ type: 'page:eval', snippetId: message.snippetId }) : null;
        await engine.receiveMessageCallback({ type: 'evalResp', id: message.id, result: response?.result === true });
        return;
      }
      case 'cmpDetected':
        dispatch({ type: 'cmp_detected', cmp: message.cmp });
        scheduleWallCheck(message.cmp);
        if (init.resumeCmp !== null && init.resumeCmp === message.cmp) scheduleResume(message.cmp);
        return;
      case 'popupFound':
        if (!bannerAnnounced) {
          bannerAnnounced = true;
          // Recorded before any action so the audit knows what the page did while unanswered.
          auditPageLoad = (await send<AuditResponse>({ type: 'page:audit', event: 'banner' }))?.pageLoad;
        }
        dispatch({ type: 'popup_found', cmp: message.cmp });
        return;
      case 'autoconsentDone':
        engineClicks = message.totalClicks;
        return;
      case 'optOutResult':
        // A refusal went through: where the tool documents it, object to legitimate interest too.
        // Asked once and not trusted; the evidence read that follows decides what is reported.
        if (message.result) {
          if (objectionSnippet(message.cmp) !== null) await send<EvalResponse>({ type: 'page:object', cmp: message.cmp }, 1);
        }
        dispatch({ type: 'action_result', ok: message.result, selfTestAvailable: message.scheduleSelfTest });
        return;
      case 'optInResult':
        dispatch({ type: 'action_result', ok: message.result, selfTestAvailable: message.scheduleSelfTest });
        return;
      case 'selfTestResult':
        dispatch({
          type: 'evidence',
          evidence: selfTestEvidence(message.cmp, message.result),
        });
        return;
      default:
        return;
    }
  };

  const engine = new AutoConsent(onEngineMessage, init.config, { autoconsent: [], compact: init.rules });
}
