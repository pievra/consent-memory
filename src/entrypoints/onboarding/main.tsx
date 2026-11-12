import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { UiState } from '../../adapters/shared/ui-protocol';
import { PIEVRA_CONTACT, PUBLISHER_LINE } from '../../config/brand';
import { features } from '../../config/features';
import { Brand } from '../../ui/brand';
import { LANG, call, t } from '../../ui/shared';
import type { MessageKey } from '../../locales/en';

document.documentElement.lang = LANG === 'fr' ? 'fr' : 'en-GB';
document.title = `${t('onboarding.title')} — ${t('appName')}`;

// In the order of how often a person's first run met them (docs/qa/test-evidence.md, 2026-11-11).
const RESULTS: Array<{ tone: 'ok' | 'warn' | 'neutral'; mark: string; key: 'verified' | 'partial' | 'wall' | 'attempted' | 'skipped' }> = [
  { tone: 'ok', mark: '✓', key: 'verified' },
  { tone: 'warn', mark: '◐', key: 'partial' },
  { tone: 'warn', mark: '!', key: 'wall' },
  { tone: 'warn', mark: '?', key: 'attempted' },
  { tone: 'neutral', mark: '–', key: 'skipped' },
];

/** Shown once after installation, and reachable from the settings page. Changes nothing unless the user uses the one control. */
function Onboarding() {
  const [state, setState] = useState<UiState | null>(null);
  useEffect(() => {
    void call({ type: 'ui:state' }).then((response) => response.ok && setState(response.state));
  }, []);
  const setGpc = async (enabled: boolean) => {
    const response = await call({ type: 'ui:setGpc', enabled });
    if (response.ok) setState(response.state);
  };

  return (
    <main>
      <header>
        <Brand />
        <p class="eyebrow">{t('onboarding.eyebrow')}</p>
        <h1>{t('onboarding.heading')}</h1>
        <p class="lede">{t('onboarding.lede')}</p>
      </header>

      <section aria-labelledby="how">
        <h2 id="how">{t('onboarding.how')}</h2>
        <ol class="steps">
          {[1, 2, 3].map((n) => (
            <li key={n}>
              <div>
                <strong>{t(`onboarding.step${n}` as MessageKey)}</strong>
                <span>{t(`onboarding.step${n}.desc` as MessageKey)}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="start">
        <h2 id="start">{t('onboarding.start')}</h2>
        <p class="muted">{t('onboarding.start.desc')}</p>
        <div class="card">
          <fieldset class="purpose" disabled={!state || state.readOnly}>
            <legend>
              <span class="purpose-name">{t('options.gpc')}</span>
              <span class="purpose-desc">{t('options.gpcHint')}</span>
            </legend>
            <div class="segmented">
              {[true, false].map((on) => (
                <label key={String(on)}>
                  <input type="radio" name="gpc" checked={state?.settings.gpcEnabled === on} onChange={() => void setGpc(on)} />
                  <span>{t(on ? 'options.gpc.on' : 'options.gpc.off')}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <section aria-labelledby="results">
        <h2 id="results">{t('onboarding.results')}</h2>
        <dl class="results">
          {RESULTS.map(({ tone, mark, key }) => (
            <div key={key}>
              <dt>
                <span class="status" data-tone={tone}>
                  <span aria-hidden="true">{mark}</span> {t(`status.${key}`)}
                </span>
              </dt>
              <dd>{t(`onboarding.result.${key}` as MessageKey)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {features.testerInvitation && (
        <section aria-labelledby="test" class="card test-invite">
          <h2 id="test">{t('onboarding.test')}</h2>
          <p>{t('onboarding.test.desc', { contact: PIEVRA_CONTACT })}</p>
          <p>
            <a href="/results.html">{t('onboarding.test.link')}</a>
          </p>
        </section>
      )}

      <section aria-labelledby="privacy">
        <h2 id="privacy">{t('onboarding.privacy')}</h2>
        <ul class="plain">
          {[1, 2, 3].map((n) => (
            <li key={n}>{t(`onboarding.privacy${n}` as MessageKey)}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">{t('onboarding.limits')}</h2>
        <ul class="plain">
          {[1, 2, 3].map((n) => (
            <li key={n}>{t(`onboarding.limit${n}` as MessageKey)}</li>
          ))}
        </ul>
      </section>

      <div class="actions">
        <a class="button" href="/options.html">
          {t('onboarding.openSettings')}
        </a>
      </div>

      <footer>
        <p>
          {PUBLISHER_LINE} · <a href={`mailto:${PIEVRA_CONTACT}`}>{PIEVRA_CONTACT}</a>
        </p>
      </footer>
    </main>
  );
}

render(<Onboarding />, document.getElementById('app')!);
