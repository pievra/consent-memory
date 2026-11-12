export const MACHINE_STATES = [
  'NOT_DETECTED',
  'DETECTED',
  'PREFERENCES_RESOLVED',
  'ACTION_ATTEMPTED',
  'ACTION_RECORDED',
  'VERIFIED',
  'PARTIAL',
  'FAILED',
  'INCONCLUSIVE',
  'UNSUPPORTED',
  'SKIPPED',
] as const;
export type MachineState = (typeof MACHINE_STATES)[number];

export const CONSENT_STATUSES = [
  'not_detected',
  'detected',
  'attempted',
  'recorded',
  'verified',
  'partial',
  'failed',
  'inconclusive',
  'unsupported',
  'skipped',
] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

/**
 * The only legal transitions. ACTION_RECORDED is entered only when evidence
 * confirms the CMP stored the choice; VERIFIED is reachable only from there.
 */
export const TRANSITIONS: Readonly<Record<MachineState, readonly MachineState[]>> = Object.freeze({
  NOT_DETECTED: ['DETECTED'],
  DETECTED: ['PREFERENCES_RESOLVED', 'SKIPPED', 'UNSUPPORTED'],
  PREFERENCES_RESOLVED: ['ACTION_ATTEMPTED', 'SKIPPED', 'UNSUPPORTED'],
  ACTION_ATTEMPTED: ['ACTION_RECORDED', 'FAILED', 'INCONCLUSIVE'],
  ACTION_RECORDED: ['VERIFIED', 'PARTIAL'],
  VERIFIED: [],
  PARTIAL: [],
  FAILED: [],
  INCONCLUSIVE: [],
  UNSUPPORTED: [],
  SKIPPED: [],
});

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: MachineState,
    readonly to: MachineState,
  ) {
    super(`Illegal consent state transition ${from} → ${to}`);
    this.name = 'IllegalTransitionError';
  }
}

export function canTransition(from: MachineState, to: MachineState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: MachineState, to: MachineState): MachineState {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
  return to;
}

export function isTerminal(state: MachineState): boolean {
  return TRANSITIONS[state].length === 0;
}

const STATUS_BY_STATE: Readonly<Record<MachineState, ConsentStatus>> = Object.freeze({
  NOT_DETECTED: 'not_detected',
  DETECTED: 'detected',
  PREFERENCES_RESOLVED: 'detected',
  ACTION_ATTEMPTED: 'attempted',
  ACTION_RECORDED: 'recorded',
  VERIFIED: 'verified',
  PARTIAL: 'partial',
  FAILED: 'failed',
  INCONCLUSIVE: 'inconclusive',
  UNSUPPORTED: 'unsupported',
  SKIPPED: 'skipped',
});

/** Persisted status for a machine state. Only VERIFIED maps to 'verified'. */
export function toConsentStatus(state: MachineState): ConsentStatus {
  return STATUS_BY_STATE[state];
}
