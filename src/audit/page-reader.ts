/** What the page exposes about consent while its banner is still unanswered. */
export interface BannerState {
  tcf: { eventStatus?: string | undefined; consented: number } | null;
  /** IAB US privacy string, when the site exposes one. */
  usp: string | null;
}

/**
 * Runs in the page world through scripting.executeScript, so it must be self contained.
 * Read only: asks the TCF and US privacy APIs for their current state, removes the one
 * listener it adds, and returns counts and a four character string. Nothing is written.
 */
export function readBannerStateInPage(timeoutMs: number): Promise<BannerState> {
  const w = window as unknown as { __tcfapi?: unknown; __uspapi?: unknown };
  const withTimeout = <T>(run: (done: (value: T) => void) => void, fallback: T) =>
    new Promise<T>((resolve) => {
      let settled = false;
      const done = (value: T) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };
      setTimeout(() => done(fallback), timeoutMs);
      try {
        run(done);
      } catch {
        done(fallback);
      }
    });

  const tcf = withTimeout<BannerState['tcf']>((done) => {
    if (typeof w.__tcfapi !== 'function') return done(null);
    const api = w.__tcfapi as (c: string, v: number, cb: (d: unknown, ok: boolean) => void, arg?: unknown) => void;
    api('addEventListener', 2, (data, ok) => {
      const tc = (data ?? {}) as { eventStatus?: unknown; listenerId?: unknown; purpose?: { consents?: Record<string, unknown> } };
      try {
        if (tc.listenerId !== undefined) api('removeEventListener', 2, () => undefined, tc.listenerId);
      } catch {
        /* nothing else to do */
      }
      if (!ok) return done(null);
      const consented = Object.values(tc.purpose?.consents ?? {}).filter((v) => v === true).length;
      done({ eventStatus: typeof tc.eventStatus === 'string' ? tc.eventStatus.slice(0, 32) : undefined, consented });
    });
  }, null);

  const usp = withTimeout<string | null>((done) => {
    if (typeof w.__uspapi !== 'function') return done(null);
    (w.__uspapi as (c: string, v: number, cb: (d: unknown, ok: boolean) => void) => void)('getUSPData', 1, (data, ok) => {
      const value = (data as { uspString?: unknown } | null)?.uspString;
      done(ok && typeof value === 'string' && /^[0-9A-Za-z-]{4}$/.test(value) ? value : null);
    });
  }, null);

  return Promise.all([tcf, usp]).then(([t, u]) => ({ tcf: t, usp: u }));
}
