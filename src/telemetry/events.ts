import type { ConsentStatus } from '../core/consent/states';
import type { SIGNAL_CATEGORIES } from './schema';

/**
 * What the rest of the extension would tell telemetry. These carry more than may ever
 * leave the device (a rule name, a duration in milliseconds); minimisation.ts reduces
 * them. They never carry a site address: the type has no field for one.
 */
export type DomainEvent =
  | { type: 'cmp_detected'; cmpRule: string }
  | { type: 'consent_action_outcome'; cmpRule: string; status: ConsentStatus; durationMs: number }
  | { type: 'privacy_signal_observed'; signal: (typeof SIGNAL_CATEGORIES)[number] }
  | { type: 'engine_failure'; cmpRule: string }
  | { type: 'performance_observation'; durationMs: number };

export type Listener = (event: DomainEvent) => void;

/** In process publish and subscribe. With no subscriber, publishing does nothing at all. */
export function createBus() {
  const listeners = new Set<Listener>();
  return {
    publish(event: DomainEvent): void {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // A failing listener must never affect the caller: consent handling does not depend on telemetry.
        }
      }
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get size(): number {
      return listeners.size;
    },
  };
}
export type Bus = ReturnType<typeof createBus>;
