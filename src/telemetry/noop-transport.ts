import type { TelemetryBatch } from './schema';
import type { TelemetryTransport } from './transport';

/** Accepts a batch and does nothing with it. Performs no input or output of any kind. */
export class NoopTransport implements TelemetryTransport {
  readonly transmits = false;
  /** Number of batches handed over, for tests. Nothing is retained. */
  received = 0;
  async send(batch: TelemetryBatch): Promise<void> {
    void batch;
    this.received++;
  }
}
