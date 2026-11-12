import { browser } from 'wxt/browser';
import type { UiRequest, UiResponse } from '../adapters/shared/ui-protocol';
import { PURPOSES, type Choice, type Purpose } from '../core/consent/purposes';
import type { ConsentStatus } from '../core/consent/states';
import { en, type MessageKey } from '../locales/en';
import { fr } from '../locales/fr';
import { summarise, type AuditCheckResult } from '../audit/checks';
import { isWall } from '../engines/walls';
import type { SiteRecord } from '../storage/schema';

// ---- language --------------------------------------------------------------

const requested = new URLSearchParams(location.search).get('lang');
export const LANG: 'en' | 'fr' = (requested ?? browser.i18n.getUILanguage()).toLowerCase().startsWith('fr') ? 'fr' : 'en';
export const LOCALE = LANG === 'fr' ? 'fr-FR' : 'en-GB';
const dictionary: Record<MessageKey, string> = LANG === 'fr' ? fr : en;

export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  return dictionary[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
export const listOf = (items: string[]) => new Intl.ListFormat(LOCALE, { style: 'long', type: 'conjunction' }).format(items);
export const purposeName = (p: Purpose) => t(`purpose.${p}`);

// ---- background API ----------------------------------------------------------

export async function call(request: UiRequest): Promise<UiResponse> {
  try {
    const response = (await browser.runtime.sendMessage(request)) as UiResponse | undefined;
    return response ?? { ok: false, error: 'failed' };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

// ---- status ------------------------------------------------------------------

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';
const TONES: Record<ConsentStatus, { tone: Tone; mark: string }> = {
  verified: { tone: 'ok', mark: '✓' },
  partial: { tone: 'warn', mark: '◐' },
  recorded: { tone: 'warn', mark: '◐' },
  attempted: { tone: 'warn', mark: '?' },
  inconclusive: { tone: 'warn', mark: '?' },
  failed: { tone: 'bad', mark: '✕' },
  skipped: { tone: 'neutral', mark: '–' },
  unsupported: { tone: 'neutral', mark: '–' },
  detected: { tone: 'neutral', mark: '•' },
  not_detected: { tone: 'neutral', mark: '•' },
};

const SIX_MONTHS_MS = 182 * 24 * 3600 * 1000;
export const isStale = (record: SiteRecord) =>
  record.status === 'verified' && record.lastVerified !== undefined && Date.now() - Date.parse(record.lastVerified) > SIX_MONTHS_MS;

/** Success styling is used only for a verified result that is not stale. Status is never conveyed by colour alone. */
export function StatusBadge({ record }: { record: SiteRecord | null }) {
  if (record?.paused) {
    return (
      <span class="status" data-tone="neutral">
        <span aria-hidden="true">Ⅱ</span> {t('status.paused')}
      </span>
    );
  }
  if (record && noAccept(record)) {
    return (
      <span class="status" data-tone="warn">
        <span aria-hidden="true">?</span> {t('status.noAccept')}
      </span>
    );
  }
  if (record && isWall(record)) {
    return (
      <span class="status" data-tone="warn">
        <span aria-hidden="true">!</span> {t('status.wall')}
      </span>
    );
  }
  const status: ConsentStatus = record?.status ?? 'not_detected';
  const { tone, mark } = TONES[status];
  return (
    <span class="status" data-tone={record && isStale(record) ? 'neutral' : tone}>
      <span aria-hidden="true">{mark}</span> {t(record && confirmedChoices(record) ? 'status.verifiedChoices' : `status.${status}`)}
    </span>
  );
}

/** The user allowed everything and this consent tool gives the engine no way to accept: nothing was clicked. */
const noAccept = (record: SiteRecord) => record.status === 'inconclusive' && (record.evidenceSummary ?? []).includes('reason: no_accept_route');

/** The result was set and read back purpose by purpose, so it is not simply "a refusal". */
const byPurpose = (record: SiteRecord) => (record.evidenceSummary ?? []).some((line) => /^cmp_state_read: (confirms|partial|contradicts)/.test(line));
const confirmedChoices = (record: SiteRecord) => record.status === 'verified' && (record.evidenceSummary ?? []).some((line) => line.startsWith('cmp_state_read: confirms'));

/**
 * Why a result is only "partly done", when the evidence says so plainly:
 * - 'li': consent was refused and the site still declares legitimate interest;
 * - 'choices': the refusal is confirmed, and only the user's own allowed purposes were not granted.
 */
function partialReason(record: SiteRecord): 'li' | 'choices' | null {
  if (record.status !== 'partial') return null;
  const lines = record.evidenceSummary ?? [];
  if (lines.some((line) => line.startsWith('tcf_read: partial'))) return 'li';
  const confirmed = lines.some((line) => /^\w+: confirms/.test(line)) && !lines.some((line) => /^\w+: (partial|contradicts)/.test(line));
  return confirmed && (record.unfulfilled?.length ?? 0) > 0 ? 'choices' : null;
}

/** One sentence on what the user can do next, for results that leave something to them. */
export function NextStep({ record }: { record: SiteRecord }) {
  const key = noAccept(record) ? 'noAccept' : isWall(record) ? 'wall' : partialReason(record);
  if (!key || record.paused) return null;
  return (
    <p class="next">
      <strong>{t('next.title')}</strong> {t(`next.${key}`)}
    </p>
  );
}

export function statusDescription(record: SiteRecord | null): string {
  if (record?.paused) return t('status.paused.desc');
  if (record && confirmedChoices(record)) return t('status.verifiedChoices.desc');
  if (record && noAccept(record)) return t('status.noAccept.desc');
  if (record && isWall(record)) return t('status.wall.desc');
  const reason = record ? partialReason(record) : null;
  if (reason) return t(`status.partial.${reason}.desc`);
  return t(`status.${record?.status ?? 'not_detected'}.desc`);
}

/** Turns the terse stored evidence lines into sentences in the user's language. */
const firstNumber = (line: string) => Number(/\d+/.exec(line.includes('—') ? line.slice(line.indexOf('—')) : '')?.[0] ?? 0);

export function evidenceLines(record: SiteRecord): string[] {
  const out: string[] = [];
  for (const line of record.evidenceSummary ?? []) {
    const count = Number(/(\d+) purposes/.exec(line)?.[1] ?? 0);
    if (line.startsWith('cmp_self_test: confirms')) out.push(t('evidence.selfTestOk'));
    else if (line.startsWith('cmp_self_test: unavailable')) out.push(t('evidence.bannerClosed'));
    else if (line.startsWith('cmp_self_test: contradicts')) out.push(line.includes('still open') ? t('evidence.bannerOpen') : t('evidence.selfTestBad'));
    else if (line.startsWith('tcf_read: confirms')) out.push(t('evidence.tcfOk'));
    else if (line.startsWith('tcf_read: partial')) out.push(t('evidence.tcfLi', { count }));
    else if (line.startsWith('tcf_read: contradicts')) out.push(t('evidence.tcfStill', { count }));
    else if (line.startsWith('cmp_state_read: confirms')) out.push(t('evidence.stateOk', { count: firstNumber(line) }));
    else if (line.startsWith('cmp_state_read: partial')) out.push(t('evidence.stateOff', { count: firstNumber(line) }));
    else if (line.startsWith('cmp_state_read: contradicts')) out.push(t('evidence.stateOn', { count: firstNumber(line) }));
    else if (line === 'reason: unsafe_context') out.push(t('evidence.unsafe'));
    else if (line === 'reason: action_failed') out.push(t('evidence.actionFailed'));
    else if (line.startsWith('source: embedded frame')) out.push(t('evidence.frame'));
    else if (line.startsWith('source: read from the page')) out.push(t('evidence.fromPage'));
  }
  if (record.unfulfilled?.length) out.push(t(byPurpose(record) ? 'evidence.notOffered' : 'evidence.unfulfilled', { list: listOf(record.unfulfilled.map(purposeName)) }));
  if (isStale(record)) out.push(t('evidence.stale'));
  return out;
}

export function Evidence({ record }: { record: SiteRecord }) {
  const lines = evidenceLines(record);
  return (
    <div class="evidence">
      <h3>{t('evidence.title')}</h3>
      {lines.length === 0 ? (
        <p>{t('evidence.none')}</p>
      ) : (
        <ul>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {record.lastVerified && <p class="when">{t('evidence.lastVerified', { date: formatDate(record.lastVerified) })}</p>}
      {!record.lastVerified && record.lastAttempted && <p class="when">{t('evidence.lastAttempted', { date: formatDate(record.lastAttempted) })}</p>}
    </div>
  );
}

// ---- purpose control ---------------------------------------------------------

export interface PurposeControlProps {
  purpose: Purpose;
  /** null means "my default" and is offered only when `defaultChoice` is given. */
  value: Choice | null;
  defaultChoice?: Choice;
  disabled?: boolean;
  group: string;
  onChange: (value: Choice | null) => void;
}

/** One purpose with native radio buttons: keyboard and screen reader behaviour come for free. */
export function PurposeControl({ purpose, value, defaultChoice, disabled, group, onChange }: PurposeControlProps) {
  const options: Array<{ v: Choice | null; label: string }> = [];
  if (defaultChoice) options.push({ v: null, label: t('choice.defaultIs', { value: t(`choice.${defaultChoice}`).toLowerCase() }) });
  options.push({ v: 'refuse', label: t('choice.refuse') }, { v: 'allow', label: t('choice.allow') });
  const name = `${group}-${purpose}`;
  return (
    <fieldset class="purpose" disabled={disabled}>
      <legend>
        <span class="purpose-name">{purposeName(purpose)}</span>
        <span class="purpose-desc">{t(`purpose.${purpose}.desc`)}</span>
      </legend>
      <div class="segmented">
        {options.map((option) => (
          <label key={String(option.v)}>
            <input type="radio" name={name} checked={value === option.v} onChange={() => onChange(option.v)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function siteChoice(record: SiteRecord | null, purpose: Purpose): Choice | null {
  return record && record.setBy[purpose] === 'user' ? record.choices[purpose] : null;
}

export function choicesSummary(record: SiteRecord): string {
  const set = PURPOSES.filter((p) => record.setBy[p] === 'user');
  if (set.length === 0) return t('options.choices.default');
  const allowed = set.filter((p) => record.choices[p] === 'allow');
  return allowed.length === 0 ? t('options.choices.refuseAll') : t('options.choices.custom', { list: listOf(allowed.map(purposeName)) });
}

// ---- technical audit ---------------------------------------------------------

const AUDIT_TONE: Record<AuditCheckResult['outcome'], { tone: Tone; mark: string }> = {
  passed: { tone: 'ok', mark: '✓' },
  signal_detected: { tone: 'warn', mark: '!' },
  inconclusive: { tone: 'neutral', mark: '?' },
  not_applicable: { tone: 'neutral', mark: '–' },
};

function auditDetail(check: AuditCheckResult): string {
  const vars = { count: check.count ?? check.services?.length ?? 0, list: listOf(check.services ?? []) };
  if (check.outcome === 'signal_detected') return t(`audit.check.${check.check}.signal` as MessageKey, vars);
  if (check.outcome === 'passed') return t(`audit.check.${check.check}.passed` as MessageKey, vars);
  if (check.outcome === 'inconclusive' && check.check === 'tracking_after_refusal') return t('audit.check.tracking_after_refusal.inconclusive');
  return t(check.outcome === 'inconclusive' ? 'audit.generic.inconclusive' : 'audit.generic.not_applicable');
}

/** The six technical checks, worded as observations. Shown only when an audit exists. */
export function AuditSummary({ record }: { record: SiteRecord }) {
  const audit = record.audit;
  if (!audit) return null;
  const totals = summarise(audit);
  return (
    <div class="audit">
      <h3>{t('audit.title')}</h3>
      <p class="audit-total">{t('audit.summary', { passed: totals.passed, signals: totals.signal_detected, inconclusive: totals.inconclusive })}</p>
      <ul>
        {audit.checks
          .filter((check) => check.outcome !== 'not_applicable')
          .map((check) => (
            <li key={check.check}>
              <span class="status" data-tone={AUDIT_TONE[check.outcome].tone}>
                <span aria-hidden="true">{AUDIT_TONE[check.outcome].mark}</span> {t(`audit.outcome.${check.outcome}`)}
              </span>{' '}
              <strong>{t(`audit.check.${check.check}`)}</strong>
              <span class="audit-detail">{auditDetail(check)}</span>
            </li>
          ))}
      </ul>
      <p class="when">{t('audit.note', { known: audit.trackersKnown })}</p>
    </div>
  );
}
