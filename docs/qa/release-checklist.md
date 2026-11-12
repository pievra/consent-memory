# Release checklist — version 0.1.0, Chrome Web Store

State on 2026-11-11. A line is ticked only when the named evidence exists. "Owner" means the product owner must act or approve; nothing on those lines is done on their behalf.

## A. Mandatory blockers (specification section 21) — any open line blocks release

| # | Blocker | State | Evidence |
|---|---|---|---|
| 1 | No unauthorised consent acceptance | Clear | 0 accept clicks in every refusal scenario (20 browser tests), on the 30 site run and on a person's 5 site run |
| 2 | No success claimed without verification | Clear | `verified` requires stored-state evidence in the reducer, message schema and storage schema; visibility-only rules excluded |
| 3 | No prohibited telemetry | Clear | No telemetry code in the package; lint rule; bundle scan; capture test with 0 extension requests |
| 4 | No silent loss of preferences | Clear | Validation on read with quarantine; migration backup; storage cap never evicts a user's choice; warning at 80% |
| 5 | Licence obligations met | Clear | MPL-2.0; `THIRD_PARTY_NOTICES.md`; `docs/legal/licence-audit.md` |
| 6 | Mandatory browser tests run | Clear, with a stated limit | Chrome: automated suite on Chrome for Testing 156 and Chromium in CI; one person, 5 sites, Chrome 157 on macOS. Edge 156: all 38 browser tests pass in CI on Linux. Limit: neither browser has been run on Windows, and Edge has not been used by a person |
| 7 | Quality score at least 8 | **Open: 7.70** | `quality-score.md` |

### Owner's decision on blocker 7 — 2026-11-12

The owner instructed publication as **unlisted** on the Chrome Web Store, to use the first 20 to 50 installers as the testers the score still needs. The score is 7.70 and the gate of 8 is therefore not met for this release; this is recorded as a decision, not as the gate being passed. An unlisted item is reachable by link only. The public listing remains blocked until the score reaches 8 with evidence from those testers.

## B. Build and package

| # | Item | State |
|---|---|---|
| 1 | Types, lint, 209 unit tests, 55 browser tests pass in CI | Done |
| 2 | Bundle inspection: reviewed permissions only, no network or dynamic code APIs, localised description within 132 characters | Done |
| 3 | Dependency audit: 0 high, 0 critical | Done |
| 4 | Credential pattern scan of tracked files | Done (pattern check, not a full scanner) |
| 5 | Software bill of materials (CycloneDX) produced by CI | Done: 5 shipped components |
| 6 | Version number set for release (currently 0.1.0) and change log dated | To do at release |
| 7 | Package built by CI from the tagged commit, not from a workstation | To do at release |
| 8 | Icon at 16, 32, 48, 128 | Done: Pievra mark in the website’s orange, replaced on the owner’s request 2026-11-11 |

## C. Documents

| # | Item | State |
|---|---|---|
| 1 | Privacy policy, English and French | Written (`docs/privacy/`). **Owner:** publish at a public address; legal read of the French text |
| 2 | Store listing text, single purpose, permission justifications, data disclosures | Final for 0.1.0 (`docs/store/listing.md`) |
| 3 | Screenshots 1280 × 800 | Done: 5, plus the 440 × 280 tile (`scripts/make-store-assets.mjs`) |
| 4 | Security review | Done (`docs/security/security-review.md`); reviewers were AI systems, no human security review |
| 5 | Threat model, data flows, permissions, audit methodology, telemetry register | Done |

## D. Decisions and actions only the owner can take

| # | Item | Why |
|---|---|---|
| 1 | Approve publication to the Chrome Web Store | Specification section 26 |
| 2 | Chrome Web Store developer account in the publisher's name (one-off registration fee charged by Google) | A paid service; the account must belong to the publisher |
| 3 | Make the source repository public, or decide where the source is offered | The privacy policy and listing say the code can be checked; MPL-2.0 requires source to be available to recipients |
| 4 | Run, or have run, the panel from ordinary browsers in France, the United Kingdom and Saudi Arabia | 14 of 30 sites refuse the server used here |
| 5 | A short test in Microsoft Edge or Chrome on Windows by a person | The automated Edge run was on Linux |
| 6 | Confirm the two permissions added on a general instruction (`declarativeNetRequestWithHostAccess`, `webRequest`) | Recorded in `docs/store/permissions.md` as not separately approved |

## E. Not in this release, by decision

- Per-purpose execution on consent tools other than Cookiebot. Elsewhere a mixed choice is applied as a refusal of everything and reported as such. Consent-O-Matic rules were assessed and not used (`docs/architecture/purpose-level-execution.md`).
- Telemetry collection, backend, publication, commercial use: undecided, therefore off.
- Firefox, Safari, mobile.
