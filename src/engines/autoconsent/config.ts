import type { Config } from '@duckduckgo/autoconsent';

/** Version of @duckduckgo/autoconsent whose code and rules are bundled. Checked against the lockfile by a unit test. */
export const AUTOCONSENT_VERSION = '18.1.0';

/**
 * Rules that are not flagged cosmetic but act cosmetically, switched off by name.
 * - sourcepoint-top: hides the Sourcepoint message container in the top frame whether or not
 *   a refusal was recorded, including on "consent or pay" walls. The companion frame rule,
 *   which performs the real rejection inside the message frame, stays enabled.
 */
export const DISABLED_CMPS: readonly string[] = Object.freeze(['sourcepoint-top']);

/**
 * Autoconsent configuration.
 * - autoAction null: the engine never acts on its own; the state machine decides.
 * - Heuristic detection off: no button is ever chosen by text matching.
 * - Generated ("auto_") rules off: only reviewed, hand written rules run.
 * - Cosmetic rules and prehide off: a banner is never hidden without a recorded choice.
 */
export function autoconsentConfig(): Config {
  return {
    enabled: true,
    autoAction: null,
    disabledCmps: [...DISABLED_CMPS],
    enablePrehide: false,
    enableCosmeticRules: false,
    enableGeneratedRules: false,
    detectRetries: 20,
    isMainWorld: false,
    prehideTimeout: 2000,
    enableHeuristicDetection: false,
    enablePopupMutationObserver: false,
    visualTest: false,
    logs: { lifecycle: false, rulesteps: false, detectionsteps: false, evals: false, errors: false, messages: false, waits: false },
    performanceLoggingEnabled: false,
    heuristicPopupSearchTimeout: 0,
    enableHeuristicHitTest: false,
    heuristicMode: 'off',
  };
}
