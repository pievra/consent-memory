import { browser } from 'wxt/browser';
import { GPC_RULE_ID, GPC_SCRIPT_ID, gpcHeaderRule, gpcScriptRegistration, sameScriptTargets } from '../../privacy/gpc';

/**
 * Makes the browser's state match the settings. Both the header rule and the script
 * registration are stored by the browser and survive restarts and service worker stops,
 * so this only needs to run at start-up and after a relevant change.
 */
export async function syncGpc(enabled: boolean, pausedDomains: readonly string[]): Promise<void> {
  const rule = gpcHeaderRule(enabled, pausedDomains);
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [GPC_RULE_ID],
    addRules: rule ? [rule as unknown as chrome.declarativeNetRequest.Rule] : [],
  });

  // Never remove a registration that is already right: between removing and re-adding it,
  // a page that loads would get the header without the page signal. That window used to
  // open on every browser start. An existing registration is changed in place.
  const registration = gpcScriptRegistration(enabled, pausedDomains);
  const [existing] = await browser.scripting.getRegisteredContentScripts({ ids: [GPC_SCRIPT_ID] });
  if (!registration) {
    if (existing) await browser.scripting.unregisterContentScripts({ ids: [GPC_SCRIPT_ID] });
  } else if (!existing) {
    await browser.scripting.registerContentScripts([registration]);
  } else if (!sameScriptTargets(existing, registration)) {
    await browser.scripting.updateContentScripts([{ ...registration, excludeMatches: registration.excludeMatches ?? [] }]);
  }
}
