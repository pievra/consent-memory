import { aggregate, isoWeek } from './aggregation';
import { initialConsent, mayObserve, reduceConsent, type ConsentAction, type TelemetryConsent } from './consent-state';
import type { Bus } from './events';
import { minimise } from './minimisation';
import { NoopTransport } from './noop-transport';
import { validateBatch, validateRecord } from './privacy-controls';
import type { BROWSER_FAMILIES, TelemetryRecord } from './schema';
import type { TelemetryTransport } from './transport';

export const NOTICE_VERSION = 1;

export interface TelemetryOptions {
  /** Compile time switch. False in every build today. */
  featureEnabled: boolean;
  bus: Bus;
  browser: (typeof BROWSER_FAMILIES)[number];
  transport?: TelemetryTransport;
  now?: () => Date;
}

/**
 * Wires the pipeline: bus → gate → minimise → validate → local buffer → aggregate → transport.
 *
 * Not called anywhere in the extension. It exists so the design can be tested with
 * synthetic data. With the feature off, or without a current opt in, there is no
 * subscriber on the bus: events are not observed, counted or buffered, so nothing can
 * be sent later about a time before the user agreed.
 */
export function createTelemetry(options: TelemetryOptions) {
  const transport = options.transport ?? new NoopTransport();
  const now = options.now ?? (() => new Date());
  let consent: TelemetryConsent = initialConsent(options.featureEnabled);
  let buffer: TelemetryRecord[] = [];
  let unsubscribe: (() => void) | null = null;

  const sync = (): void => {
    const allowed = mayObserve(consent, NOTICE_VERSION);
    if (allowed && !unsubscribe) {
      unsubscribe = options.bus.subscribe((event) => {
        const record = validateRecord(minimise(event, options.browser));
        if (record) buffer.push(record);
      });
    } else if (!allowed && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
      buffer = []; // withdrawing clears what has not been sent
    }
  };

  return {
    get consent(): TelemetryConsent {
      return consent;
    },
    /** What is held locally and not yet sent, for the user to inspect. */
    get pending(): readonly TelemetryRecord[] {
      return buffer;
    },
    decide(action: ConsentAction): TelemetryConsent {
      consent = reduceConsent(consent, action, now());
      sync();
      return consent;
    },
    clearPending(): void {
      buffer = [];
    },
    /** Aggregates the buffer and hands the batch to the transport. Returns false if nothing was handed over. */
    async flush(): Promise<boolean> {
      if (!mayObserve(consent, NOTICE_VERSION) || buffer.length === 0) return false;
      const batch = validateBatch(aggregate(buffer, isoWeek(now())));
      buffer = [];
      if (!batch || batch.rows.length === 0) return false;
      await transport.send(batch);
      return true;
    },
  };
}
