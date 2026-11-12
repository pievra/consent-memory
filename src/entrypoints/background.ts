import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { syncGpc } from '../adapters/chromium/gpc';
import { buildAudit } from '../audit/checks';
import { observedTracker, trackerFor } from '../audit/classifications';
import { AFTER_WINDOW_MS, claimActed, confirmClaim, markActed, markBanner, observe, settleClaims, startPageAudit, type PageAudit } from '../audit/collector';
import { readBannerStateInPage } from '../audit/page-reader';
import { chromiumLocalStorage } from '../adapters/chromium/storage';
import { parsePageRequest, validateSender, type TrustedSender } from '../adapters/shared/messages';
import { isOwnExtensionPage, parseUiRequest } from '../adapters/shared/ui-messages';
import type { UiRequest, UiResponse, UiState } from '../adapters/shared/ui-protocol';
import type { AuditResponse, EvalResponse, InitResponse, PageRequest, PurposesResponse, ReportResponse, TcfResponse } from '../adapters/shared/protocol';
import { AUDIT_RETENTION_MS, EVIDENCE_DELAY_MS, PURPOSE_READ_ATTEMPTS, PURPOSE_READ_INTERVAL_MS, TCF_READ_TIMEOUT_MS } from '../config/constants';
import { features } from '../config/features';
import { planAction, planWholeBannerAction } from '../core/consent/mappings';
import { purposeAdapter, purposeOfferings } from '../engines/purposes/registry';
import { resolvePreferences } from '../core/consent/resolver';
import { evaluatePurposeState, evaluateTcf, type TcfSnapshot } from '../core/consent/verifier';
import { siteKeysForUrl, type SiteKeys } from '../core/domains/site-key';
import { rulesForFrame, snippetById } from '../engines/autoconsent/background';
import { AUTOCONSENT_VERSION, autoconsentConfig } from '../engines/autoconsent/config';
import { readTcfInPage } from '../engines/autoconsent/tcf-reader';
import { CODE_RULE_NAMES, hasStateReadingTest } from '../engines/autoconsent/test-kinds';
import { objectionSnippet } from '../engines/objections';
import { applyReport, applyTopFrameEvidence, applyWall, resumableCmp, topFrameSnapshotFor } from '../storage/apply-report';
import { Repository } from '../storage/repository';
import { KEY, siteRecordSchema, type SiteRecord } from '../storage/schema';
import { badgeFor } from '../core/consent/badge';

