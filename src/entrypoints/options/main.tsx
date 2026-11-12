import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { UiRequest, UiResponse, UiState } from '../../adapters/shared/ui-protocol';
import { browser } from 'wxt/browser';
import { PIEVRA_CONTACT, PUBLISHER_LINE } from '../../config/brand';
import { STORAGE_QUOTA_BYTES } from '../../config/constants';
import { PURPOSES, type Purpose } from '../../core/consent/purposes';
import type { ImportSummary } from '../../storage/repository';
import { EXPORT_FORMAT, type ExportFile, type SiteRecord } from '../../storage/schema';
import { Brand } from '../../ui/brand';
import { toolName } from '../../ui/tool-names';
import { AuditSummary, Evidence, LANG, LOCALE, PurposeControl, StatusBadge, call, choicesSummary, listOf, purposeName, t } from '../../ui/shared';

const importAllows = (summary: ImportSummary) => summary.defaultsAllowing.length > 0 || summary.addedAllowing > 0 || summary.changedAllowing > 0;

document.documentElement.lang = LANG === 'fr' ? 'fr' : 'en-GB';
document.title = `${t('options.title')} — ${t('appName')}`;

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
type Filter = 'all' | 'verified' | 'attention' | 'paused';
type Sort = 'site' | 'recent' | 'status';
const NEEDS_ATTENTION = new Set(['partial', 'failed', 'inconclusive', 'attempted', 'recorded']);

