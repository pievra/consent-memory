# Implementation status

Last updated: 2026-11-10. Stage: **Milestone 1 (Chromium consent core) implemented and tested on local fixtures. Not tested on any real website. Not a release candidate.** Evidence: `docs/qa/test-evidence.md`. Audit against the full specification: `docs/qa/gap-analysis.md` — Milestone 1 is implemented but not complete under section 27.

## 1. Repository inspection

| Item | Finding |
|---|---|
| Existing repository | None found locally or among the `pievra` GitHub repositories on 2026-11-10. This repository was created empty at `/root/consent-memory` (local git, branch `main`, no remote, nothing committed) |
| Existing implementation, tests, dependencies | None |
| Specification | Saved as `CLAUDE.md`, complete (28 sections). Sections 26 (end) to 28 were supplied and restored on 2026-11-10 |
| Toolchain on the build host | Node.js 22.23.4 (meets WXT 0.21.5 `>=22` and Vitest 5.1.0 `^22.12`); git 2.43.0; corepack 0.36.0; pnpm 12.18.0 through corepack |
| Tools available to the engineer | Playwright and Chrome DevTools browser tools connected; GitHub CLI authenticated; Context7 available; shadcn connector timed out (not needed: the specification sets Preact and plain CSS) |
| Branding | Decided by the product owner on 2026-11-11: product name **Pievra**, legal entity **MrNie**. Contact `contact@pievra.com` (2026-11-11). Registered details taken from the entity's published legal notice: MRNIE SAS, RCS Paris 109 701 664, 16 rue du Dragon, 75006 Paris |

## 2. Milestone 0 deliverables

| Deliverable | Document | State |
|---|---|---|
| Repository inspection | This file, section 1 | Done |
| Dependency and licence assessment | `docs/legal/licence-audit.md` | Draft; 2 decisions open |
| Browser capability matrix | `docs/compatibility/platform-matrix.md` | Desk assessment; nothing tested in a browser |
| Threat model | `docs/security/threat-model.md` | Draft |
| Consent purpose mapping | `docs/architecture/purpose-mapping.md` | Draft v1; to confirm against pinned engines |
| Storage design | `docs/architecture/storage-design.md` | Draft |
| Telemetry architecture proposal | `docs/telemetry/privacy-design.md` | Proposal |
| Telemetry decision register | `docs/telemetry/decision-register.md` | Created with the initial states |
| Acceptance test strategy | `docs/qa/acceptance-test-strategy.md` | Draft |

Documents listed in specification section 23 and not yet created (each belongs to a later milestone): `release-checklist.md`, `quality-score.md`, `test-evidence.md`, `security-review.md`, `data-flows.md`, `data-dictionary.md`, `publication-methodology.md`, `store/permissions.md`, `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`.

## 3. Findings that change the plan

1. **Tracker lists are non-commercial.** DuckDuckGo Tracker Radar, DuckDuckGo tracker-blocklists and Disconnect are CC BY-NC-SA 4.0. They cannot be bundled by a commercial publisher without a separate licence. Affects Milestone 4. See licence audit section 2.
2. **Autoconsent cannot execute mixed preferences.** It acts on the whole banner. Users who refuse everything (the default) are fully served; per purpose choices need Consent O Matic rules, which are vendored code, not an npm dependency. Milestone 1 ships Autoconsent only; purpose level execution is Milestone 2 work and carries more integration effort than the specification's milestone list suggests.
3. **Real site tests need in-country egress.** Banners differ by visitor location. The build host cannot stand in for visitors in France, the United Kingdom and Saudi Arabia.
4. **No project licence is named.** The repository stays private and without a `LICENSE` file until one is approved.

## 4. Milestone 1 — delivered

| Deliverable (specification section 25) | Where | State |
|---|---|---|
| WXT scaffold | `wxt.config.ts`, `package.json`, `pnpm-lock.yaml` | Builds for Chromium MV3, 895 kB |
| Shared consent engine | `src/core/consent/` | Browser free; lint rule blocks imports from adapters, UI, telemetry |
| Default refusal | `resolver.ts`, `mappings.ts` | Tested for every choice combination |
| Autoconsent integration | `src/engines/autoconsent/`, `src/entrypoints/` | 18.1.0, unmodified, heuristics, generated rules, cosmetic rules and prehide all off |
| Consent state machine | `states.ts`, `executor.ts` | All 121 state pairs tested |
| Verification framework | `verifier.ts`, `tcf-reader.ts` | CMP self test and read only TCF; no evidence → `inconclusive` |
| Local storage | `src/storage/` | Validated, versioned, quarantine on corruption, rollback on failed migration |
| Unit tests | `tests/unit/` | 81 passing |
| Browser tests (beyond the milestone list) | `tests/e2e/` | 7 passing |

