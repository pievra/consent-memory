import { telemetryBatchSchema, telemetryRecordSchema, type TelemetryBatch, type TelemetryRecord } from './schema';

/** Returns the record if it conforms exactly to the schema, otherwise null. Unknown keys are refused. */
export function validateRecord(raw: unknown): TelemetryRecord | null {
  const parsed = telemetryRecordSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const PROHIBITED: ReadonlyArray<[string, RegExp]> = [
  ['url', /[a-z][a-z0-9+.-]*:\/\//i],
  ['domain', /\b[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\b/i],
  ['ip_address', /\b\d{1,3}(\.\d{1,3}){3}\b|\b[0-9a-f]{1,4}(:[0-9a-f]{0,4}){3,}\b/i],
  ['uuid', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i],
  ['timestamp', /\d{4}-\d{2}-\d{2}|\d{2}:\d{2}/],
  ['long_token', /[A-Za-z0-9_-]{24,}/],
  ['email', /[^\s@]+@[^\s@]+/],
];

/**
 * Second, independent check on anything about to be handed to a transport: walks every
 * string and key and reports the kinds of prohibited content found. The schema already
 * makes these impossible; this exists so that a future schema mistake is caught.
 */
export function findProhibited(value: unknown, found = new Set<string>(), depth = 0): string[] {
  if (depth > 8) {
    found.add('too_deep');
  } else if (typeof value === 'string') {
    for (const [name, pattern] of PROHIBITED) if (pattern.test(value)) found.add(name);
  } else if (typeof value === 'number') {
    if (value > 1e9) found.add('large_number'); // epoch times, identifiers
  } else if (Array.isArray(value)) {
    for (const item of value) findProhibited(item, found, depth + 1);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      findProhibited(key, found, depth + 1);
      findProhibited(item, found, depth + 1);
    }
  }
  return [...found].sort();
}

/** A batch is acceptable only if it matches the schema exactly and the independent scan finds nothing. */
export function validateBatch(raw: unknown): TelemetryBatch | null {
  const parsed = telemetryBatchSchema.safeParse(raw);
  if (!parsed.success) return null;
  // The period ("2026-W46") is the one permitted coarse date; everything else is scanned.
  return findProhibited(parsed.data.rows).length === 0 ? parsed.data : null;
}
