# Telemetry data dictionary — schema version 1

Status: **design only.** No build collects or sends any of this. Production collection is undecided (`decision-register.md`). The only transport is `NoopTransport`, which performs no input or output.

Every field is an enumeration. There is no free text field.

| Field | Values | Derived from | Never contains |
|---|---|---|---|
| `schemaVersion` | `1` | Constant | — |
| `eventType` | `cmp_detected`, `consent_action_outcome`, `privacy_signal_observed`, `engine_failure`, `performance_observation` | The kind of event | — |
| `cmpFamily` | `onetrust`, `cookiebot`, `didomi`, `sourcepoint`, `usercentrics`, `axeptio`, `quantcast`, `trustarc`, `consentmanager`, `tealium`, `other` | Rule name, collapsed by pattern | The rule name. Site specific rules such as `bbc.com` become `other` |
| `consentStatus` | The ten consent statuses | The run's final status, unchanged | A recoded "success" |
| `browserFamily` | `chromium`, `firefox`, `safari` | The adapter | Browser version, user agent |
| `processingTimeBand` | `<1s`, `1-3s`, `3-10s`, `>10s` | Duration, banded | Milliseconds |
| `signalCategory` | The six audit check identifiers | The audit | Tracker names, request hosts |

A batch is `{ schemaVersion, period, rows[] }` where `period` is an ISO week (`2026-W46`) and each row is one record with a count from 5 to 50.

## Absent by design

Site domains, URLs, page titles, cookie names or values, tracker identifiers, timestamps finer than a week, installation or session identifiers, locale, time zone, screen or device attributes, extension version, sector, country.

Sector and country (specification section 10.4, "market segmentation") are not in version 1: they cannot be derived without the site domain, which is excluded.

## Controls in code

| Control | Where | Test |
|---|---|---|
| Feature switch off | `src/config/features.ts` | `telemetry.test.ts` "disabled by default" |
| No subscriber without a current opt in | `src/telemetry/index.ts` | "observes nothing before opt in" |
| Allow list projection | `minimisation.ts` | "builds every record from enumerated values only" |
| Strict schema, unknown keys refused | `schema.ts`, `privacy-controls.ts` | "rejects every prohibited field" (20 payloads) |
| Independent content scan | `privacy-controls.ts` | "the independent scan recognises each kind" |
| Rare combination merge and drop, count cap | `aggregation.ts` | "merges rare combinations", "caps a row" |
| Single non transmitting transport, no address in the directory | `noop-transport.ts` | "there is exactly one transport" |
| Core independent of telemetry | Import boundary | "nothing in the extension imports the telemetry directory" |
