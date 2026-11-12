# Gap analysis against the full specification

Date: 2026-11-10. Audited: commit `937676b` plus the restored specification sections 26 to 28. Method: each numbered section of `CLAUDE.md` compared with the code, tests and documents in the repository. "Tested" means a named automated test exists and passed in `docs/qa/test-evidence.md`.

Companion documents required by section 28, already in the repository: architecture plan (`docs/qa/implementation-status.md`, `docs/architecture/`), platform compatibility assessment (`docs/compatibility/platform-matrix.md`), telemetry decision register (`docs/telemetry/decision-register.md`).

## 1. Summary

| Area | State |
|---|---|
| Milestone 0 | Delivered |
| Milestone 1 | Implemented and tested on local fixtures. **Not complete under section 27** — see section 3 |
| Milestones 2 to 9 | Not started |
| Release blockers (section 21) | 2 open: licence obligations unresolved (no project licence); mandatory browser tests not run on Chrome stable or Edge |
| Approval owed | None. `scripting` approved by the product owner on 2026-11-10 |

## 2. Prioritised gaps

Priority: P0 needs a decision or breaks a stated rule now. P1 stands between Milestone 1 and "done". P2 is scheduled work for a later milestone. P3 is a known limitation with no deadline yet.

| # | P | Spec | Gap | Evidence | Proposed resolution | Milestone |
|---|---|---|---|---|---|---|
| 1 | Closed | 26, 16 | `scripting` was added in Milestone 1 without explicit approval. The approval list was cut off at "Invasive" when the work was done; the restored text reads "Invasive permissions". With all site host access, `scripting` lets the extension run bundled functions in any page's own JavaScript world | `wxt.config.ts`; `docs/store/permissions.md` | Product owner approves or rejects. If rejected: remove the permission; CMP self tests and TCF reads stop working and every result becomes `inconclusive` until another verification route is designed | 1 |
| 2 | Closed (MPL-2.0, 2026-11-10) | 17, 21 | No project licence; repository has no `LICENSE` | `docs/legal/licence-audit.md` section 4 | Decision (recommended Apache-2.0) | Before any public release |
| 3 | Closed 2026-11-11 | 24 | Name Pievra, entity MRNIE SAS with its register details, contact contact@pievra.com, all applied | `src/config/brand.ts` | Decision | 3 (UI copy), 6 (store) |
| 4 | P1 | 20, 21 | No real website tested. Panel of 30 sites is defined and a manual test kit was prepared on 2026-11-10; not yet run. Prototype target (25 of 30 handled) unmeasured | `test-evidence.md` | Build the panel and harness; needs egress in France, the United Kingdom and Saudi Arabia | 1 to close, 6 to gate |
| 5 | P1 | 27.7, 4 | Tested only on Chrome for Testing 156. Chrome stable 157 was attempted on 2026-11-10 and cannot load an unpacked extension from the command line; Edge is not installed | `test-evidence.md` | Run the e2e suite on both; record versions in the platform matrix | 1 |
| 6 | P1 | 20 | Browser fixtures cover 2 of 5 named CMPs (OneTrust and Cookiebot style, the second added 2026-11-10). Missing: Didomi, Usercentrics, Axeptio, iframe CMP, reload behaviour | `tests/fixtures/pages/` | Add fixtures; each asserts 0 accept clicks | 1 |
| 7 | Closed | 8, 20 | Opt in path (all six purposes allowed) has unit tests only | `tests/unit/states.test.ts` | e2e test that sets six site choices in storage and asserts 1 accept click, and a second asserting 5 of 6 allowed gives 0 accept clicks | 1 |
| 8 | Closed | 3.1, 15 | "No extension initiated request" is checked statically, not by capture | `scripts/check-bundle.mjs` | e2e test recording service worker and extension page requests; expected 0 | 1 |
| 9 | Closed | 19, 14 | Service worker stop in the middle of a run is untested | Design note in `implementation-status.md` | e2e test that stops the worker between action and report | 1 |
| 10 | Closed | 21, 27.9 | No quality score. Five of seven rubric dimensions lack evidence | — | Write `docs/qa/quality-score.md` with a count based rubric once gaps 4 to 9 are closed | 1 |
| 11 | P1 | 15 | Threat T2b (cross site frame) is covered by unit tests only; no browser test reaches the code | `test-evidence.md` | Fixture using a CMP whose Autoconsent rule runs in frames | 1 |
| 12 | P1 | 3.3, 8 | Safety context is one rule (filled password or card field). No test for checkout pages, CAPTCHA pages or single page app route changes | `src/entrypoints/content.ts` | Extend rules and add the five safety fixtures from the test strategy | 1 to 2 |
| 13 | P1 | 15, 5 | No secret scanning, static analysis, SBOM or CI. `pnpm audit` and licence listing were run by hand | — | Add CI workflow, gitleaks or equivalent, CycloneDX SBOM | 1 (needs a remote) |
| 14 | P2 | 7, 2.2 | Purpose level execution absent: mixed preferences end as `partial`. Consent O Matic not integrated | `src/engines/registry.ts` | Vendor Consent O Matic rules at a pinned commit | 2 |
| 15 | Closed 2026-11-10 | 2.2, 13 | No way for a user to set a global default, a site override or pause. Storage and resolver support them; nothing calls them | `src/storage/repository.ts` | Popup and options page | 2 (logic), 3 (UI) |
| 16 | Partly closed 2026-11-10 (import, export, delete all, forget with undo built) | 9 | Retention job and quota warning at 80% not built | — | `src/storage/import-export.ts`, `retention.ts` | 2 to 3 |
| 17 | Partly closed 2026-11-10 (popup and settings in English and French, automated accessibility checks) | 13, 18 | No onboarding, no manual accessibility review, no screen reader test, design direction not formally approved, manifest name and description not localised | `src/entrypoints/popup/index.html` | Three visual concepts for approval, then build | 3 |
| 18 | Closed 2026-11-11 | 12, 2.5 | GPC not implemented. `settings.gpcEnabled` defaults to true but has no effect | `src/config/features.ts` | declarativeNetRequest rule and page world property; adds the `declarativeNetRequest` permission, which needs approval under section 26 | 4 |
| 19 | Closed 2026-11-11 (self compiled list of 65 services) | 11, 2.6 | Technical privacy audit not implemented. Tracker list source undecided (three main lists are non-commercial) | `licence-audit.md` section 2 | Decision on list source; `webRequest` permission needs approval | 4 |
| 20 | Closed 2026-11-11 (built, disabled, synthetic tests) | 10, 22 | Telemetry code absent (`src/telemetry/` does not exist). This is consistent with the register; the no-op transport, schemas and synthetic tests are Milestone 5 deliverables | `docs/telemetry/` | Build as designed, disabled | 5 |
| 21 | P2 | 23 | Release documents not yet created: `release-checklist.md`, `quality-score.md`, `security-review.md`, `privacy/data-flows.md`, `telemetry/data-dictionary.md`, `telemetry/publication-methodology.md` | `docs/` | Each with its milestone | 5 to 6 |
| 22 | P2 | 24 | No store listing, privacy policy or screenshots | — | — | 6 |
| 23 | P2 | 4 | Firefox, Safari and mobile adapters absent; platform matrix is a desk assessment | `platform-matrix.md` | — | 7 to 8 |
| 24 | Closed 2026-11-10 for TCF sites | 8 | CMPs served from a vendor frame are now verified by the background from the top page's TCF state (seen on bbc.com). Frame CMPs without TCF still stop at "applied, not confirmed" | `implementation-status.md` | Reviewed allow list of vendor frame hosts | 2 |
| 25 | P3 | 8 | A failed CMP self test is reported as `failed` although the test itself may be at fault | `content.ts` | Second evidence source per CMP | 2 |
| 26 | P3 | 6 | `src/core/policies/`, `src/core/errors/`, `src/privacy/`, `rules/` from the section 6 tree do not exist; nothing needs them yet | — | Create when first used | — |
| 27 | P3 | 17 | Autoconsent's generated rules ship inside the package data (disabled at run time) and add to bundle size | `engines/autoconsent/config.ts` | Strip at build time | 6 |
| 28 | P3 | 19 | No local diagnostic view or log | — | — | 3 |
| 29 | P3 | 5 | Browser tests need `CHROMIUM_PATH` on this host: Playwright's browser download is refused from this location | `test-evidence.md` | Run in CI elsewhere | 1 |

