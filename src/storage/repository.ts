import type { StoragePort } from '../adapters/shared/ports';
import type { Choice, Purpose } from '../core/consent/purposes';
import { PURPOSES } from '../core/consent/purposes';
import type { ResolverInput } from '../core/consent/resolver';
import type { SiteKeys } from '../core/domains/site-key';
import { openStore, type OpenResult } from './migrations';
import { MAX_QUARANTINE_ENTRIES, MAX_SITE_RECORDS, SITE_EVICTION_BATCH } from '../config/constants';
import { MAPPING_VERSION } from '../core/consent/mappings';
import { KEY, defaultSettings, exportFileSchema, newSiteRecord, settingsSchema, siteRecordSchema, type Settings, type SiteRecord } from './schema';

export interface ImportSummary {
  valid: boolean;
  added: number;
  changed: number;
  unchanged: number;
  /** Differ from what is on this device and were left alone (policy keep_mine). */
  skipped: number;
  /** New sites in the file that allow at least one purpose. Written under either policy. */
  addedAllowing: number;
  /** Sites that differ and whose version in the file allows at least one purpose. Written only under take_imported. */
  changedAllowing: number;
  /** Purposes the file would switch to "allow" as the default for every site. Written only under take_imported. */
  defaultsAllowing: Purpose[];
}

const emptySummary = (valid: boolean): ImportSummary => ({ valid, added: 0, changed: 0, unchanged: 0, skipped: 0, addedAllowing: 0, changedAllowing: 0, defaultsAllowing: [] });

export class StoreReadOnlyError extends Error {
  constructor(readonly reason: string) {
    super(`Store is read only: ${reason}`);
    this.name = 'StoreReadOnlyError';
  }
}

export class InvalidRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRecordError';
  }
}

/**
 * The only writer of user data. Validates on every read and write.
 * Records that fail validation on read are moved to quarantine, never deleted
 * and never replaced by defaults behind the user's back.
 */
