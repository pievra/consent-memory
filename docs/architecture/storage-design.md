# Storage design — Milestone 0

## 1. Decisions

| Topic | Decision | Reason |
|---|---|---|
| Store | `browser.storage.local` only | Readable from the service worker, content scripts and extension pages; survives restarts; not synchronised to a browser account. IndexedDB is not reachable from content scripts and adds a second store to migrate |
| Sync | `storage.sync` is never used | Section 9: Chrome Sync is not local only storage |
| Layout | One key per site record; the site list is read by key prefix (no index key, as built in Milestone 1) | A write touches one record; corruption of one record does not lose the others; avoids rewriting a single large blob |
| Validation | Zod schema on every read and write | Section 9 |
| Record key | Registrable domain (eTLD+1) from `tldts`, lower case, punycode | One CMP decision normally covers a registrable domain |
| Subdomain overrides | Optional records keyed by full host; lookup is exact host first, then registrable domain | Section 9 "domain specific overrides" |
| Hosts without a registrable domain (IP addresses, `localhost`, single label intranet names) | Keyed by host; never matched to a parent | Avoids one record covering unrelated intranet sites |
| Private suffixes (`github.io`, `co.uk` style public and private entries) | Private suffix list enabled, so `a.github.io` and `b.github.io` are separate sites | They are separate publishers |

## 2. Keys

```text
meta                 { schemaVersion, createdAt, lastMigrationAt, mappingVersion }
settings             { globalChoices, globalSetBy, gpcEnabled, locale?, onboardingDone }
site:<domain>        SiteRecord
quarantine:<id>      { key, raw, reason, at }   // records that failed validation
diag:log             ring buffer, 200 entries, 30 day retention
telemetry:state      { status: 'unavailable' }   // fixed value until Decision B
```

## 3. Types

`SiteRecord` is as defined in section 9 of the specification, with three additions that the specification's own rules require:

```ts
interface SiteRecord {
  // ...fields from the specification
  mappingVersion: number;       // purpose mapping used for the last attempt
  engine?: 'autoconsent' | 'consentomatic';
  unfulfilled?: Purpose[];      // purposes requested but not applied (partial)
}

type AuditOutcome = 'passed' | 'signal_detected' | 'inconclusive' | 'not_applicable';

type AuditCheckId =
  | 'tracking_before_consent'
  | 'tracking_after_refusal'
  | 'refusal_accessibility'
  | 'optional_purposes_preselected'
  | 'consent_information_available'
  | 'gpc_behaviour';

interface AuditCheckResult {
  check: AuditCheckId;
  outcome: AuditOutcome;
  evidence: string[];           // max 10 short lines, hosts only, no paths or query strings
  observedAt: string;           // ISO date and hour, minutes dropped
  windowMs: number;
}

interface AuditResult {
  schemaVersion: number;
  trackerListVersion: string;
  checks: AuditCheckResult[];
}
```

`status` in a stored record never holds the transient states `PREFERENCES_RESOLVED`; the state machine in memory has that state, the persisted enum is the one in section 9.

## 4. Migrations

- `meta.schemaVersion` is a single integer for the whole store. Migrations are pure functions `vN → vN+1`, run in the background at start-up before any other read.
- Before migrating: copy all keys to `backup:v<N>:*`. After migrating: validate every record. On any failure, restore the backup, leave the store at version N and show a blocking notice in the popup. The backup is deleted after the next successful start.
- A store with a version **higher** than the code understands (downgrade) is opened read only with a notice. Nothing is written.

## 5. Corruption and quota

- A record that fails validation is moved to `quarantine:*` and reported in diagnostics. It is not deleted and not silently replaced by defaults. The site is treated as "no stored preference" and the global defaults apply.
- Estimated size: about 0.6 KB per site without audit, about 2 KB with audit. 10 MB holds roughly 5,000 audited sites. At 80% of quota the options page shows a warning and offers to remove audit evidence older than the retention limit. Writes that fail on quota surface an error; they never drop a user choice without notice.

## 6. Retention

| Data | Retention | Removal |
|---|---|---|
| User choices (`choices`, `setBy`, `paused`) | Until the user removes them | "Forget" per site, bulk, or delete all |
| Status and timestamps | Replaced on each attempt | With the record |
| Audit evidence | 90 days after `observedAt`, then reduced to outcome only | Automatic, on start-up |
| Diagnostics log | 30 days or 200 entries | Automatic; user can clear |
| Quarantine | 30 days | Automatic; user can export first |

A verified status older than 180 days is displayed as "last verified on <date>" without success styling (section 2.2: never assume a recorded preference stays effective).

## 7. Import, export, deletion

- Export: one JSON file `{ format: 'consent-memory-export', formatVersion, exportedAt, settings, sites }`. User initiated, written through a download. Audit evidence is excluded by default.
- Import: 5 MB cap, schema validation, preview listing counts of new, changed and conflicting records, then explicit confirmation. Conflict policy is chosen by the user (keep mine, take imported). Imported `status` fields are reset to `not_detected`; a file cannot assert that something was verified.
- Delete all: removes every key and writes a fresh `meta`. Stated in the UI that this does not change what websites have already stored.

## 8. Concurrency

The service worker is the only writer. Content scripts and extension pages send validated messages; the background serialises writes per key through a queue so that two tabs on the same site cannot interleave read, modify, write.