Added after the first real site contact (2026-11-10):

| # | P | Spec | Gap | Evidence | Proposed resolution | Milestone |
|---|---|---|---|---|---|---|
| 30 | Closed 2026-11-10 | 8, 2.2 | A run cut short by a page reload after refusal stays at `attempted` (thetrainline.com). Nothing rechecks on the next page load | Server probe | When a CMP is detected with no banner open and the record is `attempted`, run the CMP's check and conclude | 2 |
| 31 | P1 | 20 | No local fixture for a frame hosted CMP with top page verification | — | Sourcepoint style fixture with two origins | 1 |
| 32 | Closed 2026-11-10 (five site test worked) | 20 | The manual test asked too much of a non technical tester: the sheet came back blank | Tester export | Shorter test: five sites, answers typed in chat | 1 |
| 33 | P2 | 20 | A data centre visitor is blocked or shown no banner on 10 of 22 sites; server probes cannot replace a person's browser | Server probe | Panel results must come from real browsers in the three countries | 6 |

| 34 | Closed 2026-11-10 | 2.3, 8 | 180 bundled rules have a self test that only checks the banner is gone; a pass was being recorded as `verified` | Rule audit; tester run | Classify self tests; only state reading tests confirm | 1 |
| 35 | P1 | 8 | 383 of 908 rules (180 visibility only, 203 with no test) can never reach `verified` unless the site also exposes TCF | Rule audit | Second evidence source per CMP (cookie or API read) for the most common ones | 2 |
| 36 | P2 | 20 | A VPN or network level tracker blocker removes banners before the extension sees them; the tester lost three attempts to this | Tester run | State it in the test guide and, later, in user help | 3 |
| 37 | P1 | 5 | Chrome stable on macOS is now exercised by a person (5 sites); Edge and Windows are not | Tester run | Repeat on Edge | 1 |