export class Repository {
  #open: OpenResult | undefined;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly port: StoragePort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async init(): Promise<OpenResult> {
    this.#open ??= await openStore(this.port, this.now);
    return this.#open;
  }

  get readOnly(): boolean {
    return this.#open?.mode !== 'read_write';
  }

  /** Runs writes one after another so two tabs cannot interleave read, modify, write. */
  #serialise<T>(task: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(task, task);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  #assertWritable(): void {
    if (!this.#open) throw new StoreReadOnlyError('not_initialised');
    if (this.#open.mode === 'read_only') throw new StoreReadOnlyError(this.#open.reason);
  }

  async #quarantine(key: string, raw: unknown, reason: string): Promise<void> {
    if (this.readOnly) return;
    const id = `${KEY.quarantinePrefix}${this.now().getTime()}:${key}`;
    await this.port.set({ [id]: { key, raw, reason, at: this.now().toISOString() } });
    await this.port.remove([key]);
  }

  async getSettings(): Promise<Settings> {
    const raw = (await this.port.get([KEY.settings]))[KEY.settings];
    if (raw === undefined) return defaultSettings();
    const parsed = settingsSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    await this.#quarantine(KEY.settings, raw, 'invalid_settings');
    return defaultSettings();
  }

  /** Pass null to clear a global choice back to the built in refusal default. */
  setGlobalChoice(purpose: Purpose, choice: Choice | null): Promise<Settings> {
    return this.#serialise(async () => {
      this.#assertWritable();
      const settings = await this.getSettings();
      settings.globalChoices[purpose] = choice ?? 'refuse';
      settings.globalSetBy[purpose] = choice === null ? 'default' : 'user';
      await this.port.set({ [KEY.settings]: settingsSchema.parse(settings) });
      return settings;
    });
  }

  async getSite(domain: string): Promise<SiteRecord | null> {
    const key = KEY.site(domain);
    const raw = (await this.port.get([key]))[key];
    if (raw === undefined) return null;
    const parsed = siteRecordSchema.safeParse(raw);
    if (parsed.success && parsed.data.domain === domain) return parsed.data;
    await this.#quarantine(key, raw, 'invalid_site_record');
    return null;
  }

  /** Exact host override first, then the registrable domain. */
  async findSite(keys: SiteKeys): Promise<SiteRecord | null> {
    if (keys.host !== keys.site) {
      const override = await this.getSite(keys.host);
      if (override) return override;
    }
    return this.getSite(keys.site);
  }

  /**
   * Read, change and write one site record atomically with respect to other
   * repository writes. Return null from `change` to leave storage untouched.
   */
  updateSite(domain: string, change: (existing: SiteRecord | null) => SiteRecord | null): Promise<SiteRecord | null> {
    return this.#serialise(async () => {
      this.#assertWritable();
      const existing = await this.getSite(domain);
      const next = change(existing ? structuredClone(existing) : null);
      if (next === null) return existing;
      const parsed = siteRecordSchema.safeParse(next);
      if (!parsed.success || parsed.data.domain !== domain) {
        throw new InvalidRecordError(parsed.success ? 'domain mismatch' : parsed.error.message);
      }
      if (!existing) await this.#makeRoom();
      await this.port.set({ [KEY.site(domain)]: parsed.data });
      return parsed.data;
    });
  }

  /**
   * Keeps the store bounded. Before a new site record is written, the oldest records that
   * hold no choice made by the user (and are not paused) are dropped once the cap is reached,
   * and old quarantine entries are trimmed. A record carrying a user's choice is never evicted.
   */
  async #makeRoom(): Promise<void> {
    const all = await this.port.get(null);
    const remove: string[] = [];
    const quarantined = Object.keys(all).filter((k) => k.startsWith(KEY.quarantinePrefix)).sort();
    if (quarantined.length > MAX_QUARANTINE_ENTRIES) remove.push(...quarantined.slice(0, quarantined.length - MAX_QUARANTINE_ENTRIES));
    const siteKeys = Object.keys(all).filter((k) => k.startsWith(KEY.sitePrefix));
    if (siteKeys.length >= MAX_SITE_RECORDS) {
      const evictable: Array<{ key: string; at: string }> = [];
      for (const key of siteKeys) {
        const parsed = siteRecordSchema.safeParse(all[key]);
        if (!parsed.success) continue;
        const r = parsed.data;
        if (r.paused || PURPOSES.some((p) => r.setBy[p] === 'user')) continue;
        evictable.push({ key, at: r.lastAttempted ?? r.lastVerified ?? '' });
      }
      evictable.sort((a, b) => a.at.localeCompare(b.at));
      remove.push(...evictable.slice(0, siteKeys.length - MAX_SITE_RECORDS + SITE_EVICTION_BATCH).map((e) => e.key));
    }
    if (remove.length > 0) await this.port.remove(remove);
  }

  forgetSite(domain: string): Promise<void> {
    return this.#serialise(async () => {
      this.#assertWritable();
      await this.port.remove([KEY.site(domain)]);
    });
  }

  async listSites(): Promise<SiteRecord[]> {
    const all = await this.port.get(null);
    const records: SiteRecord[] = [];
    for (const [key, raw] of Object.entries(all)) {
      if (!key.startsWith(KEY.sitePrefix)) continue;
      const parsed = siteRecordSchema.safeParse(raw);
      if (parsed.success && KEY.site(parsed.data.domain) === key) records.push(parsed.data);
      else await this.#quarantine(key, raw, 'invalid_site_record');
    }
    return records.sort((a, b) => a.domain.localeCompare(b.domain));
  }

  /** Inputs for the preference resolver. Only choices the user set are passed on. */
  async resolverInput(keys: SiteKeys): Promise<ResolverInput> {
    const [settings, record] = await Promise.all([this.getSettings(), this.findSite(keys)]);
    const input: ResolverInput = { paused: record?.paused ?? false, site: {}, global: {} };
    for (const p of PURPOSES) {
      if (record && record.setBy[p] === 'user') input.site[p] = record.choices[p];
      if (settings.globalSetBy[p] === 'user') input.global[p] = settings.globalChoices[p];
    }
    return input;
  }

  setGpcEnabled(enabled: boolean): Promise<Settings> {
    return this.#serialise(async () => {
      this.#assertWritable();
      const settings = { ...(await this.getSettings()), gpcEnabled: enabled };
      await this.port.set({ [KEY.settings]: settingsSchema.parse(settings) });
      return settings;
    });
  }

  /** Pass null to return a purpose to "use my default" for this site. */
  setSiteChoice(domain: string, purpose: Purpose, choice: Choice | null): Promise<SiteRecord | null> {
    return this.updateSite(domain, (existing) => {
      const record = existing ?? newSiteRecord(domain, MAPPING_VERSION);
      record.choices[purpose] = choice ?? 'refuse';
      record.setBy[purpose] = choice === null ? 'default' : 'user';
      return record;
    });
  }

  setPaused(domain: string, paused: boolean): Promise<SiteRecord | null> {
    return this.updateSite(domain, (existing) => ({ ...(existing ?? newSiteRecord(domain, MAPPING_VERSION)), paused }));
  }

  /** Removes the given site records and returns them, so the caller can offer undo. */
  forgetSites(domains: string[]): Promise<SiteRecord[]> {
    return this.#serialise(async () => {
      this.#assertWritable();
      const removed: SiteRecord[] = [];
      for (const domain of domains) {
        const record = await this.getSite(domain);
        if (record) removed.push(record);
      }
      await this.port.remove(removed.map((r) => KEY.site(r.domain)));
      return removed;
    });
  }

  /** Writes back records previously returned by forgetSites. Invalid records are skipped. */
  restoreSites(records: unknown[]): Promise<number> {
    return this.#serialise(async () => {
      this.#assertWritable();
      const items: Record<string, unknown> = {};
      for (const raw of records) {
        const parsed = siteRecordSchema.safeParse(raw);
        if (parsed.success) items[KEY.site(parsed.data.domain)] = parsed.data;
      }
      if (Object.keys(items).length > 0) await this.port.set(items);
      return Object.keys(items).length;
    });
  }

  /**
   * Bulk change of choices. `purposes` limits the change to some purposes; every listed
   * purpose is set to refuse in the global defaults and in every site record that allows it.
   * With `dryRun` nothing is written and the counts describe what would change.
   */
  refuseEverywhere(purposes: readonly Purpose[], dryRun: boolean): Promise<{ sites: number; defaults: number }> {
    return this.#serialise(async () => {
      if (!dryRun) this.#assertWritable();
      const settings = await this.getSettings();
      const defaults = purposes.filter((p) => settings.globalChoices[p] === 'allow').length;
      const records = (await this.listSites()).filter((r) => purposes.some((p) => r.setBy[p] === 'user' && r.choices[p] === 'allow'));
      if (!dryRun) {
        const items: Record<string, unknown> = {};
        for (const p of purposes) {
          settings.globalChoices[p] = 'refuse';
          settings.globalSetBy[p] = 'default';
        }
        items[KEY.settings] = settingsSchema.parse(settings);
        for (const record of records) {
          for (const p of purposes) {
            if (record.choices[p] === 'allow') {
              record.choices[p] = 'refuse';
              record.setBy[p] = 'default';
            }
          }
          items[KEY.site(record.domain)] = siteRecordSchema.parse(record);
        }
        await this.port.set(items);
      }
      return { sites: records.length, defaults };
    });
  }

  /** Removes audit observations older than `maxAgeMs`. The user's choices and results are kept. */
  pruneAudits(maxAgeMs: number): Promise<number> {
    return this.#serialise(async () => {
      this.#assertWritable();
      const cutoff = this.now().getTime() - maxAgeMs;
      const items: Record<string, unknown> = {};
      for (const record of await this.listSites()) {
        if (record.audit && Date.parse(record.audit.observedAt) < cutoff) {
          const { audit: _expired, ...rest } = record;
          void _expired;
          items[KEY.site(record.domain)] = siteRecordSchema.parse(rest);
        }
      }
      if (Object.keys(items).length > 0) await this.port.set(items);
      return Object.keys(items).length;
    });
  }

  /** Removes every site record and the settings. Store metadata is kept. */
  deleteAll(): Promise<number> {
    return this.#serialise(async () => {
      this.#assertWritable();
      const keys = Object.keys(await this.port.get(null)).filter((k) => k !== KEY.meta && !k.startsWith(KEY.backupPrefix));
      await this.port.remove(keys);
      return keys.filter((k) => k.startsWith(KEY.sitePrefix)).length;
    });
  }

  /**
   * Imports choices from an export file. Only the user's choices travel: an imported record
   * can never assert a status or evidence, and existing results on this device are kept.
   */
  importData(raw: unknown, policy: 'keep_mine' | 'take_imported', dryRun: boolean): Promise<ImportSummary> {
    return this.#serialise(async () => {
      if (!dryRun) this.#assertWritable();
      const parsed = exportFileSchema.safeParse(raw);
      if (!parsed.success) return emptySummary(false);
      const summary = emptySummary(true);
      const items: Record<string, unknown> = {};
      const current = await this.getSettings();
      // An import must never widen consent out of sight: everything it would allow is counted for the preview.
      const fileSettings = parsed.data.settings;
      if (fileSettings) {
        summary.defaultsAllowing = PURPOSES.filter(
          (p) => fileSettings.globalChoices[p] === 'allow' && fileSettings.globalSetBy[p] === 'user' && !(current.globalChoices[p] === 'allow' && current.globalSetBy[p] === 'user'),
        );
      }
      const allows = (choices: Record<Purpose, Choice>) => PURPOSES.some((p) => choices[p] === 'allow');
      for (const incoming of parsed.data.sites) {
        const existing = await this.getSite(incoming.domain);
        if (!existing) {
          summary.added++;
          if (allows(incoming.choices)) summary.addedAllowing++;
          items[KEY.site(incoming.domain)] = { ...newSiteRecord(incoming.domain, MAPPING_VERSION), choices: incoming.choices, setBy: incoming.setBy, paused: incoming.paused };
          continue;
        }
        const same =
          existing.paused === incoming.paused &&
          PURPOSES.every((p) => existing.choices[p] === incoming.choices[p] && existing.setBy[p] === incoming.setBy[p]);
        if (same) summary.unchanged++;
        else if (policy === 'keep_mine') summary.skipped++;
        else {
          summary.changed++;
          if (allows(incoming.choices)) summary.changedAllowing++;
          items[KEY.site(incoming.domain)] = { ...existing, choices: incoming.choices, setBy: incoming.setBy, paused: incoming.paused };
        }
      }
      if (!dryRun) {
        if (fileSettings && policy === 'take_imported') {
          items[KEY.settings] = settingsSchema.parse({ ...current, globalChoices: fileSettings.globalChoices, globalSetBy: fileSettings.globalSetBy });
        }
        for (const [key, value] of Object.entries(items)) {
          if (key.startsWith(KEY.sitePrefix)) siteRecordSchema.parse(value);
        }
        if (Object.keys(items).length > 0) await this.port.set(items);
      }
      return summary;
    });
  }
}
