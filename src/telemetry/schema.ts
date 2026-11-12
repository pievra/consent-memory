import { z } from 'zod';
import { CONSENT_STATUSES } from '../core/consent/states';

// Conceptual schema for a capability that is NOT authorised for production
// (docs/telemetry/decision-register.md). Every field is an enumeration: there is no
// free text field, so a site address, identifier or timestamp has nowhere to go.

export const EVENT_TYPES = ['cmp_detected', 'consent_action_outcome', 'privacy_signal_observed', 'engine_failure', 'performance_observation'] as const;
export const CMP_FAMILIES = ['onetrust', 'cookiebot', 'didomi', 'sourcepoint', 'usercentrics', 'axeptio', 'quantcast', 'trustarc', 'consentmanager', 'tealium', 'other'] as const;
export const BROWSER_FAMILIES = ['chromium', 'firefox', 'safari'] as const;
export const TIME_BANDS = ['<1s', '1-3s', '3-10s', '>10s'] as const;
export const SIGNAL_CATEGORIES = [
  'tracking_before_consent',
  'tracking_after_refusal',
  'refusal_accessibility',
  'optional_purposes_preselected',
  'consent_information_available',
  'gpc_behaviour',
] as const;

export const telemetryRecordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  eventType: z.enum(EVENT_TYPES),
  cmpFamily: z.enum(CMP_FAMILIES).optional(),
  consentStatus: z.enum(CONSENT_STATUSES).optional(),
  browserFamily: z.enum(BROWSER_FAMILIES).optional(),
  processingTimeBand: z.enum(TIME_BANDS).optional(),
  signalCategory: z.enum(SIGNAL_CATEGORIES).optional(),
});
export type TelemetryRecord = z.infer<typeof telemetryRecordSchema>;

export const aggregateRowSchema = z.strictObject({
  record: telemetryRecordSchema,
  count: z.number().int().positive(),
});
export const telemetryBatchSchema = z.strictObject({
  schemaVersion: z.literal(1),
  /** ISO week, for example 2026-W46. Coarser than a day on purpose; never a send time. */
  period: z.string().regex(/^\d{4}-W\d{2}$/),
  rows: z.array(aggregateRowSchema).max(500),
});
export type AggregateRow = z.infer<typeof aggregateRowSchema>;
export type TelemetryBatch = z.infer<typeof telemetryBatchSchema>;