| 38 | P2 | 20 | lemonde.fr: banner not recognised (site specific "accept or subscribe" wall) | Tester run | Leave alone by design unless a refusal control exists; confirm what the wall offers | 2 |

| 39 | P3 | 12 | GPC page property can be missing on the first page loaded as the browser starts (1 launch in 12); the header is always sent | `test-evidence.md` | None available to an extension; stated in settings | — |

## 3. Milestone 1 against the Definition of Done (section 27)

| # | Criterion | State | Basis |
|---|---|---|---|
| 1 | Required functionality implemented | Met | All eight Milestone 1 deliverables exist |
| 2 | Consent claims have appropriate verification | Met on fixtures; unmeasured on real sites | `verified` requires CMP evidence in the reducer, the message schema and the storage schema; 3 browser tests |
| 3 | Security controls tested | Partly | Tested: T1, T2, T2b (unit), T4, T7, T10, T11 (one rule), T12, T13 (static). Not tested: T3, T5 (nothing to test), T9 (no CI), T13 by capture |
| 4 | User privacy requirements met | Met for what exists | No network code; local storage only; sites without a CMP are not stored |
| 5 | Core independent of telemetry | Met trivially | No telemetry code exists |
| 6 | Accessibility requirements met | Not applicable yet | No interface |
| 7 | Relevant browsers tested | **Not met** | Chrome for Testing 156 only |
| 8 | No mandatory blockers remain | **Not met** | Browser tests on Chrome stable and Edge |
| 9 | Quality at least 8/10 | **Not met** | 4.6 / 10, `quality-score.md` |
| 10 | Documentation and release evidence complete | Partly | Evidence recorded; quality score and security review absent |

Conclusion: Milestone 1 is implemented, not complete. Open gaps for it: 4, 5, 6, 11, 12, 13. Gaps 1 and 7 to 10 were closed on 2026-11-10.

## 4. Rules checked and found satisfied

