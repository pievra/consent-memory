/** Minimal key value store. Implemented by each browser adapter and by an in memory fake in tests. */
export interface StoragePort {
  /** null returns every key. Missing keys are absent from the result. */
  get(keys: string[] | null): Promise<Record<string, unknown>>;
  /** Must reject when the write did not happen (for example quota exceeded). */
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}