function download(name: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Options() {
  const [state, setState] = useState<UiState | null>(null);
  const [message, setMessage] = useState<{ text: string; undo?: SiteRecord[] } | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('site');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ purposes: Purpose[]; counts: { sites: number; defaults: number } } | null>(null);
  const [bulkPurpose, setBulkPurpose] = useState<Purpose | ''>('');
  const [pendingImport, setPendingImport] = useState<{ file: unknown; summary: ImportSummary } | null>(null);
  // An import that would allow anything needs its own tick before either button works.
  const [importAllowsOk, setImportAllowsOk] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const send = async (request: UiRequest): Promise<UiResponse> => {
    const response = await call(request);
    if (response.ok) setState(response.state);
    else setMessage({ text: t('common.error') });
    return response;
  };
  useEffect(() => void send({ type: 'ui:state' }), []);

  const rows = useMemo(() => {
    if (!state) return [];
    const needle = query.trim().toLowerCase();
    const shown = state.sites.filter((r) => {
      if (needle && !r.domain.includes(needle) && !(r.cmp ?? '').toLowerCase().includes(needle) && !toolName(r.cmp).toLowerCase().includes(needle)) return false;
      if (filter === 'verified') return r.status === 'verified';
      if (filter === 'attention') return NEEDS_ATTENTION.has(r.status);
      if (filter === 'paused') return r.paused;
      return true;
    });
    const by: Record<Sort, (a: SiteRecord, b: SiteRecord) => number> = {
      site: (a, b) => a.domain.localeCompare(b.domain),
      recent: (a, b) => (b.lastAttempted ?? '').localeCompare(a.lastAttempted ?? '') || a.domain.localeCompare(b.domain),
      status: (a, b) => a.status.localeCompare(b.status) || a.domain.localeCompare(b.domain),
    };
    return shown.sort(by[sort]);
  }, [state, query, filter, sort]);

  // Local storage is capped by the browser (10 MB). Warn at 80% so nothing is dropped silently.
  const [storageShare, setStorageShare] = useState(0);
  useEffect(() => {
    void browser.storage.local
      .getBytesInUse()
      .then((bytes) => setStorageShare(bytes / STORAGE_QUOTA_BYTES))
      .catch(() => undefined);
  }, [state]);

  if (!state) return <p role="status">…</p>;
  const disabled = state.readOnly;
  const allowedByDefault = PURPOSES.filter((p) => state.settings.globalChoices[p] === 'allow');
  const chosen = rows.filter((r) => selected.has(r.domain));
  const toggle = (domain: string) => setSelected((old) => { const next = new Set(old); if (next.has(domain)) next.delete(domain); else next.add(domain); return next; });

  const forget = async () => {
    const response = await send({ type: 'ui:forget', domains: chosen.map((r) => r.domain) });
    if (response.ok) {
      setSelected(new Set());
      setMessage({ text: t('options.forgot', { count: response.removed?.length ?? 0 }), undo: response.removed ?? [] });
    }
  };
  const setPausedForChosen = async (paused: boolean) => {
    for (const r of chosen) await send({ type: 'ui:setPaused', domain: r.domain, paused });
    setMessage({ text: t('options.done') });
  };
  const resetChosen = async () => {
    for (const r of chosen) for (const p of PURPOSES) if (r.setBy[p] === 'user') await send({ type: 'ui:setSiteChoice', domain: r.domain, purpose: p, choice: null });
    setMessage({ text: t('options.done') });
  };
  const previewBulk = async (purposes: Purpose[]) => {
    const response = await send({ type: 'ui:refuseEverywhere', purposes, dryRun: true });
    if (response.ok && response.counts) setBulk({ purposes, counts: response.counts });
  };
  const applyBulk = async () => {
    if (!bulk) return;
    const response = await send({ type: 'ui:refuseEverywhere', purposes: bulk.purposes, dryRun: false });
    setBulk(null);
    if (response.ok) setMessage({ text: t('options.done') });
  };
  const exportChoices = () => {
    const file: ExportFile = {
      format: EXPORT_FORMAT,
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: { globalChoices: state.settings.globalChoices, globalSetBy: state.settings.globalSetBy },
      sites: state.sites.map((r) => ({ domain: r.domain, choices: r.choices, setBy: r.setBy, paused: r.paused })),
    };
    download(`consent-memory-choices-${file.exportedAt!.slice(0, 10)}.json`, file);
  };
  const chooseImport = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const chosenFile = input.files?.[0];
    input.value = '';
    if (!chosenFile) return;
    if (chosenFile.size > MAX_IMPORT_BYTES) return setMessage({ text: t('options.import.tooBig') });
    let file: unknown;
    try {
      file = JSON.parse(await chosenFile.text());
    } catch {
      return setMessage({ text: t('options.import.invalid') });
    }
    const response = await send({ type: 'ui:import', file, policy: 'take_imported', dryRun: true });
    if (!response.ok || !response.summary?.valid) return setMessage({ text: t('options.import.invalid') });
    setImportAllowsOk(false);
    setPendingImport({ file, summary: response.summary });
  };
  const applyImport = async (policy: 'keep_mine' | 'take_imported') => {
    if (!pendingImport) return;
    const response = await send({ type: 'ui:import', file: pendingImport.file, policy, dryRun: false });
    setPendingImport(null);
    if (response.ok) setMessage({ text: t('options.done') });
  };

  return (
    <main>
      <header>
        <Brand />
        <h1>{t('options.title')}</h1>
        <p class="muted">{t('options.lede')}</p>
      </header>
      {state.readOnly && <p class="notice">{t('options.readOnly')}</p>}
      {storageShare >= 0.8 && <p class="notice">{t('options.storageNearlyFull', { percent: Math.round(storageShare * 100) })}</p>}
      <div class="toast" role="status" aria-live="polite">
        {message && (
          <p>
            {message.text}{' '}
            {message.undo && message.undo.length > 0 && (
              <button type="button" class="quiet" onClick={async () => { await send({ type: 'ui:restore', records: message.undo! }); setMessage(null); }}>
                {t('options.undo')}
              </button>
            )}
          </p>
        )}
      </div>

      <section aria-labelledby="defaults">
        <h2 id="defaults">{t('options.defaults')}</h2>
        <p class="muted">{t('options.defaultsHint')}</p>
        <div class="card">
          {PURPOSES.map((purpose) => (
            <PurposeControl
              key={purpose}
              group="global"
              purpose={purpose}
              value={state.settings.globalChoices[purpose]}
              disabled={disabled}
              onChange={(choice) => void send({ type: 'ui:setGlobalChoice', purpose, choice: choice === 'allow' ? 'allow' : null })}
            />
          ))}
        </div>
        {allowedByDefault.length === PURPOSES.length ? (
          <p class="notice" id="defaults-all" role="status">
            {t('options.defaults.allowAll')}
          </p>
        ) : allowedByDefault.length > 0 ? (
          <p class="notice" id="defaults-mixed" role="status">
            {t('options.defaults.mixed', { list: listOf(allowedByDefault.map(purposeName)) })}
          </p>
        ) : (
          <p class="muted small">{t('popup.wholeBanner')}</p>
        )}
      </section>

      <section aria-labelledby="gpc">
        <h2 id="gpc">{t('options.gpc')}</h2>
        <p class="muted">{t('options.gpcHint')}</p>
        <div class="card">
          <fieldset class="purpose" disabled={disabled}>
            <legend>
              <span class="purpose-name">{t('options.gpc')}</span>
              <span class="purpose-desc">Sec-GPC: 1 · navigator.globalPrivacyControl</span>
            </legend>
            <div class="segmented">
              {([true, false] as const).map((on) => (
                <label key={String(on)}>
                  <input type="radio" name="gpc" checked={state.settings.gpcEnabled === on} onChange={() => void send({ type: 'ui:setGpc', enabled: on })} />
                  <span>{t(on ? 'options.gpc.on' : 'options.gpc.off')}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <p class="muted small">{t('options.gpc.legal')}</p>
        <p class="muted small">{t('options.gpc.limit')}</p>
      </section>

      <section aria-labelledby="sites">
        <h2 id="sites">{t('options.sites')}</h2>
        <p class="muted">{t('options.sitesHint')}</p>
        <div class="toolbar">
          <label>
            <span class="visually-hidden">{t('options.search')}</span>
            <input type="search" placeholder={t('options.search')} value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
          </label>
          <label>
            {t('options.filter')}{' '}
            <select value={filter} onChange={(e) => setFilter(e.currentTarget.value as Filter)}>
              {(['all', 'verified', 'attention', 'paused'] as const).map((f) => <option key={f} value={f}>{t(`options.filter.${f}`)}</option>)}
            </select>
          </label>
          <label>
            {t('options.sort')}{' '}
            <select value={sort} onChange={(e) => setSort(e.currentTarget.value as Sort)}>
              {(['site', 'recent', 'status'] as const).map((s) => <option key={s} value={s}>{t(`options.sort.${s}`)}</option>)}
            </select>
          </label>
        </div>
        {rows.length > 0 && (
          <div class="toolbar bulk">
            <button type="button" class="quiet" onClick={() => setSelected(new Set(rows.map((r) => r.domain)))}>{t('options.selectAll')}</button>
            <span class="muted">{t('options.selected', { count: chosen.length })}</span>
            <button type="button" class="quiet" disabled={disabled || chosen.length === 0} onClick={() => void setPausedForChosen(true)}>{t('options.pauseSelected')}</button>
            <button type="button" class="quiet" disabled={disabled || chosen.length === 0} onClick={() => void setPausedForChosen(false)}>{t('options.resumeSelected')}</button>
            <button type="button" class="quiet" disabled={disabled || chosen.length === 0} onClick={() => void resetChosen()}>{t('options.resetSelected')}</button>
            <button type="button" class="danger" disabled={disabled || chosen.length === 0} onClick={() => void forget()}>{t('options.forgetSelected')}</button>
          </div>
        )}
        <div class="card flush">
          {state.sites.length === 0 ? (
            <p class="empty muted">{t('options.empty')}</p>
          ) : rows.length === 0 ? (
            <p class="empty muted">{t('options.noMatch')}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col"><span class="visually-hidden">{t('options.col.select')}</span></th>
                  <th scope="col">{t('options.col.site')}</th>
                  <th scope="col">{t('options.col.result')}</th>
                  <th scope="col">{t('options.col.tool')}</th>
                  <th scope="col">{t('options.col.choices')}</th>
                  <th scope="col">{t('options.col.last')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <>
                    <tr key={r.domain}>
                      <td class="check"><input type="checkbox" aria-label={r.domain} checked={selected.has(r.domain)} onChange={() => toggle(r.domain)} /></td>
                      <td class="site" data-label={t('options.col.site')}>
                        <button type="button" class="link" aria-expanded={open === r.domain} aria-label={t('options.details', { site: r.domain })} onClick={() => setOpen(open === r.domain ? null : r.domain)}>
                          {r.domain}
                        </button>
                      </td>
                      <td data-label={t('options.col.result')}><StatusBadge record={r} /></td>
                      <td data-label={t('options.col.tool')}>{toolName(r.cmp)}</td>
                      <td data-label={t('options.col.choices')}>{choicesSummary(r)}</td>
                      <td data-label={t('options.col.last')}>{r.lastAttempted ? new Date(r.lastAttempted).toLocaleDateString(LOCALE) : '—'}</td>
                    </tr>
                    {open === r.domain && (
                      <tr key={`${r.domain}-detail`} class="detail">
                        <td colSpan={6}><div class="detail-stack"><Evidence record={r} /><AuditSummary record={r} /></div></td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section aria-labelledby="bulk">
        <h2 id="bulk">{t('options.bulk')}</h2>
        <div class="toolbar">
          <button type="button" class="quiet" disabled={disabled} onClick={() => void previewBulk([...PURPOSES])}>{t('options.bulk.nothing')}</button>
          <label>
            <span class="visually-hidden">{t('options.bulk.choose')}</span>
            <select value={bulkPurpose} onChange={(e) => setBulkPurpose(e.currentTarget.value as Purpose | '')}>
              <option value="">{t('options.bulk.choose')}</option>
              {PURPOSES.map((p) => <option key={p} value={p}>{purposeName(p)}</option>)}
            </select>
          </label>
          <button type="button" class="quiet" disabled={disabled || bulkPurpose === ''} onClick={() => bulkPurpose && void previewBulk([bulkPurpose])}>{t('options.bulk.one')}</button>
        </div>
        {bulk && (
          <div class="notice confirm" role="alertdialog" aria-labelledby="bulk-text">
            <p id="bulk-text">{bulk.counts.sites + bulk.counts.defaults === 0 ? t('options.bulk.none') : t('options.bulk.preview', bulk.counts)}</p>
            <div class="toolbar">
              {bulk.counts.sites + bulk.counts.defaults > 0 && <button type="button" onClick={() => void applyBulk()}>{t('options.confirm')}</button>}
              <button type="button" class="quiet" onClick={() => setBulk(null)}>{t('options.cancel')}</button>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="data">
        <h2 id="data">{t('options.data')}</h2>
        <div class="card rows">
          <div><div><strong>{t('options.export')}</strong><p class="muted small">{t('options.exportHint')}</p></div><button type="button" class="quiet" onClick={exportChoices}>{t('options.export')}</button></div>
          <div>
            <div><strong>{t('options.import')}</strong><p class="muted small">{t('options.importHint')}</p></div>
            <button type="button" class="quiet" disabled={disabled} onClick={() => fileInput.current?.click()}>{t('options.import')}</button>
            <input ref={fileInput} id="import-file" class="visually-hidden" type="file" accept="application/json,.json" tabIndex={-1} aria-hidden="true" onChange={(e) => void chooseImport(e)} />
          </div>
          {pendingImport && (
            <div class="notice confirm" role="alertdialog" aria-labelledby="import-text">
              <p id="import-text">{t('options.import.preview', { added: pendingImport.summary.added, differ: pendingImport.summary.changed, unchanged: pendingImport.summary.unchanged })}</p>
              {importAllows(pendingImport.summary) && (
                <div class="import-allows">
                  <p><strong>{t('options.import.allows')}</strong></p>
                  <ul>
                    {pendingImport.summary.defaultsAllowing.length > 0 && <li>{t('options.import.allows.defaults', { list: listOf(pendingImport.summary.defaultsAllowing.map(purposeName)) })}</li>}
                    {pendingImport.summary.addedAllowing > 0 && <li>{t('options.import.allows.added', { count: pendingImport.summary.addedAllowing })}</li>}
                    {pendingImport.summary.changedAllowing > 0 && <li>{t('options.import.allows.changed', { count: pendingImport.summary.changedAllowing })}</li>}
                  </ul>
                  <label class="check"><input type="checkbox" checked={importAllowsOk} onChange={(e) => setImportAllowsOk((e.currentTarget as HTMLInputElement).checked)} /> {t('options.import.allows.confirm')}</label>
                </div>
              )}
              <div class="toolbar">
                <button type="button" disabled={importAllows(pendingImport.summary) && !importAllowsOk} onClick={() => void applyImport('keep_mine')}>{t('options.import.keep')}</button>
                <button type="button" class="quiet" disabled={importAllows(pendingImport.summary) && !importAllowsOk} onClick={() => void applyImport('take_imported')}>{t('options.import.take')}</button>
                <button type="button" class="quiet" onClick={() => setPendingImport(null)}>{t('options.cancel')}</button>
              </div>
            </div>
          )}
          <div><div><strong>{t('options.deleteAll')}</strong><p class="muted small">{t('options.deleteAllHint')}</p></div><button type="button" class="danger" disabled={disabled} onClick={() => setConfirmDelete(true)}>{t('options.deleteAll')}</button></div>
          {confirmDelete && (
            <div class="notice confirm" role="alertdialog" aria-labelledby="delete-text">
              <p id="delete-text">{t('options.deleteAll.confirm')}</p>
              <div class="toolbar">
                <button type="button" class="danger" onClick={async () => { setConfirmDelete(false); const r = await send({ type: 'ui:deleteAll' }); if (r.ok) { setSelected(new Set()); setMessage({ text: t('options.done') }); } }}>{t('options.deleteAll')}</button>
                <button type="button" class="quiet" onClick={() => setConfirmDelete(false)}>{t('options.cancel')}</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="more">
        <h2 id="more">{t('options.limits')}</h2>
        <p>{t('options.limits.body')}</p>
        <div class="card rows">
          <div><div><strong>{t('options.sharing')}</strong><p class="muted small">{t('options.sharingHint')}</p></div></div>
        </div>
      </section>

      <section aria-labelledby="about">
        <h2 id="about">{t('options.about')}</h2>
        <p class="small">
          {t('options.about.publisher')}: {PUBLISHER_LINE}
        </p>
        <p class="small">
          {t('options.about.contact')}: <a href={`mailto:${PIEVRA_CONTACT}`}>{PIEVRA_CONTACT}</a>
        </p>
        <p class="muted small">{t('options.about.licence')}</p>
        <p class="small">
          <a href="/onboarding.html">{t('options.about.how')}</a>
        </p>
        <p class="small">
          <a href="/results.html">{t('options.about.results')}</a>
          <span class="muted"> — {t('options.about.resultsHint')}</span>
        </p>
      </section>
    </main>
  );
}

render(<Options />, document.getElementById('app')!);
