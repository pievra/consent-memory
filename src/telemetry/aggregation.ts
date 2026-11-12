import type { AggregateRow, TelemetryBatch, TelemetryRecord } from './schema';

/** Tuples seen fewer times than this on one device in a week are merged into 'other', then dropped. */
export const MIN_LOCAL_COUNT = 5;
/** Upper bound on one tuple's count, which bounds one device's weight in any total. */
export const MAX_ROW_COUNT = 50;

const FIELD_ORDER = ['schemaVersion', 'eventType', 'cmpFamily', 'consentStatus', 'browserFamily', 'processingTimeBand', 'signalCategory'] as const;

/** Stable key: same record, same key, whatever order its fields were set in. */
export function recordKey(record: TelemetryRecord): string {
  return FIELD_ORDER.map((field) => `${field}=${record[field] ?? ''}`).join('|');
}

function count(records: readonly TelemetryRecord[]): Map<string, AggregateRow> {
  const rows = new Map<string, AggregateRow>();
  for (const record of records) {
    const key = recordKey(record);
    const row = rows.get(key);
    if (row) row.count++;
    else rows.set(key, { record: { ...record }, count: 1 });
  }
  return rows;
}

/** ISO 8601 week of a date, in UTC, as "YYYY-Www". */
export function isoWeek(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Local aggregation for one period. Deterministic: the same records always give the same
 * batch, byte for byte. Rare tuples are first merged across CMP families, and whatever is
 * still rare is dropped. Counts are capped.
 *
 * A threshold and a cap reduce what a batch reveals; they do not make it anonymous
 * (docs/telemetry/privacy-design.md, section 4).
 */
export function aggregate(records: readonly TelemetryRecord[], period: string): TelemetryBatch {
  const first = count(records);
  const merged: TelemetryRecord[] = [];
  for (const row of first.values()) {
    const record = row.count < MIN_LOCAL_COUNT && row.record.cmpFamily ? { ...row.record, cmpFamily: 'other' as const } : row.record;
    for (let i = 0; i < row.count; i++) merged.push(record);
  }
  const rows = [...count(merged).entries()]
    .filter(([, row]) => row.count >= MIN_LOCAL_COUNT)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, row]) => ({ record: row.record, count: Math.min(row.count, MAX_ROW_COUNT) }));
  return { schemaVersion: 1, period, rows };
}