Deviations from the Milestone 0 plan:

1. **`scripting` permission added** — see `docs/store/permissions.md`.
2. **Run state lives in the content script, not the background.** The page outlives the service worker, so a stopped worker cannot lose a run. The background holds no state between messages.
3. **Sites with no recognised CMP are not stored at all.** Consent memory is therefore not a list of every site visited.
4. **No `index:sites` key.** The site list is read by key prefix; one less thing to keep consistent.
5. **Autoconsent 18.1.0, not 18.2.0**, and typescript-eslint 8.72.1: pnpm's minimum release age guard rejects packages published in the previous 24 hours, and the guard was kept on.
6. **TypeScript 6.0.3, not 7.x**: typescript-eslint does not yet support TypeScript 7.
7. **Preact not installed**: no UI is built until Milestone 3.
8. Dependency install scripts are disabled (`allowBuilds: esbuild: false`).

Milestones 2 and 3, first version (2026-11-10): preference API in the background for the extension's own pages only; global defaults, site choices, pause; popup and settings page with Preact 11.2.0, English and French; forget with undo, bulk refusal with preview, export, import, delete everything. Not done from those milestones: purpose level execution, onboarding, retention job, localised manifest strings, manual accessibility review.

Working mode from 2026-11-10: the product owner asked for work to continue without check-ins. Pull requests are merged once CI passes. Items that specification section 26 reserves for explicit approval are still brought back: new permissions, paid services, telemetry activation, publication.

Known limitations carried forward:

- A read only results page (`results.html`) was added for manual testing ahead of Milestone 3. Its text is English only and hard coded, not yet in localisation files; it is a diagnostic view, not the product interface.
- If the browser is killed during the extension's first start after installation, the extension does nothing until the browser next starts it. Messages from the page are retried 4 times with a 4 s limit each.
- Autoconsent's reviewed rule set is about 900 CMP rules after generated and cosmetic rules are excluded; coverage on real sites is unmeasured.
- Reports from an embedded frame on another site are limited: they cannot overwrite an outcome from the site's own frames and are stored as `inconclusive` at best (added after the commit security review, 2026-11-10). Consequence: CMPs served entirely from a vendor frame (for example Sourcepoint or TrustArc style) cannot reach `verified` yet. Among same site frames, the later report wins.
- A failed self test is reported as `failed` even though the cause may be the test itself.
- The password and card field check is the only safety context rule so far.
- `retention.ts`, import and export, pause and site override **controls** (the storage and resolver support them; nothing in the UI sets them yet) belong to Milestones 2 and 3.
- CI runs on every push to `pievra/consent-memory` (private): typecheck, lint, unit tests, build, bundle inspection, audit, browser tests. No secret scanning or SBOM yet.
- No quality score is calculated: five of the seven rubric dimensions have no evidence yet.

## 5. Unresolved decisions

| # | Decision | Owner | Needed by | Recommendation |
|---|---|---|---|---|
| 1 | Approve or reject the `scripting` permission added in Milestone 1 (section 26 requires approval for invasive permissions; see `gap-analysis.md` gap 1) | Product owner | Decided | **Approved 2026-11-10** |
| 2 | Project licence | Product owner | Decided | **MPL-2.0, 2026-11-10** |
| 3 | Tracker list source | Product owner | Milestone 4 | Self-curated list for the first release |
| 4 | Product name, contact, legal entity | Product owner | Partly decided | **Name: Pievra. Entity: MrNie (2026-11-11).** Contact, registered name and address still needed for the store |
| 5 | Remote repository (`pievra/consent-memory`, private until licence chosen) | Product owner | Milestone 1 | Create private |
| 6 | In-country egress for the real site panel | Product owner | Milestone 6 | — |
| 7 | Visual direction for popup and options (three concepts to be proposed) | Product owner | Milestone 3 | — |
| 8 | Purpose mapping open points (TCF purpose 10; OneTrust C0005) | Engineering, confirmed by product owner | Milestone 2 | As drafted |

## 6. Quality score

7.55 / 10 on 2026-11-11. See `quality-score.md`; release state in `release-checklist.md`.
