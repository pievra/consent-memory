import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import type { UiRequest, UiState } from '../../adapters/shared/ui-protocol';
import { PURPOSES } from '../../core/consent/purposes';
import { Brand } from '../../ui/brand';
import { AuditSummary, Evidence, LANG, NextStep, PurposeControl, StatusBadge, call, choicesSummary, siteChoice, statusDescription, t } from '../../ui/shared';

document.documentElement.lang = LANG === 'fr' ? 'fr' : 'en-GB';
document.title = t('appName');

/** The page the popup was opened over. `?site=` lets the popup be opened in a tab for a given address. */
async function currentTabUrl(): Promise<string | undefined> {
  const forced = new URLSearchParams(location.search).get('site');
  if (forced) return forced;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.url;
}

function Popup() {
  const [state, setState] = useState<UiState | null>(null);
  const [tabUrl, setTabUrl] = useState<string | undefined>();
  const [error, setError] = useState(false);
  const [choicesOpen, setChoicesOpen] = useState(false);

  const send = async (request: UiRequest) => {
    const response = await call(request);
    if (!response.ok) return setError(true);
    setError(false);
    // Changes return the general state; ask again with the tab address to keep the current site.
    const refreshed = request.type === 'ui:state' ? response : await call({ type: 'ui:state', tabUrl });
    if (refreshed.ok) setState(refreshed.state);
  };

  useEffect(() => {
    void currentTabUrl().then(async (url) => {
      setTabUrl(url);
      const response = await call({ type: 'ui:state', tabUrl: url });
      if (response.ok) setState(response.state);
      else setError(true);
    });
  }, []);

  if (!state) return <p role="status">{error ? t('common.error') : '…'}</p>;
  const current = state.current;
  const settingsLink = (
    <a class="button quiet" href="/options.html" target="_blank" rel="noopener">
      {t('popup.settings')}
    </a>
  );
  if (!current) {
    return (
      <>
        <Brand />
        <p class="muted">{t('popup.noSite')}</p>
        <div class="footer">{settingsLink}</div>
      </>
    );
  }
  const { domain, record } = current;
  const paused = record?.paused ?? false;
  return (
    <>
      <Brand />
      <header>
        <p class="eyebrow">{t('popup.thisSite')}</p>
        <h1>{domain}</h1>
      </header>
      <div class="result" role="status" aria-live="polite">
        <StatusBadge record={record} />
        <p class="muted">{statusDescription(record)}</p>
      </div>
      {record && !paused && record.status !== 'not_detected' && record.status !== 'detected' && <Evidence record={record} />}
      {record && <NextStep record={record} />}
      {record && !paused && <AuditSummary record={record} />}
      {error && <p class="notice">{t('common.error')}</p>}
      {/* Folded by default: the result comes first, and most people never change a choice per site. */}
      <details class="choices" open={choicesOpen} onToggle={(event) => setChoicesOpen((event.currentTarget as HTMLDetailsElement).open)}>
        <summary>
          <span class="choices-title">{t('popup.choices')}</span>
          <span class="choices-now">{record ? choicesSummary(record) : t('options.choices.default')}</span>
          <span class="choices-open" aria-hidden="true">{t('popup.choices.open')}</span>
        </summary>
        <p class="muted small">{t('popup.choicesHint')}</p>
        {PURPOSES.map((purpose) => (
          <PurposeControl
            key={purpose}
            group="site"
            purpose={purpose}
            value={siteChoice(record, purpose)}
            defaultChoice={state.settings.globalChoices[purpose]}
            disabled={state.readOnly}
            onChange={(choice) => void send({ type: 'ui:setSiteChoice', domain, purpose, choice })}
          />
        ))}
        <p class="muted small">{t('popup.wholeBanner')}</p>
      </details>
      <p class="muted small" id="gpc-status">{t(paused ? 'popup.gpc.paused' : state.settings.gpcEnabled ? 'popup.gpc.on' : 'popup.gpc.off')}</p>
      <div class="footer">
        <button type="button" class="quiet" disabled={state.readOnly} onClick={() => void send({ type: 'ui:setPaused', domain, paused: !paused })}>
          {paused ? t('popup.resume') : t('popup.pause')}
        </button>
        {settingsLink}
      </div>
    </>
  );
}

render(<Popup />, document.getElementById('app')!);
