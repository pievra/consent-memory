// Messages between the extension's own pages (popup, settings) and the background.
import type { Choice, Purpose } from '../../core/consent/purposes';
import type { ImportSummary } from '../../storage/repository';
import type { Settings, SiteRecord } from '../../storage/schema';

export type UiRequest =
  | { type: 'ui:state'; tabUrl?: string | undefined }
  | { type: 'ui:setGlobalChoice'; purpose: Purpose; choice: Choice | null }
  | { type: 'ui:setSiteChoice'; domain: string; purpose: Purpose; choice: Choice | null }
  | { type: 'ui:setPaused'; domain: string; paused: boolean }
  | { type: 'ui:setGpc'; enabled: boolean }
  | { type: 'ui:forget'; domains: string[] }
  | { type: 'ui:restore'; records: unknown[] }
  | { type: 'ui:refuseEverywhere'; purposes: Purpose[]; dryRun: boolean }
  | { type: 'ui:import'; file: unknown; policy: 'keep_mine' | 'take_imported'; dryRun: boolean }
  | { type: 'ui:deleteAll' };

export interface UiState {
  settings: Settings;
  sites: SiteRecord[];
  /** The site of `tabUrl`, when it is an ordinary web page. */
  current: { domain: string; record: SiteRecord | null } | null;
  readOnly: boolean;
}

export type UiResponse =
  | { ok: true; state: UiState; removed?: SiteRecord[]; counts?: { sites: number; defaults: number }; summary?: ImportSummary }
  | { ok: false; error: 'invalid_request' | 'read_only' | 'failed' };
