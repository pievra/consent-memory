# Threat model

Scope: the Chromium desktop extension. Written at Milestone 0 before any code and kept up to date since; the review against it is in `security-review.md`. Method: STRIDE per trust boundary.

## 1. Assets

| ID | Asset | Why it matters |
|---|---|---|
| A1 | Consent memory (site list, choices, status, timestamps) | It is a browsing history of every site with a consent banner |
| A2 | The authority to click in pages on the user's behalf | Misuse produces unauthorised consent acceptance, the first release blocker |
| A3 | Privileged extension APIs (storage, cookies, declarativeNetRequest, webRequest, scripting) | Reach across every origin the user visits |
| A4 | Bundled rules (consent, trackers, GPC) | They decide what gets clicked |
| A5 | Audit evidence | Contains request hosts observed per site |
| A6 | Build and release pipeline | One compromised release reaches every user |
| A7 | Telemetry buffer (future, synthetic only today) | Reidentification risk |

## 2. Trust boundaries

1. Web page (untrusted) ↔ MAIN world script (runs with page privileges, fully exposed to the page).
2. MAIN world script ↔ isolated content script (`window.postMessage` / custom events).
3. Content script ↔ background (`runtime.sendMessage`).
4. Background ↔ extension pages (popup, options).
5. User supplied import file ↔ storage.
6. Build inputs (npm packages, rule files) ↔ release artefact.
7. Extension ↔ network. In this release there is **no** extension initiated network request of any kind.

## 3. Threats and controls

