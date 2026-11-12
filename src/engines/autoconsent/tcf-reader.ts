import type { TcfSnapshot } from '../../core/consent/verifier';

/**
 * Runs in the page world through scripting.executeScript, so it must be self
 * contained. Read only: it registers a TCF listener, takes the first answer and
 * removes the listener. It never writes consent state or a TC string.
 */
export function readTcfInPage(timeoutMs: number): Promise<TcfSnapshot | null> {
  return new Promise((resolve) => {
    const api = (window as unknown as { __tcfapi?: unknown }).__tcfapi;
    if (typeof api !== 'function') {
      resolve(null);
      return;
    }
    const call = api as (command: string, version: number, callback: (data: unknown, ok: boolean) => void, arg?: unknown) => void;
    let settled = false;
    const finish = (value: TcfSnapshot | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    setTimeout(() => finish(null), timeoutMs);
    const flags = (source: unknown): Record<string, boolean> => {
      const out: Record<string, boolean> = {};
      if (source && typeof source === 'object') {
        for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
          if (/^\d{1,2}$/.test(key)) out[key] = value === true;
        }
      }
      return out;
    };
    try {
      call('addEventListener', 2, (data, ok) => {
        const tc = (data ?? {}) as { eventStatus?: unknown; listenerId?: unknown; purpose?: { consents?: unknown; legitimateInterests?: unknown } };
        try {
          if (tc.listenerId !== undefined) call('removeEventListener', 2, () => undefined, tc.listenerId);
        } catch {
          /* the listener stays registered; nothing else to do */
        }
        if (!ok) {
          finish(null);
          return;
        }
        finish({
          eventStatus: typeof tc.eventStatus === 'string' ? tc.eventStatus.slice(0, 32) : undefined,
          consents: flags(tc.purpose?.consents),
          legitimateInterests: flags(tc.purpose?.legitimateInterests),
        });
      });
    } catch {
      finish(null);
    }
  });
}
