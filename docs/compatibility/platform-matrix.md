# Platform capability matrix

Status: desk assessment for every platform except Chrome and Edge on desktop, whose tested capabilities are in the verification log at the end. Cells marked "verify" must be tested on the named platform before the feature is advertised there. A platform moves to "supported" only through its own release gate (specification section 4).

Legend: Yes = documented capability, expected to work. Verify = documented or reported, behaviour differs or is uncertain. No = not available.

| Capability | Chrome / Edge desktop (Phase 1) | Firefox desktop (Phase 2) | Safari macOS (Phase 2) | Safari iOS / iPadOS (Phase 3) | Firefox Android (Phase 3) | Chrome Android / Chrome iOS |
|---|---|---|---|---|---|---|
| Extension model | Manifest V3, service worker | Manifest V3, event page (no service worker) | Web Extension inside a native app (Xcode) | Web Extension inside a native app (Xcode) | Manifest V3 subset | No extension support — not advertised |
| Content scripts, isolated world | Yes | Yes | Yes | Yes | Yes | No |
| Page (MAIN) world execution, needed for `navigator.globalPrivacyControl` and read only `__tcfapi` calls | Yes, `world: "MAIN"` | Verify (`world: "MAIN"` support and Xray wrapper behaviour) | Verify | Verify | Verify | No |
| Header modification (`Sec-GPC: 1`) through declarativeNetRequest | Yes, `modifyHeaders` with host permissions | Yes; browser also has a native GPC setting — avoid double handling | Verify (`modifyHeaders` limits) | Verify | Verify | No |
| Network observation for the audit (`webRequest`, non blocking) | Yes | Yes | Verify (reduced `webRequest` in non persistent backgrounds) | Verify | Verify | No |
| Cookie access (`cookies`) | Yes | Yes (first party isolation and container effects to verify) | Verify (ITP partitioning) | Verify | Verify | No |
| Persistent local storage (`storage.local`) | Yes, 10 MB quota without `unlimitedStorage` | Yes | Yes (quota to verify) | Yes (quota to verify) | Yes | No |
| Browser account sync (`storage.sync`) | Available — **not used** (section 9) | Available — not used | Not used | Not used | Not used | — |
| Background lifecycle | Service worker stops after about 30 s idle; all state must be persisted, no in memory session state | Event page unloads when idle | Non persistent; stops aggressively | Stops aggressively; low memory kills | Unloads; process death common | — |
| Host permissions | Granted at install; user can restrict to "on click" | Optional by default in MV3; user grants per site or all sites | Granted per site by the user, time limited option | Granted per site by the user | Optional by default | — |
| Popup UI | Yes | Yes | Yes | Yes, sheet presentation | Yes, opens as a page | — |
| Options page | Yes | Yes | Yes | Yes | Yes | — |
| Automated testing | Playwright with a persistent Chromium context | Playwright cannot load extensions in Firefox; use `web-ext` plus Selenium/geckodriver | Xcode UI tests and manual | Real devices and manual | Real devices, `web-ext run -t firefox-android` | — |

## Consequences for the design

1. **No in memory state in the background.** Every consent state transition is written to storage before the next step. This is required on all five platforms, not only mobile.
2. **Host permission may be absent.** On Firefox and Safari the user can decline all site access. The core must report `skipped` with a "no permission for this site" reason, never `failed` or `not_detected`.
3. **GPC is a per platform feature flag** in `src/config/capabilities.ts`. On Firefox the adapter reads whether native GPC is on and does not add a second header rule.
4. **Audit checks degrade by platform.** Where `webRequest` observation is unavailable, checks 1, 2 and 6 of section 11 return "inconclusive", not "passed".
5. **Chromium minimum version** is set at Milestone 1 after confirming the lowest version that supports MAIN world content scripts declared in the manifest and the 10 MB local quota. Proposed floor: the current stable minus 4 major versions, recorded here once tested.

## Verification log

| Date | Platform | Browser version | Capability | Result | Evidence |
|---|---|---|---|---|---|
| 2026-11-11 | Chrome for Testing (Linux, headless) | 156.0.8078.4 | Header modification through declarativeNetRequest (`Sec-GPC`) | Works, including frames, restart, off and per site exclusion | `tests/e2e/gpc.spec.ts`, 5 tests |
| 2026-11-11 | Chrome for Testing (Linux, headless) | 156.0.8078.4 | Page world script registered at document start | Works; readable from a page's first inline script | Same |
| 2026-11-10 | Google Chrome (macOS) | 157.0.8103.50 | Unpacked load, content scripts, storage, page world checks | Works on 5 real sites, run by a person | `docs/qa/test-evidence.md`, section C |
| 2026-11-11 | Microsoft Edge (Linux, headless, GitHub hosted runner) | 156.0.4314.58 | Whole browser suite: consent handling, verification, storage, restart, Global Privacy Control header and page signal, audit, interface | 38 of 38 passed. Not run on Windows, and not by a person | CI job `edge`, run 43067994733 |
| 2026-11-11 | Chrome for Testing (Linux, headless) | 156.0.8078.4 | Network observation (`webRequest`), welcome page on install, localised manifest | Works | `tests/e2e/audit.spec.ts`, `ui.spec.ts` |
