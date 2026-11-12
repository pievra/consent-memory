# Test evidence

## Milestone 1 — 2026-11-10

CI: every push to `pievra/consent-memory` runs the same checks on GitHub's Ubuntu runner with Playwright's own Chromium.

Host: Linux, Node.js 22.23.4, pnpm 12.18.0. Browser: Chrome for Testing 156.0.8078.4, headless, unpacked extension loaded from `.output/chrome-mv3`. All commands were run from a clean install of `pnpm-lock.yaml`.

| Check | Command | Result |
|---|---|---|
| Types (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | `pnpm typecheck` | 0 errors |
| Lint, banned APIs, import boundaries | `pnpm lint` | 0 errors |
| Unit tests | `pnpm test` | 198 passed, 0 failed, 9 files (27 on the disabled telemetry design, synthetic data only) |
| Build | `pnpm build` | 895.4 kB unpacked, 240 kB zipped (target below 2,048 kB) |
| Bundle inspection | `pnpm check:bundle` | Pass: permissions equal the reviewed list; 0 occurrences of `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `eval(`, `new Function`, `storage.sync` |
| Browser tests | `CHROMIUM_PATH=… pnpm test:e2e` | 47 passed, 0 failed (17 consent, 10 interface, 5 Global Privacy Control, 6 technical audit, 9 purpose level), on Chrome for Testing 156 and on Microsoft Edge 156 in CI |
| Dependency audit | `pnpm audit` | 1 moderate (minimatch, via `wxt > eslint`, development only, not shipped); 0 high, 0 critical |
| Licences from lockfile | `pnpm licenses list` | Shipped: MPL-2.0 × 1, MIT × 3. All packages: MIT 176, Apache-2.0 18, ISC 14, BSD-2-Clause 14, BSD-3-Clause 4, MPL-2.0 3, BlueOak-1.0.0 1 (minimatch, development only) |

### Browser tests (local fixtures, simulated OneTrust markup)

| # | Scenario | Asserted |
|---|---|---|
| 1 | Recognised CMP, default preferences | 1 reject click, 0 accept clicks; record `verified` with self test evidence; all six purposes `refuse` |
| 2 | CMP hides the banner but keeps optional groups active | Banner gone, status `failed`, no `lastVerified` |
| 3 | TCF API reports legitimate interest after refusal | Status `partial`, evidence line names 4 purposes |
| 4 | Unrecognised banner whose "Reject all" submits a purchase form | 0 clicks of any kind, form not submitted, no site record written |
| 5 | Recognised CMP on a page with a filled password field | Status `skipped` (`unsafe_context`), 0 clicks, field value unchanged, no form submitted |
| 6 | Browser restart, second visit, banner no longer shown | Record identical before and after |
| 7 | Recognised banner inside a frame from another site | 0 clicks in the frame, no site record written |
| 9 | Cookiebot style CMP (detection and check through the page API) | 1 reject click, 0 accept; `verified`; page API shows declined |
| 10 | All six purposes allowed by the user | 1 accept click, 0 reject; status `inconclusive`, never `verified`; user choices unchanged |
| 11 | Five of six purposes allowed | 0 accept clicks, 1 reject; status `partial`; five purposes listed as unfulfilled |
| 12 | Paused site | 0 clicks, banner still visible, record unchanged |
| 13 | Network capture during a full run and with the popup open | 0 requests initiated by the extension; fixture server saw only the page |
| 14 | Service worker terminated before the visit and three more times during the run | Run completes; `verified`; 1 reject click. Repeated 40 times, 40 passed |
| 15 | Results page (diagnostic, for manual testing) | Lists the handled site with its result; download produces a JSON file with that site; storage unchanged afterwards |
| 16 | CMP whose rule can only see that the banner closed | 1 reject click; `inconclusive`, never `verified`; evidence line says nothing could be read |
| 17 | Site reloads itself after the refusal | First run is cut short; on the reloaded page the stored result is checked with 0 clicks; `verified` |
| 8 | Granted permissions | `scripting`, `storage`, `http://*/*`, `https://*/*`; `storage.sync` empty |

Deliberate break check: with Autoconsent heuristics switched on (`heuristicMode: 'reject'`), test 4 fails — the engine clicks the trap button and the purchase form is submitted. The shipped configuration keeps heuristics off; a unit test pins that.

## Interface (Milestones 2 and 3, first version) — 2026-11-10

Popup and settings page, English and French. Browser tests in `tests/e2e/ui.spec.ts`:

| # | Scenario | Asserted |
|---|---|---|
| U1 | Popup over a handled site | Site name, verified result and its evidence in plain language; setting and clearing a site choice writes exactly that choice and leaves the result untouched; pause and resume |
| U2 | Keyboard only | A purpose is changed with arrow keys and stored |
| U3 | Popup over a non website page | Explains itself, shows no controls |
| U4 | Settings | Change a default; search; filter; open details; forget with undo restores the identical record; bulk refusal shows counts first and writes nothing until confirmed |
| U5 | Export, delete everything, import | Export holds choices only; import restores choices and pause; an imported site has no result; an invalid file is refused |
| U6 | French at 360 px | Page language set, French text, no sideways overflow |
| U7 | Access | A web page has no route to the preference API |

Automated accessibility (axe-core, WCAG 2.0 to 2.2 A and AA rules): 0 serious or critical findings on the popup and settings page, in English at desktop width and French at 360 px. This is a scanner result, not a conformance claim; no screen reader or manual review has been done.

Screens inspected by eye at 320, 360, 380, 390, 768, 1280 and 1440 px, light and dark, both languages: no overflow. Two defects found and fixed (French popup 92 px too wide at 360 px; cramped popup buttons).

Limits of this version of the interface:
- A changed choice takes effect the next time the site shows its banner. The extension does not reopen a banner that has already been answered.
- Mixed choices are still executed as a refusal of everything and reported as partly done (no purpose level execution yet).
- The visual style continues the results page already in the product; three alternative directions were not prepared.
- No user has tried it.

## Global Privacy Control — 2026-11-11

Chrome for Testing 156, local server recording the `Sec-GPC` header of every request (`tests/e2e/gpc.spec.ts`).

| # | Scenario | Asserted |
|---|---|---|
| G1 | Default state | Header `1` on the page request, on a fetch and on an image the page loads; `navigator.globalPrivacyControl === true` already in the page's first inline script; same after navigating to a second site |
| G2 | Frame from another site | Header on the frame's request; signal readable inside the frame |
| G3 | Switched off in settings, then on again | Off: no header, property undefined. On: both back. No browser restart needed |
| G4 | Paused site | No header to it, none on its own requests, no signal; another site still receives both |
| G5 | Browser closed and reopened | Header on every page from the first; page signal appears within ten seconds of launch and is never missing afterwards |

Defect found by CI after merge and fixed (2026-11-11): at every browser start the page signal registration was removed and re-added, and a page loading in that instant received the header without the signal (1 failure in about 8 runs). The registration is now left alone when already correct and changed in place otherwise. That removed the gap the extension itself caused.

Known limit that remains (measured 2026-11-11, 12 launches, 6 immediate pages each): the first page loaded within about 0.4 s of the browser starting had the header but not `navigator.globalPrivacyControl` in 1 launch of 12; pages 2 to 6 had both in 12 of 12. Chrome restores registered scripts shortly after launch and the extension cannot make it sooner. The header, which is what a server reads, was present on 72 of 72 pages. On GitHub's slower runner the second page was also loaded before the registration was restored (seen once), so the limit is "the first moments after the browser starts", not strictly the first page; the test asserts exactly that.

Not tested: Chrome stable, Edge, a browser with native GPC support, service workers and other worker contexts (the page signal is defined on `Navigator`, not `WorkerNavigator`).

## Technical audit — 2026-11-11

`tests/e2e/audit.spec.ts`, Chrome for Testing 156, a test only tracking host on the bundled list.

| # | Scenario | Asserted |
|---|---|---|
| A1 | Page contacts nothing | Before and after: passed. Refusal: 1 step. No readable consent state: inconclusive, not passed |
| A2 | Tracker contacted before the answer | Signal with the service name; stored record contains no URL, path or query |
| A3 | Tracker contacted after the refusal | Signal with the service name; the consent result is still `verified` (two separate facts) |
| A4 | Purposes consented while the banner is unanswered | Signal with the count, read from the page's TCF state |
| A5 | Site without a known banner that contacts a tracker | Nothing recorded |
| A6 | Display | Summary line, per check sentence, disclaimer, no words such as "compliant" or "illegal"; English and French |

Methodology and real site illustration: `docs/methodology/audit.md`.

Security review after the first push (2026-11-11) raised two points, both fixed before merge: audit events are now checked against the tab's current site; `finish` is accepted only from the page's own frames and only for the same page load; a banner frame from another site can only claim that the refusal completed, and the claim counts only once the page's own state confirms it. On bbc.com (banner served from another domain) the audit is still produced: before consent passed, after refusal 7 services.

## Purpose level execution — 2026-11-11

9 browser tests on a simulated Cookiebot page (`tests/e2e/purposes.spec.ts`): exact submission with 0 clicks and verification from stored state; a purpose the tool does not offer; a refused purpose the tool keeps on (failed, never verified); an allowed purpose the tool drops (partial); missing interface (fallback refusal); storage refused (nothing granted); five of six allowed (0 accept clicks); a tab that moves to another site (nothing submitted there). Real sites: 3 Cookiebot sites, 5 runs, each matching the site's own stored cookie; table in `docs/architecture/purpose-level-execution.md`.

## Site panel, run from this server — 2026-11-11

Method: `scripts/run-panel.mjs` on the 30 sites of `tests/platforms/panel.json`. Chrome for Testing 156.0.8078.4, headless, a fresh profile per site, a data centre address in Germany, browser language en-GB. Each site was visited once without the extension (to see what this visitor is offered), then once with it plus one reload. Nothing was clicked by the script. The build was `000d521` (before the changes of this branch, none of which alter banner handling). Raw output: `tests/platforms/panel-run-2026-11-11-server.json`. Screenshots were read by a separate reviewer and classified by what is visible.

**What this run is and is not.** It is the panel executed once from one place that many sites treat as a robot. It is not the panel result the specification asks for, which needs ordinary browsers in France, the United Kingdom and Saudi Arabia.

| Group | Sites | Count |
|---|---|---:|
| Refused to serve this visitor (HTTP 403 or 500, timeout, queue page, security check) | fnac, cdiscount, leboncoin, sncf-connect, airfrance, bnpparibas, tesco, argos, asos, britishairways, noon, saudia, stc, okaz | 14 |
| Reached, no banner offered to this visitor | lefigaro, orange, doctolib, almosafer, alahli, arabnews | 6 |
| Reached, "accept or pay" wall with no free refusal | lemonde, theguardian | 2 |
| Reached, banner offered with a way to refuse or set preferences | bbc, thetrainline, barclays, hsbc, bt, jarir, alrajhibank, extra | 8 |

Outcome on the 8 sites with a banner to answer:

| Site | Banner product | Result | Evidence | After reload |
|---|---|---|---|---|
| bbc.co.uk | Sourcepoint (frame) | Verified | Page's TCF state: consent and legitimate interest refused for all purposes | Verified, no banner |
| barclays.co.uk | Tealium | Verified | Consent tool reports the refusal stored | Verified |
| hsbc.co.uk | Tealium | Verified | Same | Verified |
| bt.com | OneTrust | Verified | Same | Verified |
| jarir.com | consentmanager.net | Verified | Same | Verified |
| thetrainline.com | OneTrust | Inconclusive | Banner closed after 1 click; TCF shows consent refused with legitimate interest still declared for 6 purposes; the tool's own check does not report the refusal stored. The two sources disagree, so no success is claimed | Inconclusive, no banner |
| alrajhibank.com.sa | Not recognised (no known product found in the page) | Not handled | Banner with "Reject All Cookies" stayed open | Still open |
| extra.com | Site's own banner ("Allow cookies", "Cookie Preferences") | Not handled | Banner stayed open | — |

| Measure | Value |
|---|---:|
| Accept clicks, all 30 sites | 0 |
| Sites where the extension acted | 6 |
| Acted and verified | 5 of 6 |
| Banners with a refusal route that were answered | 6 of 8 |
| "Accept or pay" walls left alone, as designed | 2 of 2 |
| Sites with no banner where something was wrongly recorded as an outcome | 0 of 6 (3 recorded "consent tool present, no banner open"; 3 recorded nothing) |
| Sites visibly broken with the extension compared with without | 0 observed on the 16 reached. extra.com showed an empty content area after the reload; its banner had not been touched, and the cause was not established |
| Specification target "25 of 30 handled" | **Not measurable from here**: 14 of 30 did not serve the page |

Audit output on the 6 handled sites: listed tracking services contacted before the answer on 3 (bbc 1, thetrainline 4, jarir 4) and after refusal on 3 (bbc 7, thetrainline 4, bt 1); barclays and hsbc showed none in either window. One visit from one address: an illustration of the feature, not a finding about these sites.

## One person, United Kingdom, 13 sites — 2026-11-11

Google Chrome 157 on macOS, home connection in the United Kingdom, VPN off, extension loaded unpacked (build before the "accept or pay" wording). Results file: `tests/platforms/person-run-2026-11-11-uk.json` (site names removed by the export; the tester also sent the settings list, from which the sites below are named). The tester had set two defaults to allow (storage and access, preferences), so on every banner that can only be answered as a whole the run refused everything and reported "partly done".

| Outcome | Count | Sites | What the evidence says |
|---|---|---|---|
| Verified | 2 | bbc.co.uk; similarweb.com | BBC: the consent tool reports the refusal stored. Similarweb (Cookiebot): each of 3 purposes read back as chosen, the first per purpose result from a person's browser |
| Partial only because of the tester's two allowed purposes | 2 | sainsburys.co.uk (OneTrust); one of sky.com and thetimes.com (Sourcepoint) | Refusal fully confirmed by the tool and by the page's consent state (consent and legitimate interest refused for all purposes). With refuse-all defaults these would be verified |
| Partial: consent refused, legitimate interest still declared | 4 | express.co.uk and mirror.co.uk (Quantcast, 6 purposes each); orange.fr (Didomi, 6); the other of sky.com and thetimes.com (Sourcepoint, 5) | The refusal the banner offers does not object to legitimate interest. Reported as partial, as designed |
| Attempted, not confirmed | 1 | tesco.com (own banner) | Refusal steps ran; this banner gives no way to read what was stored |
| Left alone | 4 | theguardian.com, thesun.co.uk, independent.co.uk (Sourcepoint), lefigaro.fr (AppConsent) | "Accept or pay" walls, per the tester. Nothing clicked, no attempt recorded |

Accept actions: none recorded on any of the 13. Of the 9 sites with a free refusal, 9 were answered; 2 verified, 6 partial, 1 unconfirmed; 4 of those 9 would be verified under refuse-all defaults (the 2 verified and the 2 in the second row).

Audit output on 7 audited sites: listed tracking services contacted before any answer on 6 (1 to 8 services) and after the refusal on 5 (2 to 10 services; the largest, a Quantcast site, 10 services in 13 requests). One visit each from one browser: an illustration, not a finding about these sites.

What this run changes and does not change: it is the first run from an ordinary browser in one of the three target countries, and it reached 3 sites the server could not (tesco, sainsburys, and the pay walls as a UK visitor sees them). It is one person, 13 sites, one country, and not the specified 30 site panel, so the quality score is unchanged at 7.70.

Found by this run:
1. "No banner open" was shown over an "accept or pay" wall. Fixed the same day for Sourcepoint walls (pull request 15).
2. Four of nine refusals leave legitimate interest declared. Not a defect in reporting; a limit of the refusal route used. Didomi and Quantcast expose ways to object as well, which is not built.

## Objection to legitimate interest on a real site — 2026-11-11

Same person and browser as the 13 site run, later the same day, build `6633d1f`, defaults back to refuse everything, orange.fr cookies cleared so the banner showed again.

| | Status | Evidence lines |
|---|---|---|
| Before (build without the objection) | Partial | consent tool reports the refusal as stored; TCF: consent refused, legitimate interest still declared for 6 purposes |
| After (build with the objection) | Verified | consent tool reports the refusal as stored; TCF: consent and legitimate interest refused for all purposes |

Source: the popup text sent by the tester; no results file for the second visit. One site, one visit each way. The earlier visit also had two purposes allowed by default, which affects the status but not the legitimate interest line, so the change in that line is attributed to the objection call.

The tester also confirmed by eye that the mark on the toolbar button displays as intended in Chrome 157 on macOS.

## First contact with real websites — 2026-11-10 (exploratory, not the panel result)

Two sources. Neither is a handling rate.

**A. Tester export, first attempts.** Google Chrome 157 on macOS, United Kingdom, extension loaded unpacked. One site recorded: `lefigaro.fr`, AppConsent, `detected`. Later explained: the tester's VPN was stripping cookie banners, so there was nothing to act on (see C). This did show the extension loads and runs in Chrome stable.

**B. Server probe.** Chrome for Testing 156, headless, data centre address in Germany, 22 panel sites, one visit each, no interaction.

| Outcome | Sites |
|---|---|
| `verified`, banner gone | bt.com (OneTrust), barclays.co.uk and hsbc.co.uk (Tealium), jarir.com (consentmanager.net), bbc.com (Sourcepoint, verified from the page's consent state: event `useractioncomplete`, 0 purposes consented, legitimate interest 1 → 0) |
| Left alone, correctly | theguardian.com — "consent or pay" wall; the engine's frame rule declines to act and the wall stays |
| `detected`, no banner shown to this visitor even without the extension | lefigaro.fr, orange.fr, doctolib.fr |
| `attempted`, not concluded | thetrainline.com (OneTrust; banner gone; probably a page reload after refusal ended the run) |
| Nothing recognised | lemonde.fr, britishairways.com, sncf-connect.com, leboncoin.fr, arabnews.com, saudia.com |
| Blocked for this visitor (bot or location wall) | tesco.com, argos.co.uk, asos.com, cdiscount.com, stc.com.sa, fnac.com (maintenance page), airfrance.fr (timeout) |

No accept action was observed on any site. Limits: a headless data centre visitor is treated differently from a person (7 of 22 sites refused it outright, and 3 showed it no banner), so these results do not predict what a user in France, the United Kingdom or Saudi Arabia will see.

Changes made because of this run:

1. **`sourcepoint-top` rule disabled.** It is not flagged cosmetic but hides the Sourcepoint banner in the top page whether or not a refusal was recorded, including on "consent or pay" walls. That conflicts with "never hide a banner without a recorded choice".
2. **Verification from the top page after a banner frame acts.** Sourcepoint style banners live in a frame that disappears when the choice is made, so the frame's own run cannot finish. The frame now reports that its steps completed, and the background reads the page's own consent state and concludes from that. The frame supplies no evidence. Covered by 3 unit tests and the bbc.com observation; no local fixture yet.
3. Result `attempted` is shown as "Applied, not confirmed".

Tried and reverted: switching on the engine's popup mutation observer. It did not change any outcome and is off in the engine's own defaults.

**C. Tester run in a real browser — first usable result.** Google Chrome 157 on macOS, United Kingdom, five sites, extension build `9f6d6ee`. Earlier attempts recorded nothing because the tester's VPN (NordVPN with its tracker blocking) removed every cookie banner before the browser saw it; with that out of the way:

| Site | Rule | Result | Evidence |
|---|---|---|---|
| bbc.co.uk | bbc.com | `verified` | Self test reads the cookie `ckns_explicit=1` |
| orange.fr | didomi | `partial` | CMP reports the refusal stored; TCF: consent refused, legitimate interest still declared for 6 purposes |
| tesco.com | tesco | `attempted` | None. Run did not conclude (rule has a cookie check; the page probably reloaded) |
| lefigaro.fr | AppConsent | `attempted` | None. Rule's self test only checks that the banner is gone |
| lemonde.fr | — | no record | Not recognised |

Tester's observation: the banner disappeared on bbc.co.uk, orange.fr, tesco.com and lefigaro.fr, and stayed on lemonde.fr. Whether each page worked normally afterwards was not reported.

Counted by the rules in the test guide: **2 of 5 handled** (bbc.co.uk verified; orange.fr partial with a correct explanation). On tesco.com and lefigaro.fr the banner went away but nothing confirmed what was stored, so they are not counted. lemonde.fr was not handled. 0 of 5 had cookies accepted. Five sites from one location is not a rate; no `verified` result here rests on banner visibility.

Changes made because of this run:

4. **Self tests are now classified.** Of the 908 hand written rules in use, 525 have a self test that reads stored consent state (a cookie or the CMP's API), 180 have one that only checks the banner is no longer visible, and 203 have none. Until now a passing test of the second kind produced `verified`. That contradicts "do not report success merely because a banner disappeared". Such a result is now recorded as "banner closed; nothing could be read" and ends `inconclusive`. The list of state reading tests is generated from the installed rules (`scripts/gen-state-tests.mjs`) and a unit test fails if it drifts after an engine upgrade. The background also refuses any report that claims confirmation for a rule without a state reading test.
5. **Result checked on the next page load.** When a run acted and was cut short (sites that reload after a choice), and the CMP is present with no banner on the next load within 10 minutes, the CMP's state reading test is run with no clicks and the record concluded.

No earlier recorded `verified` is known to be wrong: every fixture and real site result marked verified so far used a state reading test (OneTrust, Cookiebot, Tealium, consentmanager.net, bbc.com) or the page's TCF state.

### Not covered by this evidence

- Worker termination: earlier intermittent failures of test 14 (about 1 run in 10) were traced by instrumentation to the test itself. It stopped the worker during its first ever start after installation, before Chrome had recorded that the worker listens for messages; Chrome then never woke it, and the extension did nothing on that page (no click, no record). The test now waits for first start. After that change it passed 40 of 40 repeats. The same window exists for a real user only if the browser is killed in the first moments after installation; the worker starts again with the browser. Message retries (4 attempts, 4 s limit each, empty answers treated as failures) were added while investigating and are kept as a defence, but they were not the cause.
- The limit on what a cross site frame may report (threat T2b) is covered by unit tests only: the one CMP with a browser fixture runs in the top frame only, so no browser test reaches that code path.
- **No real website has been tested.** The 30 site panel is defined (`tests/platforms/panel.json`) and a manual test kit exists (`docs/qa/manual-test-guide.md`); it has not been run. No handling rate is claimed.
- Two CMP families (OneTrust style, Cookiebot style) are exercised in a browser. Didomi, Usercentrics, Axeptio, iframe CMPs and reload behaviour have no fixture yet.
- An opt in is executed and tested, but no evidence source can confirm it, so it always ends `inconclusive`.
- The network capture relies on Playwright reporting service worker requests; it has not been proven against a deliberately added request. The bundle scan is the second check.
- Playwright's own Chromium build (v158) could not be downloaded from this host (HTTP 403, service not available in this location). Tests ran on the Chrome for Testing 156 build already installed.
- **Chrome stable: attempted, not possible by this method.** Google Chrome 157.0.8103.50 is installed, but branded Chrome ignores the command line flag that loads an unpacked extension, so the extension never started. It needs a manual load or a packed install. **Edge: not installed, not tested.** Any other browser: not tested.
- Accessibility, visual regression: nothing to test yet (placeholder popup).
