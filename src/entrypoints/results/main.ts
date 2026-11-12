// Diagnostic page for manual testing. Read only: it never writes to storage and
// makes no network request. The export is created in the page and saved by the user.
import { browser } from 'wxt/browser';
import type { ConsentStatus } from '../../core/consent/states';
import { AUTOCONSENT_VERSION } from '../../engines/autoconsent/config';
import { isWall } from '../../engines/walls';
import { KEY, siteRecordSchema, type SiteRecord } from '../../storage/schema';
import { toolName } from '../../ui/tool-names';

const LABELS: Record<ConsentStatus, { text: string; tone: 'ok' | 'warn' | 'bad' | 'neutral'; mark: string }> = {
  // The same words as the popup and the settings, so a tester and the team name a result the same way.
  verified: { text: 'Refused and confirmed', tone: 'ok', mark: '✓' },
  partial: { text: 'Partly done', tone: 'warn', mark: '◐' },
  recorded: { text: 'Stored', tone: 'warn', mark: '◐' },
  attempted: { text: 'Applied, not confirmed', tone: 'warn', mark: '?' },
  inconclusive: { text: 'Applied, not confirmed', tone: 'warn', mark: '?' },
  failed: { text: 'Could not manage consent', tone: 'bad', mark: '✕' },
  skipped: { text: 'Left alone', tone: 'neutral', mark: '–' },
  unsupported: { text: 'Not supported', tone: 'neutral', mark: '–' },
  detected: { text: 'No banner open', tone: 'neutral', mark: '•' },
  not_detected: { text: 'Nothing found yet', tone: 'neutral', mark: '•' },
};

const REASONS: Record<string, string | null> = {
  unsafe_context: 'A password or payment card field was already filled in, so the page was left alone',
  action_failed: 'The refusal steps did not complete',
  paused: 'This site is paused',
  no_accept_route: 'You allow everything here, and Pievra has no way to press “accept” on this banner product. Nothing was clicked',
  evidence_contradicts: null, // already explained by the check that contradicted
};

/** Stored evidence lines are terse and stable; this turns them into plain sentences for display only. */
function plain(line: string): string | null {
  if (line.startsWith('reason: ')) {
    const code = line.slice(8);
    return Object.hasOwn(REASONS, code) ? (REASONS[code] ?? null) : code.replaceAll('_', ' ');
  }
  if (line.startsWith('source: ')) return 'Reported by an embedded frame from another site, so not counted as verification';
  const detail = line.includes(' — ') ? line.slice(line.indexOf(' — ') + 3) : line;
  return detail.replace(/^CMP /, 'The banner product ').replace(/\bTCF\b/, 'Advertising industry framework (TCF):');
}

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function loadRecords(): Promise<SiteRecord[]> {
  const all = await browser.storage.local.get(null);
  const records: SiteRecord[] = [];
  for (const [key, raw] of Object.entries(all)) {
    if (!key.startsWith(KEY.sitePrefix)) continue;
    const parsed = siteRecordSchema.safeParse(raw);
    if (parsed.success) records.push(parsed.data);
  }
  return records.sort((a, b) => (b.lastAttempted ?? '').localeCompare(a.lastAttempted ?? '') || a.domain.localeCompare(b.domain));
}

function cell(label: string, className?: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.dataset.label = label;
  if (className) td.className = className;
  return td;
}

function render(records: SiteRecord[]): void {
  const rows = el<HTMLTableSectionElement>('rows');
  rows.replaceChildren();
  for (const record of records) {
    const tr = document.createElement('tr');

    const site = cell('Site', 'site');
    site.textContent = record.domain;

    const result = cell('Result');
    const wall = isWall(record);
    const noAccept = record.status === 'inconclusive' && (record.evidenceSummary ?? []).includes('reason: no_accept_route');
    const label = wall ? { text: 'Accept or pay', tone: 'warn' as const, mark: '!' } : noAccept ? { text: 'Not accepted', tone: 'warn' as const, mark: '?' } : LABELS[record.status];
    const badge = document.createElement('span');
    badge.className = 'status';
    badge.dataset.tone = label.tone;
    badge.dataset.mark = label.mark;
    badge.textContent = label.text;
    result.append(badge);

    const cmp = cell('Banner product');
    cmp.textContent = toolName(record.cmp);

    const evidence = cell('What was checked', 'evidence');
    const lines = (record.evidenceSummary ?? []).map(plain).filter((l): l is string => l !== null);
    if (record.unfulfilled?.length) lines.push(`You allowed ${record.unfulfilled.join(', ')}, which could not be granted on this site`);
    if (wall) lines.push('The site offers no free refusal: accept or pay. Nothing was clicked');
    if (lines.length === 0) evidence.textContent = '—';
    else {
      const list = document.createElement('ul');
      for (const line of lines) list.append(Object.assign(document.createElement('li'), { textContent: line }));
      evidence.append(list);
    }

    const when = cell('Last attempt');
    when.textContent = record.lastAttempted ? new Date(record.lastAttempted).toLocaleString('en-GB') : '—';

    tr.append(site, result, cmp, evidence, when);
    rows.append(tr);
  }
  el('empty').hidden = records.length > 0;
  const verified = records.filter((r) => r.status === 'verified').length;
  el('summary').textContent = records.length === 0 ? '' : `${records.length} sites recorded · ${verified} verified`;
}

// Site names are a browsing history. Two buttons, each saying what the file will contain: the
// person sharing it chooses knowingly, and a tester cannot send the wrong kind by missing a tick box.
async function download(named: boolean): Promise<void> {
  const records = await loadRecords();
  const sites = named ? records : records.map((record, index) => ({ ...record, domain: `site-${index + 1}` }));
  const payload = {
    format: 'consent-memory-test-results',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    extensionVersion: browser.runtime.getManifest().version,
    engine: `autoconsent ${AUTOCONSENT_VERSION}`,
    siteNames: named ? 'included' : 'removed',
    browser: navigator.userAgent,
    ...(named ? { languages: navigator.languages, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } : {}),
    sites,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: `pievra-results-${payload.exportedAt.slice(0, 10)}${named ? '' : '-no-site-names'}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const refresh = () => loadRecords().then(render);
el('download').addEventListener('click', () => void download(false));
el('download-named').addEventListener('click', () => void download(true));
el('refresh').addEventListener('click', () => void refresh());
void refresh();
