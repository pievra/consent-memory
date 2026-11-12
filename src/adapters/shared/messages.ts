import { z } from 'zod';
import { MAX_ACTION_ATTEMPTS, MAX_EVIDENCE_LINE_LENGTH } from '../../config/constants';
import { PURPOSES } from '../../core/consent/purposes';
import { MACHINE_STATES } from '../../core/consent/states';
import { EVIDENCE_KINDS, EVIDENCE_OUTCOMES } from '../../core/consent/verifier';
import type { PageRequest } from './protocol';

const evidence = z.strictObject({
  kind: z.enum(EVIDENCE_KINDS),
  outcome: z.enum(EVIDENCE_OUTCOMES),
  detail: z.string().max(MAX_EVIDENCE_LINE_LENGTH).optional(),
});

const report = z
  .strictObject({
    type: z.literal('page:report'),
    state: z.enum(MACHINE_STATES),
    cmp: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[\w .:()/-]+$/)
      .optional(),
    reason: z
      .string()
      .max(40)
      .regex(/^[a-z_]+$/)
      .optional(),
    evidence: z.array(evidence).max(EVIDENCE_KINDS.length),
    unfulfilled: z.array(z.enum(PURPOSES)).max(PURPOSES.length),
    attempts: z.number().int().min(0).max(MAX_ACTION_ATTEMPTS),
    actionCompleted: z.boolean().optional(),
  })
  // A success state must carry the evidence that justifies it, whoever sent the message.
  .refine((r) => r.state !== 'VERIFIED' || (r.evidence.some((e) => e.outcome === 'confirms') && r.unfulfilled.length === 0), {
    message: 'VERIFIED requires confirming evidence and no unfulfilled purposes',
  })
  .refine((r) => r.state !== 'VERIFIED' || !r.evidence.some((e) => e.outcome === 'contradicts' || e.outcome === 'partial'), {
    message: 'VERIFIED is not allowed with partial or contradicting evidence',
  })
  .refine((r) => (r.state !== 'PARTIAL' && r.state !== 'ACTION_RECORDED') || r.evidence.some((e) => e.outcome === 'confirms' || e.outcome === 'partial'), {
    message: 'PARTIAL requires supporting evidence',
  });

const pageRequest = z.union([
  z.strictObject({ type: z.literal('page:init') }),
  z.strictObject({ type: z.literal('page:eval'), snippetId: z.string().min(1).max(80).regex(/^EVAL_[A-Z0-9_]+$/) }),
  z.strictObject({ type: z.literal('page:tcf') }),
  z.strictObject({ type: z.literal('page:purposes'), op: z.enum(['apply', 'read']), cmp: z.string().min(1).max(64).regex(/^[\w .:()/-]+$/) }),
  z.strictObject({ type: z.literal('page:object'), cmp: z.string().min(1).max(64).regex(/^[\w .:()/-]+$/) }),
  z.strictObject({ type: z.literal('page:wall'), cmp: z.string().min(1).max(64).regex(/^[\w .:()/-]+$/) }),
  z.strictObject({
    type: z.literal('page:audit'),
    event: z.enum(['banner', 'finish']),
    clicks: z.number().int().min(0).max(50).optional(),
    pageLoad: z.number().int().positive().optional(),
  }),
  report,
]);

/** Returns the validated request, or null for anything else. Never throws. */
export function parsePageRequest(raw: unknown): PageRequest | null {
  const parsed = pageRequest.safeParse(raw);
  return parsed.success ? (parsed.data as PageRequest) : null;
}

export interface SenderLike {
  id?: string | undefined;
  url?: string | undefined;
  frameId?: number | undefined;
  documentId?: string | undefined;
  tab?: { id?: number | undefined; url?: string | undefined } | undefined;
}

export interface TrustedSender {
  tabId: number;
  frameId: number;
  /** URL of the frame that sent the message. */
  frameUrl: string;
  /** URL of the top level page of the tab. The site key is always derived from this, never from message content. */
  tabUrl: string;
  /** The browser's identifier for the exact document that sent the message, when it provides one. */
  documentId?: string;
}

const isHttp = (url: string | undefined): url is string => typeof url === 'string' && /^https?:\/\//i.test(url);

/**
 * Accepts only messages from this extension's own content scripts running in a
 * tab on an http(s) page. Other extensions, extension pages and web pages are rejected.
 */
export function validateSender(sender: SenderLike, ownExtensionId: string): TrustedSender | null {
  if (sender.id !== ownExtensionId) return null;
  const tabId = sender.tab?.id;
  if (typeof tabId !== 'number' || tabId < 0) return null;
  if (typeof sender.frameId !== 'number' || sender.frameId < 0) return null;
  if (!isHttp(sender.tab?.url)) return null;
  // Frames may be about:blank or srcdoc; the top level URL is what matters for the site key.
  const frameUrl = typeof sender.url === 'string' ? sender.url : '';
  if (sender.frameId === 0 && !isHttp(frameUrl)) return null;
  return { tabId, frameId: sender.frameId, frameUrl, tabUrl: sender.tab.url, ...(typeof sender.documentId === 'string' && sender.documentId ? { documentId: sender.documentId } : {}) };
}
