# Consent purpose mapping — draft v1

Status: **draft for review.** The mapping is data (`src/core/consent/mappings.ts`, `mappingVersion: 2`), stored with each site record so that a later mapping change never silently reinterprets an old result. The TCF and CMP rows below come from published purpose lists and must be confirmed against the pinned engine versions and CMP fixtures at Milestone 2.

## 1. The six user facing purposes

| Purpose | Meaning | Default |
|---|---|---|
| `storage` | Information storage and access | refuse |
| `preferences` | Preferences and functionality | refuse |
| `analytics` | Performance and analytics | refuse |
| `content` | Content selection and measurement | refuse |
| `advertising` | Advertising selection, delivery and reporting | refuse |
| `other` | Other optional purposes | refuse |

Strictly necessary processing is not a purpose and has no toggle. The extension never tries to switch off a control a CMP marks as necessary.

## 2. Purpose adapters

Purpose level execution is done through adapters over a consent tool's own documented interface, where its categories have a fixed meaning. One adapter exists: Cookiebot (preferences → `preferences`, statistics → `analytics`, marketing → `advertising`; each granted only with `storage` allowed). Consent O Matic's rules were assessed for this role and not used. Design, rules and evidence: `purpose-level-execution.md`.

## 3. Autoconsent

Autoconsent exposes whole banner actions: opt out, opt in, and a self test where the rule defines one. It has no purpose level interface.

| User preference | Action | Reported status |
|---|---|---|
| All six `refuse` | opt out | Up to `verified` |
| All six `allow` | opt in — only if every purpose is `allow` and `setBy` is `user` for all six | Up to `verified` |
| Mixed | opt out (conservative refusal) | `partial` at best, with the unfulfilled `allow` purposes listed |

Consequence: default users (everything refused) are fully served by Autoconsent. A mixed choice is executed purpose by purpose only where an adapter exists (section 2).

## 4. IAB TCF v2.2

Used for **read only verification** through `__tcfapi('getTCData')`. The extension never writes a TC string.

| TCF purpose | Our purpose |
|---|---|
| 1 Store and/or access information on a device | `storage` |
| 2 Use limited data to select advertising | `advertising` |
| 3 Create profiles for personalised advertising | `advertising` |
| 4 Use profiles to select personalised advertising | `advertising` |
| 7 Measure advertising performance | `advertising` |
| 5 Create profiles to personalise content | `content` |
| 6 Use profiles to select personalised content | `content` |
| 8 Measure content performance | `content` |
| 11 Use limited data to select content | `content` |
| 9 Understand audiences through statistics or combinations of data | `analytics` |
| 10 Develop and improve services | `analytics` |
| Special feature 1 Precise geolocation | `other` |
| Special feature 2 Actively scan device characteristics | `other` |
| Special purposes 1 to 3 (security, delivery, privacy choices) | Not mapped — not subject to consent in the framework |

`preferences` has no TCF equivalent. On a TCF only CMP it is reported as "not offered by this site", not as refused or allowed.

Verification rule for a refusal: every mapped `purpose.consents` bit is false **and** every mapped `purpose.legitimateInterests` bit is false. If consent bits are false but legitimate interest bits remain true, status is `partial` with the evidence line "legitimate interest still declared for N purposes". This is an observation, not a finding of unlawfulness (section 11).

Vendor level consent: read `vendor.consents` and `vendor.legitimateInterests` counts as evidence. No per vendor preferences in version 1.

## 5. Common CMP category models (to confirm with fixtures)

| CMP | Typical categories | Mapping |
|---|---|---|
| OneTrust | C0001 strictly necessary, C0002 performance, C0003 functional, C0004 targeting, C0005 social media | necessary → none; C0002 → `analytics`; C0003 → `preferences`; C0004 → `advertising`; C0005 → `other` |
| Cookiebot | necessary, preferences, statistics, marketing | necessary → none; preferences → `preferences`; statistics → `analytics`; marketing → `advertising` |
| Didomi, Usercentrics, Axeptio | Publisher defined purposes and vendors, often alongside TCF | Per site; mapped through TCF where present, otherwise unmapped |

Category identifiers are configurable by each site owner. A category that does not match the table is **unmapped**.

## 6. Rules for unmapped and mismatched purposes

1. An unmapped optional purpose is refused where a control exists and is never treated as accepted.
2. If the user allowed a purpose that the CMP cannot express, the result is `partial`.
3. If a CMP offers only accept all or reject all and the user's preferences are mixed, reject all is attempted and the result is `partial`.
4. If nothing can be mapped, the result is `unsupported`.
5. `storage` and site function: refusing `storage` on some CMPs disables features the user asked for. The extension does not second guess this; the pause control and site overrides are the remedy.

## 7. Open points

- Whether purpose 10 belongs in `analytics` or `other`. Draft places it in `analytics` so that "refuse analytics everywhere" covers it.
- OneTrust C0005 placement (`other` versus `advertising`).
- Google Consent Mode signals (`ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`) as a further read only evidence source: proposed for Milestone 4, not version 1.