// The service worker can stop at any time. It keeps no run state in memory:
// each request is answered from storage, and each report is written before replying.
export default defineBackground(() => {
  const repository = new Repository(chromiumLocalStorage());
  const ready = repository.init();

  /** Brings the browser's GPC header rule and page signal in line with the settings and paused sites. */
  async function applyGpc(): Promise<void> {
    try {
      await ready;
      const [settings, sites] = await Promise.all([repository.getSettings(), repository.listSites()]);
      await syncGpc(settings.gpcEnabled, sites.filter((site) => site.paused).map((site) => site.domain));
    } catch {
      // GPC is independent of consent handling: a failure here must not stop anything else.
    }
  }
  void applyGpc();

  // The welcome page opens once, after installation only — never after an update or a browser restart.
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') void browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') }).catch(() => undefined);
  });
  void ready.then(() => (repository.readOnly ? 0 : repository.pruneAudits(AUDIT_RETENTION_MS))).catch(() => 0);

  /** The mark on the toolbar button for one tab. Never throws: a closed tab is not an error. */
  async function paintBadge(tabId: number, record: SiteRecord | null): Promise<void> {
    const badge = badgeFor(record, Date.now());
    try {
      await browser.action.setBadgeText({ tabId, text: badge?.text ?? '' });
      if (badge) {
        await browser.action.setBadgeBackgroundColor({ tabId, color: badge.color });
        await browser.action.setBadgeTextColor({ tabId, color: '#ffffff' });
      }
    } catch {
      // The tab went away.
    }
  }

  // Whatever changes a site's record (a run, a pause from the popup, forgetting the site),
  // tabs showing that site get the new mark. Addresses come from the browser's tab list.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const sites = new Map<string, SiteRecord | null>();
    for (const [key, change] of Object.entries(changes)) {
      if (!key.startsWith(KEY.sitePrefix)) continue;
      const parsed = siteRecordSchema.safeParse(change.newValue);
      sites.set(key.slice(KEY.sitePrefix.length), parsed.success ? parsed.data : null);
    }
    if (sites.size === 0) return;
    void browser.tabs.query({}).then((tabs) => {
      for (const tab of tabs) {
        const site = tab.url ? siteKeysForUrl(tab.url)?.site : undefined;
        if (tab.id !== undefined && site !== undefined && sites.has(site)) void paintBadge(tab.id, sites.get(site) ?? null);
      }
    });
  });

  async function handleInit(sender: TrustedSender): Promise<InitResponse> {
    const keys = siteKeysForUrl(sender.tabUrl);
    if (!keys) return { mode: 'skip', reason: 'unsupported_page' };
    const opened = await ready;
    // A read only store still serves preferences; with no store at all, do nothing rather than guess.
    if (opened.mode === 'read_only' && opened.reason === 'invalid_meta') return { mode: 'skip', reason: 'store_unavailable' };
    const resolution = resolvePreferences(await repository.resolverInput(keys));
    if (resolution.paused) {
      if (sender.frameId === 0) void paintBadge(sender.tabId, await repository.findSite(keys));
      return { mode: 'skip', reason: 'paused' };
    }
    const mainFrame = sender.frameId === 0;
    const url = mainFrame ? sender.tabUrl : sender.frameUrl || sender.tabUrl;
    const rules = rulesForFrame(url, mainFrame);
    const names = [...rules.r.map((rule) => String(rule[1])), ...CODE_RULE_NAMES];
    const record = mainFrame ? await repository.findSite(keys) : null;
    // A new page clears the tab's mark: show what is already known about this site.
    if (mainFrame) void paintBadge(sender.tabId, record);
    return {
      mode: 'run',
      resolution,
      rules,
      config: autoconsentConfig(),
      stateTests: names.filter(hasStateReadingTest),
      resumeCmp: resumableCmp(record, new Date()),
      // Purposes are set one by one only in the page itself, never from inside a frame.
      purposeOfferings: features.purposeLevelExecution && mainFrame ? purposeOfferings() : {},
    };
  }

  /**
   * Sets, or reads back, a consent tool's purposes one by one through its adapter.
   *
   * The content script only names the consent tool. Everything that matters is decided here:
   * - the sender must be the page itself (frame 0) and the tool must have an adapter;
   * - the site is taken from the address of the document that sent the message, and the
   *   functions are injected into that one document, by the browser's document identifier.
   *   If the tab has moved on (a link, the back button, a redirect), the browser refuses the
   *   injection, so one site's choices can never be submitted on another site's page;
   * - what to switch on comes from the stored choices for that site, never from the message;
   * - the functions run are bundled with the extension.
   */
  async function handlePurposes(sender: TrustedSender, request: Extract<PageRequest, { type: 'page:purposes' }>): Promise<PurposesResponse> {
    const unavailable: PurposesResponse = request.op === 'apply' ? { applied: false } : { evidence: { kind: 'cmp_state_read', outcome: 'unavailable' } };
    const adapter = features.purposeLevelExecution && sender.frameId === 0 ? purposeAdapter(request.cmp) : null;
    const keys = siteKeysForUrl(sender.frameUrl);
    if (!adapter || !keys || !sender.documentId) return unavailable;
    await ready;
    const resolution = resolvePreferences(await repository.resolverInput(keys));
    if (resolution.paused) return unavailable;
    const plan = planAction(resolution.choices, resolution.sources, adapter);
    if (plan.action !== 'purposes' || !plan.grant) return unavailable;
    const grant = plan.grant;
    const target = { tabId: sender.tabId, documentIds: [sender.documentId] };
    try {
      if (request.op === 'apply') {
        const [injection] = await browser.scripting.executeScript({ target, world: 'MAIN', func: adapter.apply.func, args: adapter.apply.args((purpose) => grant.includes(purpose)) });
        return { applied: injection?.result === true };
      }
      // The tool records the answer shortly after it is submitted, and may still show an older
      // answer until then: keep looking until it matches, and report the last thing seen.
      let evidence = unavailable.evidence!;
      for (let attempt = 0; attempt < PURPOSE_READ_ATTEMPTS; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, PURPOSE_READ_INTERVAL_MS));
        const [injection] = await browser.scripting.executeScript({ target, world: 'MAIN', func: adapter.read.func });
        evidence = evaluatePurposeState(adapter.read.states(injection?.result ?? null), grant);
        if (evidence.outcome === 'confirms') break;
      }
      return { evidence };
    } catch {
      return unavailable;
    }
  }

  async function handleEval(sender: TrustedSender, snippetId: string): Promise<EvalResponse> {
    const snippet = snippetById(snippetId);
    if (!snippet || !sender.documentId) return { result: false };
    try {
      const [injection] = await browser.scripting.executeScript({
        // Pinned to the document that asked: if the tab has moved on, the browser refuses.
        target: { tabId: sender.tabId, documentIds: [sender.documentId] },
        world: 'MAIN',
        func: snippet,
      });
      return { result: injection?.result === true };
    } catch {
      return { result: false };
    }
  }

  /**
   * Reads TCF state from the tab's top level page. With `documentId` the read is pinned to
   * that one document: if the tab has navigated since, the browser refuses the injection.
   */
  async function readTopTcf(sender: TrustedSender, documentId?: string): Promise<TcfSnapshot | null> {
    try {
      const [injection] = await browser.scripting.executeScript({
        target: documentId ? { tabId: sender.tabId, documentIds: [documentId] } : { tabId: sender.tabId, frameIds: [0] },
        world: 'MAIN',
        func: readTcfInPage,
        args: [TCF_READ_TIMEOUT_MS],
      });
      return injection?.result ?? null;
    } catch {
      return null;
    }
  }

  async function handleTcf(sender: TrustedSender): Promise<TcfResponse> {
    return { snapshot: await readTopTcf(sender) };
  }

  async function handleReport(sender: TrustedSender, report: Extract<PageRequest, { type: 'page:report' }>): Promise<ReportResponse> {
    const keys = siteKeysForUrl(sender.tabUrl);
    if (!keys) return { stored: false };
    await ready;
    if (repository.readOnly) return { stored: false };
    // A self test that only shows the banner is gone is not confirmation, whoever claims it.
    const overclaims = report.evidence.some((e) => e.kind === 'cmp_self_test' && e.outcome === 'confirms') && !(report.cmp && hasStateReadingTest(report.cmp));
    if (overclaims) return { stored: false };
    // Per purpose evidence exists only for the page itself and only for a consent tool with an adapter.
    const purposeEvidence = report.evidence.some((e) => e.kind === 'cmp_state_read');
    if (purposeEvidence && !(sender.frameId === 0 && features.purposeLevelExecution && purposeAdapter(report.cmp))) return { stored: false };
    // A subframe counts as the site's own only when its URL is on the same site as the top level page.
    // about:blank, srcdoc and cross-site frames are treated as third party.
    const sameSite = sender.frameId === 0 || siteKeysForUrl(sender.frameUrl)?.site === keys.site;
    let stored = false;
    await repository.updateSite(keys.site, (existing) => {
      const next = applyReport(existing, keys.site, report, AUTOCONSENT_VERSION, new Date(), sameSite);
      stored = next !== null;
      return next;
    });
    // The page's own frames may say when the refusal completed. A frame from another site can
    // only claim it; the claim counts once the page's own state confirms it (verifyFromTopFrame).
    if (report.actionCompleted === true) {
      await withAudit(sender.tabId, (audit) => {
        if (!audit || audit.site !== keys.site) return audit;
        return sameSite ? markActed(audit, Date.now()) : claimActed(audit, Date.now());
      });
    }
    if (stored && sender.frameId !== 0 && report.state === 'ACTION_ATTEMPTED' && report.actionCompleted === true) {
      await verifyFromTopFrame(sender, keys);
    }
    return { stored };
  }

  // ---- Technical audit ------------------------------------------------------------
  // One small record per tab, kept in session storage (memory only, cleared when the browser
  // closes) so it survives this worker being stopped. It holds service domains from the
  // bundled list, never URLs. It is written to the site record only when a banner was seen.
  const auditKey = (tabId: number) => `audit:${tabId}`;
  const auditQueues = new Map<number, Promise<unknown>>();
  const withAudit = (tabId: number, change: (audit: PageAudit | null) => PageAudit | null | Promise<PageAudit | null>): Promise<void> => {
    const run = (auditQueues.get(tabId) ?? Promise.resolve()).then(async () => {
      const key = auditKey(tabId);
      const current = ((await browser.storage.session.get(key))[key] as PageAudit | undefined) ?? null;
      const next = await change(current);
      if (next === current) return;
      if (next) await browser.storage.session.set({ [key]: next });
      else await browser.storage.session.remove(key);
    });
    auditQueues.set(tabId, run.catch(() => undefined));
    return run.catch(() => undefined);
  };

  /** Writes the six checks to the site record, if a banner was seen and the site has a record. */
  async function concludeAudit(unsettled: PageAudit): Promise<void> {
    const page = settleClaims(unsettled);
    if (page.bannerSeenAt === undefined) return;
    await ready;
    if (repository.readOnly) return;
    const keys = { host: page.site, site: page.site };
    const resolution = resolvePreferences(await repository.resolverInput(keys));
    if (resolution.paused) return;
    // "After refusal" checks apply when what was carried out was a refusal of everything.
    const cmp = (await repository.getSite(page.site))?.cmp;
    const refused = planAction(resolution.choices, resolution.sources, features.purposeLevelExecution ? purposeAdapter(cmp) : null).action === 'optOut';
    const settings = await repository.getSettings();
    const result = buildAudit(page, { refused, gpcEnabled: settings.gpcEnabled, now: Date.now() });
    await repository.updateSite(page.site, (existing) => (existing ? { ...existing, audit: result } : null)).catch(() => null);
  }

  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0) return undefined;
      if (details.type === 'main_frame') {
        // Prerendered and other non visible documents share the tab id but are not the page the user is on.
        const { documentLifecycle, frameType } = details as { documentLifecycle?: string; frameType?: string };
        if ((documentLifecycle !== undefined && documentLifecycle !== 'active') || (frameType !== undefined && frameType !== 'outermost_frame')) return undefined;
        // A new page: conclude what was observed on the previous one, then start afresh.
        const site = siteKeysForUrl(details.url)?.site;
        void withAudit(details.tabId, async (previous) => {
          if (previous) await concludeAudit(previous);
          return site ? startPageAudit(site, Date.now()) : null;
        });
        return undefined;
      }
      // Cheap test first: almost every request is not to a listed service and costs nothing more.
      let host: string;
      try {
        host = new URL(details.url).hostname;
      } catch {
        return undefined;
      }
      if (!trackerFor(host)) return undefined;
      void withAudit(details.tabId, (audit) => {
        const match = audit ? observedTracker(details.url, audit.site) : null;
        return audit && match ? observe(audit, match.service) : audit;
      });
      return undefined;
    },
    { urls: ['http://*/*', 'https://*/*'] },
  );
  browser.tabs.onRemoved.addListener((tabId) => {
    void withAudit(tabId, async (audit) => {
      if (audit) await concludeAudit(audit);
      return null;
    });
  });

  /** True when the frame that sent a message belongs to the same site as the tab's page. */
  const ownFrame = (sender: TrustedSender, site: string): boolean => sender.frameId === 0 || siteKeysForUrl(sender.frameUrl)?.site === site;

  /**
   * Audit events from content scripts. Every event is checked against the tab's current
   * page: the observation must be for the site the tab is on now.
   *
   * - `banner` may come from any frame, because consent banners are often served from the
   *   vendor's own domain. All it does is note that a banner was open and make the
   *   background read the page's own state. It supplies no data.
   * - `finish` concludes the audit and supplies a click count, so it is accepted only from
   *   the page's own frames and only for the page load it was issued for. Other pages
   *   conclude when the tab navigates or closes.
   */
  async function handleAudit(sender: TrustedSender, request: Extract<PageRequest, { type: 'page:audit' }>): Promise<AuditResponse> {
    const site = siteKeysForUrl(sender.tabUrl)?.site;
    if (!site) return { ok: false };
    if (request.event === 'banner') {
      let state: Awaited<ReturnType<typeof readBannerStateInPage>> | null = null;
      try {
        const [injection] = await browser.scripting.executeScript({ target: { tabId: sender.tabId, frameIds: [0] }, world: 'MAIN', func: readBannerStateInPage, args: [TCF_READ_TIMEOUT_MS] });
        state = injection?.result ?? null;
      } catch {
        state = null;
      }
      let pageLoad: number | undefined;
      await withAudit(sender.tabId, (audit) => {
        if (!audit || audit.site !== site) return audit;
        pageLoad = audit.startedAt;
        if (audit.bannerSeenAt !== undefined) return audit;
        return { ...markBanner(audit, Date.now()), tcfBefore: state?.tcf ?? null, usp: state?.usp ?? null };
      });
      return pageLoad === undefined ? { ok: false } : { ok: true, pageLoad };
    }
    let concluded = false;
    await withAudit(sender.tabId, async (audit) => {
      if (!audit || audit.site !== site || !ownFrame(sender, site) || request.pageLoad !== audit.startedAt) return audit;
      await concludeAudit(request.clicks === undefined ? audit : { ...audit, clicks: request.clicks });
      concluded = true;
      return null;
    });
    return { ok: concluded };
  }

  /**
   * After a banner frame reports that its refusal steps completed, read the top level
   * page's own TCF state and conclude from that. The frame supplies no evidence.
   *
   * Frames from another site are allowed to trigger this, deliberately: banner frames are
   * usually served from the vendor's own domain. What a hostile frame gains is a read; the
   * verdict depends only on the page's own state, the record must still be 'attempted'
   * (so an outcome from the site's own frames is never replaced), and the page must show
   * a user action completed in this page load.
   */
  async function verifyFromTopFrame(sender: TrustedSender, keys: SiteKeys): Promise<void> {
    const resolution = resolvePreferences(await repository.resolverInput(keys));
    if (resolution.paused) return;
    const plan = planWholeBannerAction(resolution.choices, resolution.sources);

    // Identify the top level document now, while the frame's report is fresh, and pin the
    // later read to it. All identity data comes from the browser, none from the page:
    // - the document id of frame 0 (an empty injection in the extension's own world);
    // - the tab address from the tabs API, checked right after taking the id and again after the read.
    // If the tab navigates at any point after this, the pinned read is refused by the browser,
    // so another document's consent state can never be written against this site.
    const tabUrl = async () => (await browser.tabs.get(sender.tabId).catch(() => null))?.url;
    const probe = await browser.scripting
      .executeScript({ target: { tabId: sender.tabId, frameIds: [0] }, func: () => true })
      .catch(() => null);
    const documentId = probe?.[0]?.documentId;
    const urlAtPin = await tabUrl();
    if (!documentId || siteKeysForUrl(urlAtPin ?? '')?.site !== keys.site) return;

    await new Promise((resolve) => setTimeout(resolve, EVIDENCE_DELAY_MS));
    const read = await readTopTcf(sender, documentId);
    const snapshot = topFrameSnapshotFor(keys.site, read, urlAtPin, await tabUrl());
    const evidence = evaluateTcf(snapshot, plan.action);
    // The page itself shows a completed user action: the frame's claim now counts for the audit too.
    if (snapshot) {
      let pageLoad: number | undefined;
      await withAudit(sender.tabId, (audit) => {
        if (!audit || audit.site !== keys.site) return audit;
        pageLoad = audit.startedAt;
        return confirmClaim(audit);
      });
      // The banner's frame is usually gone by now and cannot say when to conclude, so the
      // background does it after the watch window. Best effort: if this worker is stopped
      // first, the audit concludes when the tab navigates or closes.
      if (pageLoad !== undefined) {
        setTimeout(() => {
          void withAudit(sender.tabId, async (audit) => {
            if (!audit || audit.site !== keys.site || audit.startedAt !== pageLoad) return audit;
            await concludeAudit(audit);
            return null;
          });
        }, AFTER_WINDOW_MS + 500);
      }
    }
    await repository.updateSite(keys.site, (existing) => applyTopFrameEvidence(existing, evidence, plan, new Date()));
  }

  /**
   * Objects to legitimate interest after a refusal, through the consent tool's documented call.
   * The content script only names the tool. Run only when all of these hold:
   * - the tool has a listed objection (src/engines/objections.ts) and the browser identifies the document;
   * - the asking frame is the page itself or a frame on the page's own site;
   * - the site is not paused, and the plan for the stored choices is a refusal.
   * The call can only refuse, and its result decides nothing: verification reads the page state.
   */
  async function handleObject(sender: TrustedSender, cmp: string): Promise<EvalResponse> {
    const snippetId = objectionSnippet(cmp);
    const snippet = snippetId === null ? null : snippetById(snippetId);
    const frameKeys = siteKeysForUrl(sender.frameUrl);
    if (!snippet || !frameKeys || !sender.documentId) return { result: false };
    if (sender.frameId !== 0 && siteKeysForUrl(sender.tabUrl)?.site !== frameKeys.site) return { result: false };
    await ready;
    const resolution = resolvePreferences(await repository.resolverInput(frameKeys));
    if (resolution.paused) return { result: false };
    const offering = features.purposeLevelExecution && sender.frameId === 0 ? purposeAdapter(cmp) : null;
    if (planAction(resolution.choices, resolution.sources, offering).action !== 'optOut') return { result: false };
    try {
      const [injection] = await browser.scripting.executeScript({ target: { tabId: sender.tabId, documentIds: [sender.documentId] }, world: 'MAIN', func: snippet });
      return { result: injection?.result === true };
    } catch {
      return { result: false };
    }
  }

  /** An "accept or pay" wall seen by the site's own frame: recorded as wording only (see applyWall). */
  async function handleWall(sender: TrustedSender, cmp: string): Promise<ReportResponse> {
    const keys = siteKeysForUrl(sender.tabUrl);
    if (!keys) return { stored: false };
    await ready;
    if (repository.readOnly) return { stored: false };
    const sameSite = sender.frameId === 0 || siteKeysForUrl(sender.frameUrl)?.site === keys.site;
    let stored = false;
    await repository.updateSite(keys.site, (existing) => {
      const next = applyWall(existing, cmp, sameSite, new Date());
      stored = next !== null;
      return next;
    });
    return { stored };
  }

  async function handle(raw: unknown, sender: TrustedSender): Promise<unknown> {
    const request = parsePageRequest(raw);
    if (!request) return null;
    switch (request.type) {
      case 'page:init':
        return handleInit(sender);
      case 'page:eval':
        return handleEval(sender, request.snippetId);
      case 'page:tcf':
        return handleTcf(sender);
      case 'page:purposes':
        return handlePurposes(sender, request);
      case 'page:report':
        return handleReport(sender, request);
      case 'page:audit':
        return handleAudit(sender, request);
      case 'page:wall':
        return handleWall(sender, request.cmp);
      case 'page:object':
        return handleObject(sender, request.cmp);
    }
  }

  async function uiState(tabUrl: string | undefined): Promise<UiState> {
    const keys = tabUrl ? siteKeysForUrl(tabUrl) : null;
    const [settings, sites] = await Promise.all([repository.getSettings(), repository.listSites()]);
    const current = keys ? { domain: keys.site, record: sites.find((r) => r.domain === keys.site) ?? null } : null;
    return { settings, sites, current, readOnly: repository.readOnly };
  }

  /** Preference API for the extension's own pages. Every change goes through the repository. */
  async function handleUi(request: UiRequest): Promise<UiResponse> {
    await ready;
    const tabUrl = request.type === 'ui:state' ? request.tabUrl : undefined;
    if (request.type !== 'ui:state' && !(request.type === 'ui:refuseEverywhere' && request.dryRun) && !(request.type === 'ui:import' && request.dryRun) && repository.readOnly) {
      return { ok: false, error: 'read_only' };
    }
    try {
      switch (request.type) {
        case 'ui:state':
          return { ok: true, state: await uiState(tabUrl) };
        case 'ui:setGlobalChoice':
          await repository.setGlobalChoice(request.purpose, request.choice);
          break;
        case 'ui:setSiteChoice':
          await repository.setSiteChoice(request.domain, request.purpose, request.choice);
          break;
        case 'ui:setPaused':
          await repository.setPaused(request.domain, request.paused);
          break;
        case 'ui:setGpc':
          await repository.setGpcEnabled(request.enabled);
          break;
        case 'ui:forget': {
          const removed = await repository.forgetSites(request.domains);
          return { ok: true, state: await uiState(undefined), removed };
        }
        case 'ui:restore':
          await repository.restoreSites(request.records);
          break;
        case 'ui:refuseEverywhere': {
          const counts = await repository.refuseEverywhere(request.purposes, request.dryRun);
          return { ok: true, state: await uiState(undefined), counts };
        }
        case 'ui:import': {
          const summary = await repository.importData(request.file, request.policy, request.dryRun);
          return { ok: true, state: await uiState(undefined), summary };
        }
        case 'ui:deleteAll':
          await repository.deleteAll();
          break;
      }
      return { ok: true, state: await uiState(undefined) };
    } catch {
      return { ok: false, error: 'failed' };
    } finally {
      // Pause, import, restore, forget and delete can all change which sites are paused.
      if (request.type !== 'ui:state' && !('dryRun' in request && request.dryRun)) await applyGpc();
    }
  }

  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    if (isOwnExtensionPage(sender, browser.runtime.id)) {
      const request = parseUiRequest(raw);
      const reply: Promise<UiResponse> = request ? handleUi(request) : Promise.resolve({ ok: false, error: 'invalid_request' });
      reply.then(sendResponse, () => sendResponse({ ok: false, error: 'failed' }));
      return true;
    }
    const trusted = validateSender(sender, browser.runtime.id);
    if (!trusted) return false;
    handle(raw, trusted).then(sendResponse, () => sendResponse(null));
    return true;
  });
});