- No heuristic acceptance: heuristics, generated rules and cosmetic rules are off, pinned by a unit test; a deliberate break showed the trap fixture catches a wrong click.
- No TCF string is written; the reader registers and removes one listener.
- No cookie is read, written or deleted. No reload is triggered.
- No remote code or rules; no dynamic code execution in the bundle.
- `storage.sync` is never used.
- Telemetry register states are unchanged: collection, backend, publication and commercial use remain undecided.
- No backend, paid service or store publication exists.

## 5. Decisions needed, in order

1. ~~Approve or reject `scripting` (gap 1).~~ Approved 2026-11-10.
2. ~~Project licence (gap 2).~~ MPL-2.0, 2026-11-10.
3. ~~Private remote repository (gap 13).~~ `pievra/consent-memory`, private, CI running since 2026-11-10. Secret scanning and SBOM still open.
4. In-country egress for the real site panel (gap 4).
5. ~~Product name and legal entity~~ Pievra, MrNie (2026-11-11). Contact and registered details still open (gap 3).
6. Tracker list source (gap 19).

## 6. Update — 2026-11-11, release readiness

| # | Change |
|---|---|
| 4 | Partly closed. The panel was run once from a server (`test-evidence.md`, "Site panel"): 16 of 30 reached, 0 accepted, 5 verified. Still open: the run from ordinary browsers in the three countries |
| 5, 37 | Closed for automated tests: Microsoft Edge 156 passes all 38 browser tests in CI. Open: Windows, and a person using Edge |
| 13 | Closed: CI, credential pattern scan, CycloneDX bill of materials. Open as low items: full secret scanner, reproducible build |
| 14 | Deferred by the product owner on 2026-11-11 to the first update after release |
| 16 | Closed: 4,000 site cap, quota warning at 80%, audit retention 90 days |
| 17 | Onboarding built; manifest description localised. Open: manual accessibility review, screen reader test |
| 21, 22 | Closed: release checklist, security review, privacy policy, store listing draft. Open: screenshots, publishing the policy |
| 28 | Closed: diagnostic results page, with site names removed from its download by default |

New:

| # | P | Gap | Resolution |
|---|---|---|---|
| 40 | P2 | alrajhibank.com.sa and extra.com show banners from no recognised product; both were left open | By design. Candidates for rule contributions upstream |
| 41 | P2 | thetrainline.com: the consent tool's check and the TCF state disagree after refusal, giving "inconclusive" | Second evidence source for OneTrust (gap 35) |
| 42 | P1 | Quality score 7.55; the remaining 0.5 needs people: country panel, Windows, screen reader | See `quality-score.md` |

## 7. Update — 2026-11-11, purpose level execution

| # | Change |
|---|---|
| 14 | Closed for Cookiebot: mixed choices are executed and verified through the tool's own interface (`docs/architecture/purpose-level-execution.md`). Consent O Matic was assessed and not used: its rules assign categories by position and one save step can click an accept button. Open: adapters for other consent tools |
| 42 | Quality score 7.70. The remaining 0.3 needs people |
| 43 | P2 | 8 | Accepting everything does nothing on most consent tools. The engine's bundled rule format carries no accept steps for rules written as data (Didomi, Quantcast and most others); only the tools implemented in code (OneTrust, Cookiebot, Sourcepoint and a few more) can be accepted. A user who allows all six purposes gets no click. Since 2026-11-12 this is said plainly ("Not accepted: over to you", and a warning in the settings) instead of "applied, not confirmed"; the missing accept route itself is still open. Errs towards not accepting. Found 2026-11-11 | `node_modules/@duckduckgo/autoconsent/lib/encoding.ts` (`optIn = []`); `consent.spec.ts`, "no objection is made" | Say so in the interface, or load accept steps for the user's explicit all-purpose choice | 2 |
| 44 | P2 | 2.3 | Objection to legitimate interest exists for Didomi only. Quantcast / InMobi Choice and Sourcepoint document no call for it, so refusals there can still end "partly done". Shown on one real site on 2026-11-11: orange.fr went from partial (6 purposes) to verified in a person's browser | `src/engines/objections.ts`; `test-evidence.md` | More Didomi sites from the country panels; a documented route for the other tools if one appears | 2 |
