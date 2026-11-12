import type { TelemetryBatch } from './schema';

/**
 * How a validated batch would leave the device. There is exactly one implementation,
 * NoopTransport. Adding another requires Decision B in docs/telemetry/decision-register.md;
 * a unit test fails if a second implementation appears in this directory.
 */
export interface TelemetryTransport {
  readonly transmits: boolean;
  send(batch: TelemetryBatch): Promise<void>;
}
