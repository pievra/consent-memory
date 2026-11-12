import { describe, expect, it } from 'vitest';
import { features } from '../../src/config/features';
import { GPC_RULE_ID, gpcHeaderRule, gpcScriptRegistration, excludable, sameScriptTargets, sitePatterns } from '../../src/privacy/gpc';
import { defaultSettings } from '../../src/storage/schema';

describe('Global Privacy Control', () => {
  it('is built in and on by default', () => {
    expect(features.gpc).toBe(true);
    expect(defaultSettings().gpcEnabled).toBe(true);
  });
  it('sets Sec-GPC: 1 on every request type when on, and nothing when off', () => {
    const rule = gpcHeaderRule(true, [])!;
    expect(rule.id).toBe(GPC_RULE_ID);
    expect(rule.action).toEqual({ type: 'modifyHeaders', requestHeaders: [{ header: 'Sec-GPC', operation: 'set', value: '1' }] });
    expect(rule.condition.urlFilter).toBe('*');
    expect(rule.condition.resourceTypes).toEqual(expect.arrayContaining(['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'image', 'ping']));
    expect(rule.condition.excludedRequestDomains).toBeUndefined();
    expect(gpcHeaderRule(false, [])).toBeNull();
    expect(gpcHeaderRule(false, ['a.example'])).toBeNull();
  });
  it('leaves paused sites alone: requests to them and requests made by their pages', () => {
    const rule = gpcHeaderRule(true, ['b.example', 'a.example', 'b.example'])!;
    expect(rule.condition.excludedRequestDomains).toEqual(['a.example', 'b.example']);
    expect(rule.condition.excludedInitiatorDomains).toEqual(['a.example', 'b.example']);
  });
  it('registers the page signal in the page world at document start in all frames, excluding paused sites', () => {
    const registration = gpcScriptRegistration(true, ['a.example'])!;
    expect(registration).toMatchObject({ world: 'MAIN', runAt: 'document_start', allFrames: true, persistAcrossSessions: true, matches: ['http://*/*', 'https://*/*'] });
    expect(registration.excludeMatches).toEqual(['*://a.example/*', '*://*.a.example/*']);
    expect(gpcScriptRegistration(true, []) ).not.toHaveProperty('excludeMatches');
    expect(gpcScriptRegistration(false, [])).toBeNull();
    expect(sitePatterns('shop.example.co.uk')).toEqual(['*://shop.example.co.uk/*', '*://*.shop.example.co.uk/*']);
  });
  it('recognises an existing registration that needs no change, so it is never removed and re-added', () => {
    const wanted = gpcScriptRegistration(true, ['a.example'])!;
    expect(sameScriptTargets({ matches: [...wanted.matches].reverse(), excludeMatches: [...wanted.excludeMatches!].reverse() }, wanted)).toBe(true);
    expect(sameScriptTargets({ matches: wanted.matches }, wanted)).toBe(false);
    expect(sameScriptTargets({ matches: wanted.matches, excludeMatches: [] }, gpcScriptRegistration(true, [])!)).toBe(true);
    expect(sameScriptTargets({ matches: ['https://*/*'] }, gpcScriptRegistration(true, [])!)).toBe(false);
  });
  it('leaves IPv6 literals out of exclusions, so one such paused site cannot make the browser reject the update', () => {
    expect(excludable(['[::1]', 'b.example', 'a.example', 'a.example'])).toEqual(['a.example', 'b.example']);
    expect(gpcScriptRegistration(true, ['[::1]', 'a.example'])!.excludeMatches).toEqual(['*://a.example/*', '*://*.a.example/*']);
    expect(gpcHeaderRule(true, ['[::1]'])!.condition.excludedRequestDomains).toBeUndefined();
  });
});
