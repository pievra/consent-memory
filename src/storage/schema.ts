import { z } from 'zod';
import { MAX_EVIDENCE_LINE_LENGTH, MAX_EVIDENCE_LINES, SCHEMA_VERSION } from '../config/constants';
import { CHOICES, PURPOSES, REFUSE_ALL, type Purpose } from '../core/consent/purposes';
import { CONSENT_STATUSES } from '../core/consent/states';
import { AUDIT_CHECKS, AUDIT_OUTCOMES } from '../audit/checks';
import { isValidSiteKey } from '../core/domains/site-key';

const purpose = z.enum(PURPOSES);
const choice = z.enum(CHOICES);
const setBy = z.enum(['user', 'default']);
const perPurpose = <T extends z.ZodType>(value: T) =>
  z.strictObject(Object.fromEntries(PURPOSES.map((p) => [p, value])) as Record<Purpose, T>);

const timestamp = z.iso.datetime();

const serviceDomain = z.string().max(64).regex(/^[a-z0-9.-]+$/);
export const auditResultSchema = z.strictObject({
  schemaVersion: z.literal(1),
  trackerListVersion: z.string().max(16),
  trackersKnown: z.number().int().nonnegative(),
  observedAt: timestamp,
  checks: z
    .array(
      z.strictObject({
        check: z.enum(AUDIT_CHECKS),
        outcome: z.enum(AUDIT_OUTCOMES),
        services: z.array(serviceDomain).max(10).optional(),
        count: z.number().int().nonnegative().max(1000).optional(),
      }),
    )
    .max(AUDIT_CHECKS.length),
});

export const siteRecordSchema = z
  .strictObject({
    domain: z.string().refine(isValidSiteKey, 'not a bare host name'),
    cmp: z.string().min(1).max(64).optional(),
    cmpRuleVersion: z.string().min(1).max(32).optional(),
    engine: z.enum(['autoconsent', 'consentomatic']).optional(),
    choices: perPurpose(choice),
    setBy: perPurpose(setBy),
    status: z.enum(CONSENT_STATUSES),
    paused: z.boolean(),
    lastAttempted: timestamp.optional(),
    /** Who made the last attempt: the site's own frames, or an embedded frame from another site. */
    attemptOrigin: z.enum(['site', 'other_site_frame']).optional(),
    lastVerified: timestamp.optional(),
    evidenceSummary: z.array(z.string().max(MAX_EVIDENCE_LINE_LENGTH)).max(MAX_EVIDENCE_LINES).optional(),
    unfulfilled: z.array(purpose).max(PURPOSES.length).optional(),
    /** When the consent tool last showed an "accept or pay" wall. Wording only; see applyWall. */
    wallSeenAt: timestamp.optional(),
    /** Technical observations from the last audited visit. Observations, not legal findings. */
    audit: auditResultSchema.optional(),
    mappingVersion: z.number().int().positive(),
    schemaVersion: z.literal(SCHEMA_VERSION),
  })
  .refine((r) => r.status !== 'verified' || (r.lastVerified !== undefined && (r.evidenceSummary?.length ?? 0) > 0), {
    message: "status 'verified' requires lastVerified and at least one evidence line",
  })
  .refine((r) => r.status !== 'verified' || (r.unfulfilled?.length ?? 0) === 0, {
    message: "status 'verified' is not allowed with unfulfilled purposes",
  });
export type SiteRecord = z.infer<typeof siteRecordSchema>;

export const settingsSchema = z.strictObject({
  globalChoices: perPurpose(choice),
  globalSetBy: perPurpose(setBy),
  gpcEnabled: z.boolean(),
  schemaVersion: z.literal(SCHEMA_VERSION),
});
export type Settings = z.infer<typeof settingsSchema>;

export const metaSchema = z.strictObject({
  schemaVersion: z.number().int().positive(),
  createdAt: timestamp,
  lastMigrationAt: timestamp.optional(),
});
export type Meta = z.infer<typeof metaSchema>;

const allDefault = Object.fromEntries(PURPOSES.map((p) => [p, 'default'])) as Record<Purpose, 'user' | 'default'>;

export function defaultSettings(): Settings {
  return { globalChoices: { ...REFUSE_ALL }, globalSetBy: { ...allDefault }, gpcEnabled: true, schemaVersion: SCHEMA_VERSION };
}

export function newSiteRecord(domain: string, mappingVersion: number): SiteRecord {
  return {
    domain,
    choices: { ...REFUSE_ALL },
    setBy: { ...allDefault },
    status: 'not_detected',
    paused: false,
    mappingVersion,
    schemaVersion: SCHEMA_VERSION,
  };
}

export const KEY = {
  meta: 'meta',
  settings: 'settings',
  sitePrefix: 'site:',
  quarantinePrefix: 'quarantine:',
  backupPrefix: 'backup:',
  site: (domain: string) => `site:${domain}`,
} as const;

export const EXPORT_FORMAT = 'consent-memory-export';
export const MAX_IMPORT_SITES = 5000;

/**
 * Export file. Carries the user's choices only; unknown keys in a site entry are
 * dropped, so a file cannot smuggle in a status, evidence or a verification date.
 */
export const exportFileSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  formatVersion: z.literal(1),
  exportedAt: timestamp.optional(),
  settings: z.object({ globalChoices: perPurpose(choice), globalSetBy: perPurpose(setBy) }).optional(),
  sites: z
    .array(
      z.object({
        domain: z.string().refine(isValidSiteKey, 'not a bare host name'),
        choices: perPurpose(choice),
        setBy: perPurpose(setBy),
        paused: z.boolean(),
      }),
    )
    .max(MAX_IMPORT_SITES),
});
export type ExportFile = z.infer<typeof exportFileSchema>;
