import { z } from 'zod';
import { CHOICES, PURPOSES } from '../../core/consent/purposes';
import { isValidSiteKey } from '../../core/domains/site-key';
import { MAX_IMPORT_SITES } from '../../storage/schema';
import type { SenderLike } from './messages';
import type { UiRequest } from './ui-protocol';

const purpose = z.enum(PURPOSES);
const choice = z.enum(CHOICES).nullable();
const domain = z.string().max(253).refine(isValidSiteKey);

const uiRequest = z.union([
  z.strictObject({ type: z.literal('ui:state'), tabUrl: z.string().max(4096).optional() }),
  z.strictObject({ type: z.literal('ui:setGlobalChoice'), purpose, choice }),
  z.strictObject({ type: z.literal('ui:setSiteChoice'), domain, purpose, choice }),
  z.strictObject({ type: z.literal('ui:setPaused'), domain, paused: z.boolean() }),
  z.strictObject({ type: z.literal('ui:setGpc'), enabled: z.boolean() }),
  z.strictObject({ type: z.literal('ui:forget'), domains: z.array(domain).min(1).max(MAX_IMPORT_SITES) }),
  z.strictObject({ type: z.literal('ui:restore'), records: z.array(z.unknown()).max(MAX_IMPORT_SITES) }),
  z.strictObject({ type: z.literal('ui:refuseEverywhere'), purposes: z.array(purpose).min(1).max(PURPOSES.length), dryRun: z.boolean() }),
  z.strictObject({ type: z.literal('ui:import'), file: z.unknown(), policy: z.enum(['keep_mine', 'take_imported']), dryRun: z.boolean() }),
  z.strictObject({ type: z.literal('ui:deleteAll') }),
]);

export function parseUiRequest(raw: unknown): UiRequest | null {
  const parsed = uiRequest.safeParse(raw);
  return parsed.success ? (parsed.data as UiRequest) : null;
}

/**
 * True only for this extension's own pages (popup, settings). Content scripts run inside
 * web pages and always carry a tab with an http(s) address; they must never reach the
 * preference API, which can change and delete the user's choices.
 */
export function isOwnExtensionPage(sender: SenderLike, ownExtensionId: string): boolean {
  if (sender.id !== ownExtensionId) return false;
  if (typeof sender.url !== 'string' || !sender.url.startsWith(`chrome-extension://${ownExtensionId}/`)) return false;
  if (sender.frameId !== undefined && sender.frameId !== 0) return false;
  const tabUrl = sender.tab?.url;
  return tabUrl === undefined || tabUrl.startsWith(`chrome-extension://${ownExtensionId}/`);
}
