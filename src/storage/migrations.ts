import type { StoragePort } from '../adapters/shared/ports';
import { SCHEMA_VERSION } from '../config/constants';
import { KEY, metaSchema, type Meta } from './schema';

/** Transforms the whole store from version N to N+1. Must be pure. */
export type Migration = (store: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[n] upgrades version n to n+1. Empty while the store is at version 1. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = Object.freeze({});

export type OpenResult =
  | { mode: 'read_write'; meta: Meta }
  /** Store was written by a newer version, or a migration failed and was rolled back. Nothing is written. */
  | { mode: 'read_only'; reason: 'newer_store' | 'migration_failed' | 'invalid_meta' };

function isUserData(key: string): boolean {
  return !key.startsWith(KEY.backupPrefix);
}

/**
 * Opens the store, creating or upgrading it. On any migration failure the
 * previous contents are restored and the store is opened read only, so user
 * preferences are never silently lost.
 */
export async function openStore(
  port: StoragePort,
  now: () => Date,
  target: number = SCHEMA_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  validate: (store: Record<string, unknown>) => boolean = () => true,
): Promise<OpenResult> {
  const all = await port.get(null);
  const rawMeta = all[KEY.meta];

  if (rawMeta === undefined) {
    const hasData = Object.keys(all).some(isUserData);
    if (hasData) return { mode: 'read_only', reason: 'invalid_meta' };
    const meta: Meta = { schemaVersion: target, createdAt: now().toISOString() };
    await port.set({ [KEY.meta]: meta });
    return { mode: 'read_write', meta };
  }

  const parsed = metaSchema.safeParse(rawMeta);
  if (!parsed.success) return { mode: 'read_only', reason: 'invalid_meta' };
  let meta = parsed.data;
  if (meta.schemaVersion > target) return { mode: 'read_only', reason: 'newer_store' };
  if (meta.schemaVersion === target) return { mode: 'read_write', meta };

  const from = meta.schemaVersion;
  const original = Object.fromEntries(Object.entries(all).filter(([k]) => isUserData(k)));
  const backupKeys = Object.keys(original).map((k) => `${KEY.backupPrefix}v${from}:${k}`);
  await port.set(Object.fromEntries(Object.entries(original).map(([k, v]) => [`${KEY.backupPrefix}v${from}:${k}`, v])));

  try {
    let store = structuredClone(original);
    for (let v = from; v < target; v++) {
      const migrate = migrations[v];
      if (!migrate) throw new Error(`No migration from schema version ${v}`);
      store = migrate(store);
    }
    meta = { ...meta, schemaVersion: target, lastMigrationAt: now().toISOString() };
    store[KEY.meta] = meta;
    if (!validate(store)) throw new Error('Migrated store failed validation');

    const removed = Object.keys(original).filter((k) => !(k in store));
    await port.set(store);
    if (removed.length > 0) await port.remove(removed);
    await port.remove(backupKeys);
    return { mode: 'read_write', meta };
  } catch {
    // Roll back to exactly what was there before.
    const current = await port.get(null);
    const stray = Object.keys(current).filter((k) => isUserData(k) && !(k in original));
    await port.set(original);
    if (stray.length > 0) await port.remove(stray);
    return { mode: 'read_only', reason: 'migration_failed' };
  }
}
