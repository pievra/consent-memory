export const SCHEMA_VERSION = 1;
/** Maximum times an engine action is run on one page load. */
export const MAX_ACTION_ATTEMPTS = 3;
/** Delay before evidence is read after an action, so the CMP can store its state. */
export const EVIDENCE_DELAY_MS = 1000;
/** A run that has not finished by then is closed with the evidence it has. */
export const RUN_TIMEOUT_MS = 20_000;
export const TCF_READ_TIMEOUT_MS = 1500;
/** How long after an interrupted attempt its result may still be checked on a later page load. */
export const RESUME_WINDOW_MS = 10 * 60_000;
/** How long to wait for a banner before treating a detected CMP as having none open. */
export const RESUME_AFTER_MS = 7000;
/** Audit observations are kept this long, then removed at start-up. */
export const AUDIT_RETENTION_MS = 90 * 24 * 3600 * 1000;
export const MAX_EVIDENCE_LINES = 10;
export const MAX_EVIDENCE_LINE_LENGTH = 160;
/** Attempts for one message to the background, which the browser may stop mid flight. */
export const SEND_ATTEMPTS = 4;
export const SEND_RETRY_DELAY_MS = 150;
/** Longest wait for one answer. The slowest request is the TCF read (TCF_READ_TIMEOUT_MS). */
export const SEND_TIMEOUT_MS = 4000;

/** `storage.local` quota in Chromium without `unlimitedStorage`. */
export const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024;

/** Upper bound on remembered sites. At roughly 1.5 kB a record this stays well inside the quota. */
export const MAX_SITE_RECORDS = 4000;
/** Records dropped beyond the minimum when the cap is reached, so eviction does not run on every write. */
export const SITE_EVICTION_BATCH = 100;
export const MAX_QUARANTINE_ENTRIES = 20;

/** Reading back per purpose state: the consent tool records an answer shortly after it is submitted. */
export const PURPOSE_READ_ATTEMPTS = 5;
export const PURPOSE_READ_INTERVAL_MS = 600;

/** An "accept or pay" wall is looked for this often, this many times, after a consent tool is found without an answerable banner. */
export const WALL_CHECK_INTERVAL_MS = 4000;
export const WALL_CHECKS = 3;
