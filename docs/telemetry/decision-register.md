# Telemetry decision register

This register is the single record of what is authorised. A state changes only on explicit, written approval from the product owner, recorded in the log below with the date, the approver and a reference. Code, tests and documentation must not assume any state other than the one shown here.

## Current states

| Decision | State | Since | Basis |
|---|---|---|---|
| Telemetry architecture | Approved | 2026-11-10 | Specification section 10.2, Decision A |
| Synthetic telemetry tests | Approved | 2026-11-10 | Specification section 10.2, Decision A |
| Production telemetry collection | Undecided | 2026-11-10 | Specification section 10.2, Decision B |
| Telemetry backend deployment | Undecided | 2026-11-10 | Specification section 15 |
| Public aggregate reporting | Undecided | 2026-11-10 | Specification section 10.2, Decision C |
| Commercial intelligence use | Undecided | 2026-11-10 | Specification section 10.10 |

"Undecided" is treated as "not authorised" everywhere in the product.

## What the current states permit

- Types, schemas, a transport interface and `NoopTransport`.
- Local aggregation logic exercised only with synthetic fixtures in tests.
- A settings area that is hidden or labelled unavailable.
- Design documents.

## What the current states forbid

- Any network request carrying telemetry, to any host, including test or staging hosts, from a build that can be installed by a user.
- Any configured endpoint, API key or token.
- Any enrolment or opt in prompt shown to users.
- Buffering real user events for later transmission (section 10.3: no retroactive collection).
- Any published statistic derived from users.

## Activation gate (Decision B) — all ten required

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Approved data inventory | Not started | — |
| 2 | Approved processing purposes | Not started | — |
| 3 | Legal basis review | Not started | — |
| 4 | Consent experience review | Not started | — |
| 5 | Privacy policy update | Not started | — |
| 6 | Security and privacy impact assessment | Not started | — |
| 7 | Data retention policy | Not started | — |
| 8 | Infrastructure approval | Not started | — |
| 9 | Browser store policy review | Not started | — |
| 10 | Explicit product owner approval | Not given | — |

## Publication gate (Decision C) — all seven required

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Approved methodology | Not started | — |
| 2 | Disclosure control assessment | Not started | — |
| 3 | Representativeness review | Not started | — |
| 4 | Sample size and uncertainty disclosure | Not started | — |
| 5 | Legal wording review | Not started | — |
| 6 | Editorial independence review | Not started | — |
| 7 | Human publishing approval | Not given | — |

Collection approval does not grant publication approval. Publication approval does not authorise additional collection.

## Change log

| Date | Decision | From | To | Approved by | Reference |
|---|---|---|---|---|---|
| 2026-11-10 | Register created with the initial states from specification section 22 | — | — | Specification | `CLAUDE.md` section 22 |
| 2026-11-11 | No state changed. Architecture built under the existing approval: `src/telemetry/`, no-op transport only, not imported by the extension, absent from the built package | — | — | — | `docs/telemetry/data-dictionary.md` |
