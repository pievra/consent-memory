import { browser } from 'wxt/browser';
import type { StoragePort } from '../shared/ports';

/** Local, unsynchronised storage. `storage.sync` is never used (specification section 9). */
export function chromiumLocalStorage(): StoragePort {
  return {
    get: (keys) => browser.storage.local.get(keys),
    set: (items) => browser.storage.local.set(items),
    remove: (keys) => browser.storage.local.remove(keys),
  };
}
