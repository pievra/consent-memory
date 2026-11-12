import type { StoragePort } from '../../src/adapters/shared/ports';

export class MemoryStorage implements StoragePort {
  data = new Map<string, unknown>();
  failWrites = false;
  writes = 0;
  async get(keys: string[] | null): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const key of keys ?? [...this.data.keys()]) {
      if (this.data.has(key)) out[key] = structuredClone(this.data.get(key));
    }
    return out;
  }
  async set(items: Record<string, unknown>): Promise<void> {
    if (this.failWrites) throw new Error('QUOTA_BYTES quota exceeded');
    this.writes++;
    for (const [k, v] of Object.entries(items)) this.data.set(k, structuredClone(v));
  }
  async remove(keys: string[]): Promise<void> {
    for (const k of keys) this.data.delete(k);
  }
}

export const FIXED_NOW = () => new Date('2026-11-10T12:00:00.000Z');
