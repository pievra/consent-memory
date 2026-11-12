# Acceptance test strategy — Milestone 0

No tests exist or have been run. This document defines what will count as evidence for the quality gate in specification section 21. Results are recorded in `docs/qa/test-evidence.md`; scores in `docs/qa/quality-score.md`. A score is computed only from recorded results.

## 1. Layers

| Layer | Tool | Runs | Purpose |
|---|---|---|---|
| Static | `tsc --noEmit` (strict), ESLint, bundle scan | Every commit | Types, banned APIs (`eval`, `new Function`), no remote URLs, import boundaries |
| Unit | Vitest | Every commit | Pure logic: resolver, mappings, state machine, verifier, storage, migrations, import and export, audit classification, telemetry gate and validator |
| Integration | Vitest + Playwright against local CMP fixtures | Every commit | Engine behaviour against deterministic banners |
| End to end | Playwright, persistent Chromium context with the built extension loaded | Every commit (headless) | Installed extension behaviour, popup, options, permissions, zero network |
| Real sites | Playwright, same harness, recorded manually reviewed runs | Weekly and before release | The 30 site panel |
| Accessibility | axe through Playwright plus a manual script | Before release | WCAG 2.2 AA targets; automated result alone is not a conformance claim |
| Visual regression | Playwright screenshots | Every commit | Popup and options at 320, 375, 390, 430, 768, 1024, 1440 px, light and dark |
| Security | Dependency scan, secret scan, licence check, SBOM, manifest snapshot | Every commit and release | Threat model controls |

Import boundary rules checked statically: `core/` imports nothing from `adapters/`, `telemetry/`, `ui/`; `telemetry/` is imported by nothing in `core/` or `engines/`; MAIN world entrypoint imports nothing from `storage/`.

## 2. State machine properties (unit)

- Only the transitions in specification section 8 are reachable; an exhaustive transition table test enumerates every pair.
- `verified` requires at least one evidence item of an accepted kind (CMP API state, read only TCF data, recognised consent record). A click and a hidden banner are not evidence.
- No function maps `inconclusive`, `failed`, `unsupported` or `skipped` to a success label, in UI strings, storage or telemetry projection.
- Resolver order: paused, site choice, global choice, refusal default — tested for all 2^6 choice combinations per level by property test.
- An unmapped purpose never resolves to an accept action.

## 3. CMP fixtures (integration)

Local static pages served by the test runner, one directory per case, each with a scripted "site side" that records what the CMP stored so the test can compare it with what the extension reported.

| Fixture | Cases |
|---|---|
| Didomi, OneTrust, Cookiebot, Usercentrics, Axeptio (simulated markup and API surface; no vendor code copied unless its licence allows) | Reject all present; reject only in second layer; purpose toggles; preselected toggles |
| TCF interface | `__tcfapi` returning consent false and LI true; API absent; API slow |
| Unknown CMP | Banner with "Accept" and "Reject" buttons and no recognised signature → expect `not_detected`, zero clicks |
| Hostile | Fake banner whose "reject" control is a form submit or a purchase button → expect zero clicks |
| Iframe | CMP in a cross origin frame |
| Persistence failure | CMP forgets the choice on reload → expect not `verified` |
| Reload | Verification after one reload; assert no second reload |
| Partial | Accept all or reject all only, with mixed user preferences → expect `partial` |

Assertion on every fixture: the count of clicks on controls tagged `data-test-role="accept"` equals 0 unless the test set every purpose to `allow`.

## 4. End to end (Chromium)

Installation and onboarding; default refusal on first visit; site override; persistence across browser restart; second visit handling; GPC header present on a local echo server and `navigator.globalPrivacyControl === true`, both absent when disabled; popup statuses for each state; dashboard search, sort, filter; bulk actions with preview and undo; import and export round trip; manifest permissions equal the reviewed snapshot; **extension initiated network requests = 0**.

Login and checkout safety set: 5 local fixtures (login form with banner, basket with banner, payment form with banner, CAPTCHA style challenge with banner, single page app route change). Expected: session cookie unchanged, basket unchanged, no form submitted, no reload on a page with a filled form.

## 5. Real site panel

At least 30 sites: 10 France, 10 United Kingdom, 10 Saudi Arabia; at least 4 in each of retail, ecommerce, media, banking, travel and services. The list is proposed at Milestone 1 and stored in `tests/platforms/panel.json` with the reason for each choice. Sites are visited as an ordinary visitor: no login, no purchase, one page load plus one reload, at most once a week.

Recorded per run: browser, browser version, CMP, requested action, actual action, verification result, audit signals, breakage, rule version, date.

Counting rules:
- "Handled" = final status `verified`, or `partial` with a correct explanation, with no breakage.
- "Verified handling rate" = `verified` ÷ sites where a CMP is present. `inconclusive`, `partial`, `failed`, `unsupported` are in the denominator and not in the numerator.
- A site with no banner in the test geography is recorded as `not_detected` and excluded from the denominator, with a note.
- Geography: banners differ by visitor location. Each run records the egress country. Runs from the VPS location are not evidence for France, United Kingdom or Saudi Arabia behaviour unless the egress matches; how to obtain matching egress is an open decision.

Targets (section 21): prototype — at least 25 of 30 handled, zero unauthorised acceptance, zero login or checkout breakage. Production — at least 95% verified handling, 100% of success labels backed by evidence.

## 6. Release blockers as tests

| Blocker (section 21) | Detecting test |
|---|---|
| Unauthorised consent acceptance | Accept click counter in fixtures; panel review |
| Success without verification | Unit property on `verified`; panel evidence column non empty for every `verified` |
| Critical vulnerability | Dependency scan with zero critical or high findings unresolved; security review |
| Login or checkout breakage | Safety fixture set |
| Silent preference loss | Migration, quota and corruption tests |
| Prohibited telemetry transmitted | Zero network e2e test; payload rejection corpus |
| Telemetry activated without approval | Build scan for transports and endpoints; register state check |
| Mandatory browser tests fail | CI status |
| Licence obligations unresolved | Licence allow list check; `licence-audit.md` open items = 0 |
| Essential functionality inaccessible | Keyboard only e2e path through popup and options; axe with zero serious or critical findings; manual screen reader script |

## 7. Quality score procedure

Each of the seven dimensions is scored 0 to 10 from a written rubric in `quality-score.md` tied to counts (tests passing, panel rate, open findings by severity). Weighted total per section 21. Any open blocker sets the release decision to "blocked" regardless of the score.
