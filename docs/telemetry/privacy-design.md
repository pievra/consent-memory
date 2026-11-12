# Telemetry architecture proposal — disabled capability

Status: **proposal under Decision A only.** Production collection, backend deployment and publication are undecided (`decision-register.md`). Nothing here is a collection contract.

## 1. Design goals

1. Consent execution never imports from `src/telemetry/`. The dependency points one way: telemetry observes domain events published by the core; the core does not know telemetry exists.
2. With telemetry absent, disabled or failing, behaviour of every other feature is identical.
3. A build cannot transmit by accident: there is no transport that transmits.

## 2. Components

```text
core (consent, audit)
   │  publishes typed domain events on an in process bus (no telemetry types)
   ▼
telemetry/consent-state.ts     gate: 'unavailable' | 'declined' | 'opted_in' | 'withdrawn'
   ▼
telemetry/minimisation.ts      allow list projection: domain event → coarse counters
   ▼
telemetry/aggregation.ts       period counts, rare combination suppression
   ▼
telemetry/privacy-controls.ts  schema validation, prohibited field rejection
   ▼
telemetry/transport.ts         interface TelemetryTransport { send(batch): Promise<void> }
telemetry/noop-transport.ts    the only implementation; resolves without I/O
```

Gate behaviour in this release: `features.telemetry` is a compile time constant `false` and the state is fixed at `unavailable`. With the gate closed the subscriber is not registered, so no event is observed, counted or buffered. This satisfies "no telemetry collected retroactively": when a future opt in happens, counting starts from zero at that moment.

## 3. Minimisation by construction

The projection is an **allow list**, not a block list. A telemetry record is built field by field from enumerated values; there is no code path that copies an object from the core into a payload.

| Field | Allowed values | Notes |
|---|---|---|
| `schemaVersion` | `1` | |
| `eventType` | 5 enumerated types (specification 10.5) | |
| `cmpFamily` | Enumerated list of recognised CMP families, else `other` | Rare CMPs collapse to `other` |
| `consentStatus` | The `ConsentStatus` enum | `inconclusive` is never recoded as success |
| `browserFamily` | `chromium`, `firefox`, `safari` | No version in v1 |
| `processingTimeBand` | `<1s`, `1-3s`, `3-10s`, `>10s` | |
| `signalCategory` | The six audit check ids | Count only |

The validator rejects, by key name and by value shape, anything that looks like: a domain or URL, a path or query string, an IP address, a timestamp finer than a day, a UUID or other high entropy string over 16 characters, a cookie name or value, free text. Strings must belong to an enumerated set; there is no open string field in the schema.

Explicitly absent: installation identifier, session identifier, exact timestamps, locale, time zone, screen or device attributes, extension version finer than major.minor, site domains, sector or country (the candidate "market segmentation" category in 10.4 is not designed in v1 because it cannot be derived without the domain).

## 4. Aggregation

Local, per calendar week. The unit is a tuple `(eventType, cmpFamily, consentStatus | signalCategory, processingTimeBand?)` with a count. Before a batch is formed:

- Tuples with a local count below a threshold `k` (proposed 5) are merged into `cmpFamily: other`; if still below `k`, dropped.
- Counts are capped (proposed 50 per tuple per week) to bound one user's weight in any aggregate.
- The batch carries the ISO week, not a send time.

Limits stated honestly: a threshold and a cap do not make the data anonymous. A weekly vector of CMP family counts from one browser is a coarse summary of that person's browsing. Server side, the same client's batches would be linkable through IP address and timing unless the transport and ingestion design prevent it. These points are inputs to the Decision B assessment, in particular: IP handling at the edge, whether batches are submitted through an anonymising relay, whether local randomised response or central differential privacy is applied, and repeated release and differencing risk for small CMP families and small markets.

## 5. Consent state (design only)

```ts
type TelemetryConsent =
  | { status: 'unavailable' }                       // this release
  | { status: 'declined'; decidedAt: string }
  | { status: 'opted_in'; decidedAt: string; noticeVersion: number }
  | { status: 'withdrawn'; decidedAt: string };
```

- No default other than `unavailable` or `declined`. Never preselected.
- `opted_in` is bound to a notice version. A new notice version (new field, purpose or recipient) returns the state to undecided until the user chooses again; an extension update can never widen collection on an old opt in.
- Withdrawal clears the local buffer immediately and stops observation.
- The choice is presented apart from cookie preferences and onboarding of core features.

## 6. Settings area

In this release the options page shows one static entry: "Sharing statistics with Pievra — not available. This version sends no data." No toggle, no prompt.

## 7. Tests (synthetic data only)

| Test | Assertion |
|---|---|
| Disabled state | With `features.telemetry = false`, zero subscribers on the bus and zero writes to `telemetry:*` beyond the fixed state |
| No transmission | e2e run records every request from the extension context; expected count is 0 |
| No production transport | Build scan: the bundle contains no URL other than documentation links listed in an allow list; `transport.ts` has exactly one implementation |
| Prohibited fields | A corpus of payloads containing domains, URLs, IPs, UUIDs, timestamps and unknown keys is rejected, 100% |
| Aggregation | Fixed synthetic input produces byte identical output across runs |
| Small samples | Tuples under `k` are merged then dropped; caps applied |
| Withdrawal | Buffer empty after withdrawal; no observation afterwards |
| Independence | Consent core test suite passes with the `src/telemetry/` directory removed from the build |
| Publication guard | No code path exports aggregates outside tests; publication tooling, if written, refuses to run unless the register state is "Approved" |

## 8. Not designed here

Endpoint, hosting, authentication, retention, processors, legal basis, DPIA, notice wording, publication methodology beyond a draft at Milestone 5. Each belongs to the gates in the decision register.
