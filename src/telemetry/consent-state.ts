/**
 * The user's choice about sharing statistics. Separate from cookie preferences in
 * storage, in code and on screen.
 */
export type TelemetryConsent =
  | { status: 'unavailable' }
  | { status: 'undecided' }
  | { status: 'declined'; decidedAt: string }
  | { status: 'opted_in'; decidedAt: string; noticeVersion: number }
  | { status: 'withdrawn'; decidedAt: string };

export type ConsentAction = { type: 'opt_in'; noticeVersion: number } | { type: 'decline' } | { type: 'withdraw' };

/** The state when the feature is not built in, which is every build today. */
export const UNAVAILABLE: TelemetryConsent = Object.freeze({ status: 'unavailable' });

export function initialConsent(featureEnabled: boolean): TelemetryConsent {
  return featureEnabled ? { status: 'undecided' } : UNAVAILABLE;
}

/**
 * - 'unavailable' is absorbing: no action can leave it. Only a different build can.
 * - There is no default towards opting in; it happens only through an explicit action
 *   that names the notice version the user was shown.
 */
export function reduceConsent(state: TelemetryConsent, action: ConsentAction, now: Date): TelemetryConsent {
  if (state.status === 'unavailable') return state;
  const decidedAt = now.toISOString();
  switch (action.type) {
    case 'opt_in':
      return Number.isInteger(action.noticeVersion) && action.noticeVersion > 0 ? { status: 'opted_in', decidedAt, noticeVersion: action.noticeVersion } : state;
    case 'decline':
      return { status: 'declined', decidedAt };
    case 'withdraw':
      return state.status === 'opted_in' ? { status: 'withdrawn', decidedAt } : state;
  }
}

/**
 * Observation is permitted only with a current opt in. An opt in given for an older
 * notice does not cover a newer one: the user must choose again, so an update can
 * never widen collection on an old choice.
 */
export function mayObserve(state: TelemetryConsent, currentNoticeVersion: number): boolean {
  return state.status === 'opted_in' && state.noticeVersion === currentNoticeVersion;
}
