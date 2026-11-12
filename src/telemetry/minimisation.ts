import type { DomainEvent } from './events';
import { BROWSER_FAMILIES, CMP_FAMILIES, TIME_BANDS, type TelemetryRecord } from './schema';

type CmpFamily = (typeof CMP_FAMILIES)[number];
type TimeBand = (typeof TIME_BANDS)[number];

const FAMILY_PATTERNS: ReadonlyArray<[RegExp, CmpFamily]> = [
  [/onetrust/i, 'onetrust'],
  [/cookiebot/i, 'cookiebot'],
  [/didomi/i, 'didomi'],
  [/sourcepoint/i, 'sourcepoint'],
  [/usercentrics/i, 'usercentrics'],
  [/axeptio/i, 'axeptio'],
  [/quantcast/i, 'quantcast'],
  [/trustarc/i, 'trustarc'],
  [/consentmanager/i, 'consentmanager'],
  [/tealium/i, 'tealium'],
];

/**
 * Collapses a rule name to a broad family. Site specific rules (many are named after the
 * site, such as "bbc.com" or "tesco") and rare CMPs all become 'other', so a rule name
 * can never reveal which site was visited.
 */
export function cmpFamily(rule: string): CmpFamily {
  for (const [pattern, family] of FAMILY_PATTERNS) if (pattern.test(rule)) return family;
  return 'other';
}

export function timeBand(ms: number): TimeBand {
  if (!(ms >= 0)) return '>10s';
  if (ms < 1000) return '<1s';
  if (ms < 3000) return '1-3s';
  if (ms < 10_000) return '3-10s';
  return '>10s';
}

/**
 * Allow list projection. A record is built field by field from enumerated values; nothing
 * is copied from the event object, so a new field on an event cannot leak by accident.
 */
export function minimise(event: DomainEvent, browser: (typeof BROWSER_FAMILIES)[number]): TelemetryRecord {
  const base = { schemaVersion: 1 as const, browserFamily: browser };
  switch (event.type) {
    case 'cmp_detected':
      return { ...base, eventType: 'cmp_detected', cmpFamily: cmpFamily(event.cmpRule) };
    case 'consent_action_outcome':
      // The status is passed through unchanged: inconclusive stays inconclusive.
      return { ...base, eventType: 'consent_action_outcome', cmpFamily: cmpFamily(event.cmpRule), consentStatus: event.status, processingTimeBand: timeBand(event.durationMs) };
    case 'privacy_signal_observed':
      return { ...base, eventType: 'privacy_signal_observed', signalCategory: event.signal };
    case 'engine_failure':
      return { ...base, eventType: 'engine_failure', cmpFamily: cmpFamily(event.cmpRule) };
    case 'performance_observation':
      return { ...base, eventType: 'performance_observation', processingTimeBand: timeBand(event.durationMs) };
  }
}