| # | Threat | STRIDE | Control | Verified by |
|---|---|---|---|---|
| T1 | A page builds a fake banner so that a rule clicks a control that accepts optional purposes, subscribes, purchases or submits a form | Tampering, elevation | Rules run only for a positively identified CMP; actions limited to that CMP's known reject and settings controls; never click inside `form` elements with password or payment fields; never click controls whose rule role is "accept" unless the user's stored choice for every mapped purpose is `allow`; text heuristics are never used to choose an accept control | Integration fixtures with hostile banners; e2e "no unauthorised acceptance" |
| T2 | A page forges messages to the content script to report a false "verified" state | Spoofing | MAIN world messages carry only read results; the isolated script treats them as untrusted input, validates with a schema and never upgrades status on page supplied data alone when a second evidence source exists; per page random channel name created in the isolated world | Unit tests on the verifier; fuzzed message tests |
| T2b | Content in a frame from another site (advertisement, widget) gets a CMP rule to run and its result is recorded against the top level site, marking it verified or overwriting the site's own outcome | Spoofing, tampering | The background compares the frame's site with the top level site using browser supplied sender data. A cross site frame cannot assert verified, partial or recorded (stored as inconclusive) and cannot replace an outcome from the site's own frames | Unit tests on `applyReport`; e2e frame fixture |
| T2c | A frame claims its refusal steps completed in order to get the top level site marked verified | Spoofing | The frame's claim only triggers a read; the verdict comes from the top level page's own TCF state, read by the background. The read is pinned to one document: the background takes the top frame's document id when the report arrives and injects only into that document, so the browser refuses the read if the tab has navigated, even away and back. The tab address is also checked through the browser's tabs API when the id is taken and after the read. No identity data comes from the page, which can lie about its own address and shows a user action completed in this page load; a choice loaded from an earlier visit is not accepted. A record is changed only if the frame's report was stored and it is still `attempted`. Cross site frames may trigger the read by design, because banner frames are usually served from the vendor's domain | Unit tests on `applyTopFrameEvidence` and `topFrameSnapshotFor` |
| T2d | A frame from another site reports an attempt so that, on the next page load, the site's ordinary stored state is read and presented as a verified refusal | Spoofing | Each attempt records its origin. A later recheck is allowed only for an attempt by the site's own frames, within 10 minutes, and only for the same CMP that is detected on the page | Unit tests on `resumableCmp` |
| T2e | A frame from another site sends audit events for the page: concluding the audit early, supplying a click count, or moving the line between "before" and "after" refusal | Spoofing, tampering | Every audit event is checked against the tab's current site. `finish` (which concludes and carries a click count) is accepted only from the page's own frames and only with the identifier of the same page load. A cross site frame's "refusal completed" is held as a claim: it changes the audit only if the page's own TCF state confirms a completed user action, and is otherwise dropped, with everything seen after it counted as before any refusal | Unit tests on `claimActed`, `confirmClaim`, `settleClaims`; message schema tests |
| T2f | One site's purpose choices are submitted on another site's page, or a refused purpose is switched on as a side effect of granting another | Tampering | Purpose submissions are injected only into the document that asked (browser document identifier), from a top level page, for a consent tool with an adapter; values come from stored choices for that document's site; a purpose is granted only if everything it implies is allowed; the submission is sent once | Unit tests on `planAction` and sender validation; e2e purpose tests |
| T3 | A page reads or alters extension state through the MAIN world script | Information disclosure | MAIN world code holds no user data and no extension API access; it exposes only `navigator.globalPrivacyControl` and performs read only `__tcfapi` calls | Code review; test that MAIN bundle imports nothing from `storage/` |
| T4 | Another extension or page sends messages to the background | Spoofing | No `externally_connectable`; background rejects any message whose `sender.id` is not our own, validates `sender.tab` and `sender.frameId`, and validates every payload with Zod | Unit tests on the message router |
| T5 | Web accessible resources used to fingerprint the extension or load its pages in a frame | Information disclosure | No `web_accessible_resources` unless a rule needs one; if needed, restricted by `matches` and `use_dynamic_url` | Manifest test |
| T6 | Malicious import file (oversized, prototype pollution, script in strings, unknown schema version) | Tampering, denial of service | Size cap 5 MB; `JSON.parse` then strict schema validation; unknown keys rejected; domains normalised through the public suffix library; preview and confirmation before write; the preview lists everything the file would allow (defaults, new sites, changed sites) and requires a separate tick before it can be applied; settings validated before writing; UI renders text nodes only | Unit tests with a corpus of hostile files |
| T7 | Storage corruption or quota exhaustion silently drops preferences | Denial of service | Validate on read; quarantine invalid records instead of deleting them; write then read back on migration; quota check with a user visible warning at 80% in settings; at most 4,000 site records, evicting the oldest that hold no user choice; quarantine capped at 20 entries; a frame from another site cannot create a record by containing a consent tool | Unit and persistence tests |
| T8 | Compromised or erroneous rule update turns refusal into acceptance | Tampering | Rules bundled at build time from pinned versions; no remote rules; rule diff reviewed in each dependency update; CMP fixtures rerun on every rule change | CI |
| T9 | Dependency or build pipeline compromise | Tampering | `pnpm-lock.yaml` with integrity hashes; `--frozen-lockfile` in CI; install scripts disabled by default; dependency and secret scanning; SBOM per release; artefact inspection (file list, permissions, no remote URLs in the bundle); reproducible build check | CI and release checklist |
| T10 | Dynamic code execution | Elevation | No `eval`, `new Function` or string timers; extension pages CSP `script-src 'self'; object-src 'self'`; lint rule plus bundle scan | CI |
| T11 | Extension causes harm on sensitive pages (login, checkout, payment, security challenge) | Tampering | Safety context check before any action: skip when the banner is not from an identified CMP; no cookie deletion without separate user confirmation; no reload loops (at most one verification reload per site per session, and none on pages with a non empty form); bounded retries (3) | Defined login and checkout tests |
| T12 | Over broad permissions abused after compromise | Elevation | Permission list justified one by one in `docs/store/permissions.md`; `cookies` and `webRequest` requested only when the feature that needs them ships; no permission added for telemetry | Manifest snapshot test |
| T13 | Hidden data exfiltration | Information disclosure | Zero extension initiated requests; e2e test records all requests from the extension's service worker and pages and fails on any; `connect-src 'none'` on extension pages | e2e network test |
| T14 | Telemetry endpoint abuse, reidentification | Information disclosure | Out of scope for production: only `NoopTransport` exists and no endpoint is configured. Design level controls in `docs/telemetry/privacy-design.md` | Telemetry tests on synthetic data |
| T15 | Diagnostic export leaks browsing history when shared | Information disclosure | Export is user initiated; in the diagnostic download site names are replaced by numbers, and language and time zone omitted, unless the user ticks a box. The choices export necessarily lists domains: it is the user's own backup | Unit test |
| T16 | Local attacker with access to the browser profile reads consent memory | Information disclosure | Accepted risk: the profile already holds full history and cookies. Documented in the privacy notice. No encryption claim is made | — |

## 4. Residual risks carried forward

- T1 depends on the quality of third party rules. A rule that mislabels an accept button is the most probable route to the first release blocker. Mitigation is test coverage, not design.
- MAIN world execution cannot be made tamper proof. Verification evidence obtained there is graded lower than evidence read from cookies or storage by the isolated world.
- Host access to all sites is required for the product's single purpose. Store reviewers and users will see the broadest permission warning.
