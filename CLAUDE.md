# CLAUDE.md — Pievra Consent Memory

## Master Product, Architecture, Security and Engineering Specification

**Publisher:** Pievra  
**Repository:** `consent-memory`  
**Product name:** `{{EXTENSION_NAME}}`  
**Product category:** Consumer privacy, consent management and privacy intelligence  
**Primary development environment:** Claude Code  
**Languages:** UK English and French  
**Licence:** Open source, subject to dependency licence review  
**Architecture:** Local first, modular, cross browser, privacy preserving  
**Target quality:** Minimum 8/10 with mandatory release gates  
**Telemetry:** Optional capability, collection and publication decisions pending  
**Initial release:** Chromium desktop  
**Subsequent releases:** Firefox, Safari desktop and supported mobile browsers

---

# 1. Mission

Build a free, open source browser extension that enables individuals to control, remember and verify their website privacy preferences.

The extension must automatically apply privacy choices, verify whether those choices were recorded by websites, and provide understandable evidence about potential privacy risks.

The product must also be architected to support a future Pievra privacy intelligence capability, using voluntary, minimised telemetry to produce aggregate insights about consent platform behaviour, website privacy practices and industry trends.

**No Pievra telemetry collection or publication is authorised by this specification.** The infrastructure may be designed and tested using synthetic data, but production collection remains disabled until separately approved.

The objective is to build a trusted consumer privacy product and, potentially, an independent source of privacy market intelligence.

These two objectives must never conflict. User protection always takes precedence over data collection, analytics, commercial opportunities or research.

## 1.1 Product tenets

1. Privacy and user control by default.
2. Refusal of optional processing unless explicitly authorised.
3. Verified outcomes rather than assumed success.
4. Local first personal consent memory.
5. Transparent, voluntary and minimised telemetry where separately approved.
6. Independent, evidence based privacy assessment.
7. No misleading legal compliance claims.
8. Cross browser architecture with platform specific verification.
9. Accessible and understandable user experiences.
10. Open source, auditable engineering and formal release governance.

---

# 2. Product Scope

The product comprises seven functional capabilities.

## 2.1 Automatic consent handling

Detect recognised consent management platforms and attempt to apply the user's privacy preferences.

Refuse optional advertising, analytics, profiling and personalisation purposes by default.

Preserve activities that are strictly necessary for a service requested by the user.

Never use generic button detection to accept optional purposes.

## 2.2 Consent memory

Remember consent preferences by website and purpose.

Support global defaults, explicit website overrides, preference changes and bulk operations.

Persist preferences across browser restarts.

Never assume a previously recorded preference remains technically effective indefinitely.

## 2.3 Consent verification

Distinguish between a requested action, an attempted action, a recorded choice and a verified result.

Do not report success merely because a button was clicked or a banner disappeared.

## 2.4 Privacy dashboard

Provide a clear interface for users to inspect and manage their preferences.

Show consent status, evidence, recognised consent platform, relevant privacy signals and verification limitations.

## 2.5 Global Privacy Control

Support GPC on platforms where the necessary browser capabilities are available.

Make GPC enabled by default, with clear user controls.

Do not claim universal legal effectiveness.

## 2.6 Technical privacy auditing

Observe relevant technical signals, including tracking activity before consent, behaviour after refusal, and consent interface characteristics.

Classify observations as evidence rather than definitive legal findings.

## 2.7 Optional Pievra telemetry and privacy intelligence

Design a separate telemetry capability that could support:

- Aggregate CMP adoption statistics.
- Consent handling success rates.
- CMP verification and failure trends.
- Technical privacy signals by sector and geography.
- Browser compatibility and rule reliability.
- Changes in observable consent behaviour over time.
- Research and potentially published Pievra market intelligence.

The capability must be optional, independently controlled, privacy reviewed and disabled by default.

Publication of aggregate results is a separate product decision.

---

# 3. Non Negotiable Requirements

## 3.1 User privacy

- Consent memory remains local by default.
- No advertising identifiers.
- No third party advertising SDKs.
- No sale of identifiable browsing data.
- No transmission of personal consent histories without explicit authorisation.
- No remote executable code.
- No covert telemetry.
- No collection of full browsing history for analytics.
- No collection of page contents, form inputs, search queries, authentication tokens or payment information for telemetry.
- No collection before the relevant user choice is obtained.
- No collection beyond the disclosed telemetry purpose.
- No activation of analytics through an extension update without a valid user choice.

## 3.2 Consent integrity

- Refuse optional purposes by default.
- Never forge TCF consent strings.
- Never fabricate website consent records.
- Never silently accept a consent purpose.
- Never represent an attempted action as verified.
- Never bypass website security protections.
- Never override explicit user preferences without authorisation.

## 3.3 Website safety

- Never automatically delete authentication cookies.
- Never silently clear shopping baskets.
- Never modify payment information.
- Never submit purchases.
- Never interfere with login forms.
- Never bypass security challenges.
- Never repeatedly reload pages to force consent actions.

## 3.4 Telemetry safety

- Production telemetry is disabled by default.
- No telemetry is sent before explicit activation and a valid user opt in.
- Refusing telemetry must not reduce the extension's core functionality.
- Users must be able to withdraw their choice.
- Telemetry and publication must have separate governance.
- Do not infer that a dataset is anonymous merely because direct identifiers have been removed.
- Pievra's commercial interests must not influence the user's consent preferences.

## 3.5 Engineering

- TypeScript strict mode.
- Least privilege permissions.
- Versioned data schemas.
- No embedded secrets.
- No unapproved network dependencies.
- No unverified release claims.
- No fabricated tests or quality scores.
- No production publication without mandatory release approval.

---

# 4. Platform and Release Strategy

Maintain one shared consent core and browser specific adapters.

## Phase 1 — Chromium desktop

Target Google Chrome and Microsoft Edge on supported desktop operating systems.

This is the first production release.

## Phase 2 — Additional desktop browsers

Target Mozilla Firefox desktop and Safari on macOS.

Implement and test browser specific adapters.

Do not assume that Chromium permissions, extension APIs or GPC behaviour transfer unchanged.

## Phase 3 — Mobile

Target Safari on iOS and iPadOS and Firefox on Android, subject to verified platform capabilities.

Safari mobile requires an appropriate Apple application wrapper and extension packaging.

Firefox Android requires dedicated API compatibility and real device testing.

Standard Chrome on Android and Chrome on iOS must not be advertised as supported extension environments unless official capabilities change and support is verified.

## Mandatory platform policy

A responsive interface is not equivalent to a functioning mobile extension.

Each supported platform requires independent consent, security, reliability, accessibility and compatibility testing.

A failed platform must remain experimental or unsupported.

Desktop and mobile releases must not be artificially combined into one release gate.

---

# 5. Technical Stack

## Core

- TypeScript with strict typing.
- WXT for extension development where appropriate.
- Manifest V3 where supported and appropriate.
- pnpm.
- Supported Node.js LTS.
- Zod or equivalent runtime schema validation.
- A maintained public suffix library.

## User interface

- Preact.
- Plain CSS.
- Design tokens.
- CSS custom properties.
- Responsive layouts.
- Accessible semantic components.
- Light and dark modes.

## Consent engines

Evaluate and integrate:

- DuckDuckGo Autoconsent.
- Consent O Matic.

Verify current licences, APIs, rules and redistribution conditions before integration.

## Testing

- Vitest.
- Playwright where supported.
- Browser specific integration environments.
- Safari testing with Xcode and actual Apple devices.
- Firefox Android testing with Android devices.
- Automated accessibility testing.
- Manual accessibility verification.

## Security

- Static analysis.
- Dependency scanning.
- Secret scanning.
- Licence checks.
- Content Security Policy verification.
- Software bill of materials.
- Build artifact inspection.

## Optional telemetry

Use a modular, versioned event schema and a transport abstraction.

Do not select or deploy a production analytics provider without approval.

Do not introduce Google Analytics, Firebase Analytics, advertising SDKs or a commercial product analytics service as an implicit default.

---

# 6. System Architecture

Use a modular monorepo or equivalent modular repository.

```text
consent-memory/
├── src/
│   ├── config/
│   │   ├── brand.ts
│   │   ├── constants.ts
│   │   ├── features.ts
│   │   └── capabilities.ts
│   │
│   ├── core/
│   │   ├── consent/
│   │   │   ├── resolver.ts
│   │   │   ├── executor.ts
│   │   │   ├── verifier.ts
│   │   │   ├── states.ts
│   │   │   ├── purposes.ts
│   │   │   └── mappings.ts
│   │   ├── domains/
│   │   ├── policies/
│   │   └── errors/
│   │
│   ├── engines/
│   │   ├── autoconsent/
│   │   ├── consentomatic/
│   │   └── registry.ts
│   │
│   ├── adapters/
│   │   ├── chromium/
│   │   ├── firefox/
│   │   ├── safari/
│   │   └── shared/
│   │
│   ├── audit/
│   │   ├── collector.ts
│   │   ├── checks.ts
│   │   ├── evidence.ts
│   │   ├── classifications.ts
│   │   └── scoring.ts
│   │
│   ├── storage/
│   │   ├── schema.ts
│   │   ├── repository.ts
│   │   ├── migrations.ts
│   │   ├── import-export.ts
│   │   └── retention.ts
│   │
│   ├── telemetry/
│   │   ├── schema.ts
│   │   ├── events.ts
│   │   ├── minimisation.ts
│   │   ├── aggregation.ts
│   │   ├── privacy-controls.ts
│   │   ├── transport.ts
│   │   ├── noop-transport.ts
│   │   └── consent-state.ts
│   │
│   ├── privacy/
│   │   ├── gpc.ts
│   │   ├── permissions.ts
│   │   └── data-flows.ts
│   │
│   ├── ui/
│   │   ├── components/
│   │   ├── popup/
│   │   ├── options/
│   │   ├── onboarding/
│   │   ├── telemetry-settings/
│   │   ├── audit/
│   │   └── styles/
│   │
│   ├── entrypoints/
│   │   ├── background.ts
│   │   ├── content.ts
│   │   └── popup/
│   │
│   └── locales/
│       ├── en/
│       └── fr/
│
├── public/
│   └── _locales/
│       ├── en/
│       └── fr/
│
├── rules/
│   ├── consent/
│   ├── trackers/
│   └── gpc/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── security/
│   ├── accessibility/
│   ├── telemetry/
│   ├── fixtures/
│   └── platforms/
│
├── docs/
│   ├── architecture/
│   ├── security/
│   ├── privacy/
│   ├── methodology/
│   ├── telemetry/
│   ├── compatibility/
│   ├── legal/
│   ├── qa/
│   └── store/
│
└── scripts/
```

Keep shared product logic independent from browser permissions, transport implementations and privileged APIs.

The telemetry subsystem must not become a dependency for consent execution.

If telemetry fails or is disabled, all core privacy features must continue to function.

---

# 7. Consent Purpose Model

Preserve the six user facing categories.

| Purpose | Meaning |
|---|---|
| `storage` | Information storage and access |
| `preferences` | Preferences and functionality |
| `analytics` | Performance and analytics |
| `content` | Content selection and measurement |
| `advertising` | Advertising selection, delivery and reporting |
| `other` | Other optional purposes |

Distinguish optional processing from strictly necessary functionality.

Maintain versioned mappings between these categories and:

- Consent O Matic categories.
- Autoconsent capabilities.
- Recognised CMP purpose models.
- Relevant TCF purposes.
- Legitimate interest declarations.
- Vendor level consent where available.

Never assume every CMP uses the same categories.

Unknown mappings must be handled conservatively and disclosed as partial or unsupported.

## Preference resolution

Resolve each purpose in this order:

1. Site paused or excluded.
2. Explicit site specific user preference.
3. Global user preference.
4. Built in refusal default.

Explicit site choices override global defaults.

Do not treat an unmapped optional purpose as accepted.

## Mixed preferences

Use purpose level CMP controls where supported.

If only an all or nothing action is available, avoid claiming that mixed preferences were fulfilled.

A conservative refusal may be attempted where safe, but must be reported as partial when it does not match all requested choices.

---

# 8. Consent Execution and Verification

Implement a mandatory state machine.

```text
NOT_DETECTED
    ↓
DETECTED
    ↓
PREFERENCES_RESOLVED
    ↓
ACTION_ATTEMPTED
    ↓
ACTION_RECORDED
    ↓
VERIFIED
```

Alternative states:

```text
PARTIAL
FAILED
INCONCLUSIVE
UNSUPPORTED
SKIPPED
```

## Execution

Before any interaction:

- Identify the CMP.
- Resolve preferences.
- Determine engine capabilities.
- Validate the target control.
- Check the safety context.
- Prevent conflicting or duplicate actions.

Never click an unknown acceptance control through heuristics.

Use bounded retries.

Avoid infinite loops and repeated reloads.

## Verification

Use available evidence such as:

- Supported CMP APIs.
- Read only TCF API interrogation.
- Recognised consent records.
- CMP state reporting.
- Persistence after reload where appropriate.

Do not write or forge TCF consent strings.

Distinguish consent recording from downstream tracker behaviour.

A verified refusal does not prove all tracking has stopped.

## Consent status rules

Only use "Verified" when sufficient evidence confirms the intended CMP state.

Use "Partial" when only part of the user preference was implemented.

Use "Inconclusive" when evidence is insufficient.

Never turn an unknown result into a success for UI, telemetry or analytics reporting.

---

# 9. Local Storage and Data Model

Store user preferences locally by default.

Use versioned records.

```ts
type Purpose =
  | 'storage'
  | 'preferences'
  | 'analytics'
  | 'content'
  | 'advertising'
  | 'other';

type Choice = 'allow' | 'refuse';

type ConsentStatus =
  | 'not_detected'
  | 'detected'
  | 'attempted'
  | 'recorded'
  | 'verified'
  | 'partial'
  | 'failed'
  | 'inconclusive'
  | 'unsupported'
  | 'skipped';

interface SiteRecord {
  domain: string;
  cmp?: string;
  cmpRuleVersion?: string;
  choices: Record<Purpose, Choice>;
  setBy: Record<Purpose, 'user' | 'default'>;
  status: ConsentStatus;
  paused: boolean;
  lastAttempted?: string;
  lastVerified?: string;
  evidenceSummary?: string[];
  audit?: AuditResult;
  schemaVersion: number;
}
```

Define `AuditResult` and dependent types separately.

## Storage requirements

- Use a maintained public suffix library.
- Distinguish registrable domains from subdomains.
- Support domain specific overrides.
- Implement schema migrations.
- Validate data on read and write.
- Handle quotas and corruption.
- Prevent silent preference loss.
- Support export and deletion.
- Keep audit evidence subject to documented retention limits.

Chrome Sync is not local only storage.

Do not enable browser account synchronisation by default.

Future synchronisation requires a separately approved privacy design.

---

# 10. Pievra Telemetry — Optional Capability

## 10.1 Strategic purpose

Pievra may use voluntary telemetry to understand how websites implement consent preferences and how consent management technology behaves across the web.

Potential uses include product improvements, research, industry benchmarking and aggregate market intelligence published by Pievra.

**Both telemetry collection and publication are undecided.**

This specification authorises architectural preparation and synthetic data testing only.

It does not authorise production collection, endpoint deployment, user enrolment, external sharing or publication.

## 10.2 Separate decision gates

Maintain three independent decisions.

**Decision A — Build capability**

Approved by this specification.

Build interfaces, schemas, privacy controls, synthetic tests and a no operation transport.

**Decision B — Activate production collection**

Not approved.

Requires an explicit product decision, legal review, security review, updated privacy documentation, user consent design and applicable store policy review.

**Decision C — Publish aggregate insights**

Not approved.

Requires separate governance, disclosure controls, aggregation validation and editorial approval.

Do not infer approval of B or C from approval of A.

## 10.3 Telemetry principles

- Disabled by default.
- Explicit opt in before transmission.
- No preselected telemetry consent.
- No loss of core functionality when declined.
- Independent consent withdrawal.
- Purpose limitation.
- Data minimisation.
- No full browsing histories.
- No raw page content.
- No personal identifiers in event payloads.
- No fingerprinting.
- No precise geolocation.
- No advertising profiling.
- No sale of identifiable user information.
- No undisclosed third party analytics processors.
- No telemetry collected retroactively.

A technical event must not be considered anonymous simply because the event does not contain a name or email address.

Combinations of website, timestamp, browser version, location and network metadata may permit reidentification.

## 10.4 Candidate telemetry categories

The following are candidate categories, not authorisation to collect them.

| Category | Candidate information |
|---|---|
| CMP adoption | Recognised CMP family |
| Consent handling | Attempted, verified, partial, failed, inconclusive |
| Technical signals | Counts of specific audit signals |
| Engine reliability | Rule and engine version |
| Browser support | Browser family and coarse version |
| Performance | Coarse processing duration bands |
| Market segmentation | Broad sector or jurisdiction when reliably established |
| Product quality | Aggregate failure categories |

Website domains are excluded from the default candidate telemetry schema.

Any future proposal to collect site level domains must receive a separate privacy impact assessment and explicit approval.

No URL paths, query strings, page titles, form content, cookie values or tracker identifiers may be included in telemetry payloads.

## 10.5 Event model

Design a versioned schema.

Illustrative example:

```ts
type TelemetryEventType =
  | 'cmp_detected'
  | 'consent_action_outcome'
  | 'privacy_signal_observed'
  | 'engine_failure'
  | 'performance_observation';

interface TelemetryEventV1 {
  schemaVersion: 1;
  eventType: TelemetryEventType;
  cmpFamily?: string;
  consentStatus?: ConsentStatus;
  browserFamily?: string;
  processingTimeBand?: string;
  signalCategory?: string;
}
```

This is a conceptual schema, not a production collection contract.

Before activation, assess whether any field or combination of fields could identify an individual or expose their browsing behaviour.

Avoid exact timestamps, persistent installation identifiers and device fingerprints.

Do not add unique IDs merely to support analytics convenience.

## 10.6 Data minimisation and aggregation

Prefer local aggregation over raw event transmission.

Candidate design:

1. Observe relevant events locally.
2. Convert them into coarse categories.
3. Aggregate counts over a defined period.
4. Suppress rare combinations.
5. Apply disclosure controls.
6. Transmit only approved aggregate information after user consent.

This design must be independently assessed before deployment.

Do not claim that a minimum sample size alone guarantees anonymity.

Evaluate potential reidentification through repeated releases, rare CMPs, small markets and differencing attacks.

Consider formal differential privacy or comparable disclosure control techniques if the publication model warrants them.

## 10.7 Telemetry consent interface

If collection is approved, provide a separate, understandable choice.

Suggested wording:

"Help improve privacy research by sharing limited technical statistics about how cookie consent works. Your individual website preferences stay on your device."

This wording must be revised to match the actual approved collection and processing design.

The user must be able to:

- Decline.
- Opt in.
- Review what is collected.
- Withdraw.
- Inspect locally stored telemetry.
- Clear unsent telemetry.
- See the recipient and purpose of any transmission.

Do not imply that withdrawing consent automatically erases information already incorporated into irreversible aggregate publications.

Provide a truthful explanation of deletion limitations and available rights.

## 10.8 Architecture and transport

Implement a telemetry transport abstraction.

The default and only enabled implementation must be `NoopTransport`.

Do not configure a production endpoint.

Do not add hidden transmission paths.

Do not include a production API key or telemetry token.

A future transmission implementation must have:

- Secure transport.
- Authentication or abuse protection appropriate to the threat model.
- Data minimisation.
- Rate limiting.
- Defined retention.
- Purpose separation.
- Processor review.
- Security testing.
- Documented deletion mechanisms.
- Appropriate hosting and transfer safeguards.

Consider network metadata, including IP addresses and server logs, as part of the privacy design.

## 10.9 Governance and data protection assessment

Before production activation, complete:

- Data protection impact screening.
- DPIA where legally required.
- Identification of controller and processor roles.
- Applicable legal basis assessment.
- Consent record design.
- Data minimisation review.
- Data retention policy.
- International transfer assessment where relevant.
- Data subject rights handling.
- Security assessment.
- Browser store compliance review.
- Updated privacy notices.
- User acceptance testing.

Because the initial proposal uses explicit opt in, validate that consent is valid for the actual processing purposes and jurisdictions.

Do not assume consent automatically resolves every regulatory obligation.

## 10.10 Publishing options

Pievra has not decided whether to publish telemetry findings.

Preserve three potential future models.

**Option 1 — Internal product analytics**

Use approved, aggregated data solely for product quality and reliability.

No public reporting.

**Option 2 — Public aggregate transparency reports**

Publish aggregated findings on CMP behaviour, technical privacy signals and market trends.

Require suppression of identifying information and editorial review.

**Option 3 — Pievra privacy intelligence**

Publish structured industry benchmarks, market analysis and trend reports.

This may support Pievra's research positioning and future commercial opportunities.

Any commercial use requires explicit disclosure, purpose compatibility assessment and separate approval.

No ranking, score or compliance verdict may be sold or influenced by commercial relationships.

## 10.11 Publication quality controls

Before publishing a statistic, require:

- Sufficient and representative evidence.
- Clear sample definitions.
- Defined observation period.
- Reproducible methodology.
- Exclusion of inconclusive outcomes from verified success counts.
- Confidence and sampling limitations.
- Appropriate disclosure controls.
- Protection against reidentification.
- Human editorial review.
- Corrections and appeals mechanism.

Distinguish observations from legal interpretations.

Pievra may report, for example, the percentage of observed consent attempts that were verified.

It must not claim that the same percentage of websites are GDPR compliant.

## 10.12 Telemetry acceptance criteria

Telemetry architecture may pass development QA only when:

- Default transport is non transmitting.
- No production endpoint is configured.
- Zero outbound telemetry occurs in disabled mode.
- User preferences remain local.
- The extension works without telemetry.
- Opt in and withdrawal states are correctly represented.
- Payload validation rejects prohibited fields.
- Data minimisation tests pass.
- Synthetic analytics calculations are reproducible.
- Publication code cannot make an unapproved release public.

Do not mark telemetry collection as production ready until all activation approvals are documented.

---

# 11. Privacy Intelligence Methodology

Separate the following concepts.

**Consent choice:** What the user requested.

**Consent recording:** What the CMP appears to have stored.

**Consent verification:** Evidence confirming the requested CMP state.

**Technical privacy observation:** Behaviour observable by the extension.

**Legal compliance assessment:** A jurisdiction specific legal determination requiring a different methodology.

These are not interchangeable.

## Audit outcome types

Use:

- Passed.
- Signal detected.
- Inconclusive.
- Not applicable.

Do not count missing evidence as a pass.

## Technical checks

Evaluate six initial categories:

1. Observable tracking activity before consent.
2. Observable tracking activity after refusal.
3. Refusal accessibility in the consent interface.
4. Optional purposes enabled by default.
5. Availability of relevant consent information.
6. Observable behaviour associated with GPC.

Recognise that some tracking requests may be technically or legally necessary.

Do not automatically classify every tracker request or legitimate interest declaration as unlawful.

## Audit timing

Capture evidence during:

- Arrival.
- Consent interaction.
- Post choice observation.
- Optional subsequent visit.

Use bounded observation windows and record relevant timing.

Do not assume a fixed period captures every consent or network event.

## Scoring

Show understandable technical results.

Example:

"4 checks passed, 1 signal detected, 1 inconclusive."

Do not publish a universal GDPR compliance score.

If a future aggregate benchmark is created, label it clearly as a technical observation metric.

---

# 12. Global Privacy Control

Support GPC where technically available.

On Chromium, investigate declarativeNetRequest for sending:

```text
Sec-GPC: 1
```

Implement appropriate JavaScript exposure where supported:

```js
navigator.globalPrivacyControl
```

Validate browser specific behaviour.

Do not assume manually defining a JavaScript property is equivalent to full browser native support.

## Testing

Verify:

- Header emission.
- JavaScript exposure.
- Enabled and disabled states.
- Browser restart.
- Page navigation.
- Relevant iframe behaviour.
- Browser compatibility.

Do not claim GPC protection when the browser does not support the implemented mechanism.

## User explanation

Use jurisdiction aware language.

Do not state that GPC is legally binding everywhere.

Explain that GPC does not replace site specific consent choices.

---

# 13. User Experience

The product must be understandable to non technical users.

## Design principles

- Plain language.
- Clear visual hierarchy.
- Consistent controls.
- No misleading success indicators.
- Accessible interactions.
- Minimal unnecessary complexity.
- Transparent privacy settings.
- Consistent light and dark modes.

## Popup

Display:

- Current website.
- Current preferences.
- Consent status.
- Verification result.
- GPC status.
- Relevant privacy signals.
- Pause control.
- Link to settings.

Suggested statuses:

- Preferences recorded and verified.
- Preferences applied; verification unavailable.
- Partially completed.
- Could not manage consent.
- Extension paused.

Only use verified success styling when evidence supports it.

## Options dashboard

Display:

- Website.
- CMP.
- Preferences.
- Verification status.
- Privacy signals.
- Last action.

Support search, sorting and filtering.

## Bulk operations

Support:

- Share nothing with all websites.
- Refuse one purpose everywhere.
- Reset selected preferences.
- Pause selected websites.
- Forget selected records.
- Import.
- Export.

Preview the scope of bulk actions.

Provide undo where feasible.

## Cookie removal

Never clear cookies automatically when preferences change.

Offer optional cookie removal with a separate confirmation.

Explain that it may log users out or reset baskets and sessions.

Do not present cookie deletion as proof that consent has been withdrawn.

## Telemetry settings

Prepare a separate settings area that can remain hidden or explicitly marked unavailable until telemetry is approved.

Future telemetry opt in must not be bundled with cookie preferences.

Do not use dark patterns to encourage sharing.

---

# 14. Mobile Experience

Mobile support must work within each target browser's extension environment.

## Viewport testing

Test at:

- 320 CSS pixels.
- 375 CSS pixels.
- 390 CSS pixels.
- 430 CSS pixels.
- 768 CSS pixels.
- 1024 CSS pixels.
- 1440 CSS pixels.

## Mobile usability

- Touch friendly controls.
- Preferred touch targets of at least 44 × 44 CSS pixels.
- No hover dependent actions.
- Responsive forms.
- Screen reader support.
- Large text support.
- Portrait and landscape support.
- No horizontal overflow.
- Appropriate safe area handling.
- Usable settings with the on screen keyboard.

## Mobile dashboard

Do not compress desktop tables into unreadable layouts.

Use responsive cards or an equivalent compact presentation.

## Lifecycle testing

Test:

- Background suspension.
- Browser restart.
- Tab restoration.
- Navigation.
- Permission changes.
- Low memory conditions.
- State persistence.

## Safari mobile

Use the required native Apple packaging and signing workflow.

Test on actual supported iPhone and iPad devices.

## Firefox Android

Validate extension APIs on actual Android devices.

Do not infer compatibility from desktop Firefox alone.

---

# 15. Security Architecture

Implement a documented threat model.

Cover:

- Malicious pages.
- Content script injection.
- Cross origin messaging.
- Privileged extension APIs.
- Compromised rule files.
- Malicious JSON imports.
- Storage manipulation.
- Dependency compromise.
- Build pipeline compromise.
- Telemetry endpoint abuse.
- Reidentification risks.
- Data exfiltration.
- Extension permission abuse.

## Mandatory controls

- Validate cross boundary messages.
- Validate message origins and senders where supported.
- Keep privileged code isolated.
- Minimise MAIN world execution.
- Avoid dynamic code execution.
- Avoid `eval`.
- Validate imported records.
- Restrict web accessible resources.
- Apply least privilege permissions.
- Lock dependencies.
- Scan vulnerabilities.
- Document data flows.
- Keep secrets out of the repository.

## Telemetry security

If telemetry activation is ever approved, evaluate:

- Secure transmission.
- Data retention.
- Endpoint authentication and abuse prevention.
- Aggregation protection.
- Access controls.
- Logging minimisation.
- Deletion workflows.
- Breach response.
- Reidentification risk.

Do not deploy the telemetry endpoint during the initial implementation.

---

# 16. Browser Permissions

Document every requested permission.

Evaluate:

- `storage`
- `cookies`
- `declarativeNetRequest`
- `webRequest`
- `scripting`
- `tabs`
- `activeTab`
- Host permissions

Use the minimum permissions required for the stated functionality.

Justify broad host access where consent handling across arbitrary websites requires it.

Maintain a platform capability matrix covering:

- Content scripts.
- Page world execution.
- Header modification.
- Cookie access.
- Network observation.
- Persistent storage.
- Browser lifecycle.
- Permissions.
- Mobile limitations.

If a capability is unavailable, disable that feature safely.

Do not introduce invasive permissions solely to support telemetry.

---

# 17. Third Party Dependencies and Licensing

Review licences at the exact dependency versions used.

Evaluate:

- DuckDuckGo Autoconsent.
- Consent O Matic.
- Tracker lists.
- Public suffix libraries.
- WXT.
- Preact.
- Testing libraries.

Document:

- Source.
- Version.
- Licence.
- Attribution.
- Modification obligations.
- Redistribution requirements.
- Commercial restrictions.

Create:

```text
THIRD_PARTY_NOTICES.md
docs/legal/licence-audit.md
```

Do not ship incompatible third party code or datasets.

Do not assume every open source licence permits unrestricted redistribution or commercial use.

Bundle approved consent and tracker rules at build time.

No remote executable rule downloads.

---

# 18. Localisation and Accessibility

Support English (UK) and French.

Keep all user facing strings in localisation files.

Use UK English spelling.

Target WCAG 2.2 AA for relevant extension interfaces.

Include:

- Keyboard navigation.
- Visible focus indicators.
- Screen reader labels.
- Accessible dialogs.
- Sufficient contrast.
- Clear errors.
- Text scaling.
- Reduced motion.
- Non colour dependent status indicators.

Run automated and manual accessibility tests.

Do not claim WCAG conformance based solely on an automated scanner.

Use plain language in user facing copy.

---

# 19. Performance and Reliability

Minimise website interference.

## Requirements

- No persistent extension induced layout shifts.
- No unnecessary blocking of website interaction.
- No unbounded DOM observation.
- No repeated consent loops.
- No excessive background processing.
- No silent preference corruption.
- No dependency of consent execution on telemetry availability.

## Packaging

Target a Chromium release archive below 2 MB where practical.

Do not compromise necessary functionality or security solely to meet the size target.

## Diagnostics

Maintain a local diagnostic view.

Include:

- Recent consent actions.
- Failed attempts.
- Rule versions.
- Browser limitations.
- Local performance observations.

Diagnostic exports must be user initiated.

Provide redaction options before sharing.

Do not send diagnostic information automatically.

---

# 20. Testing Strategy

## Unit tests

Cover:

- Consent resolution.
- Purpose mappings.
- Mixed preferences.
- Domain matching.
- Consent state transitions.
- Verification logic.
- Storage migrations.
- Import and export.
- Bulk actions.
- Audit classifications.
- GPC configuration.
- Telemetry disabled state.
- Telemetry schema validation.

## Integration tests

Build deterministic CMP fixtures representing:

- Didomi.
- OneTrust.
- Cookiebot.
- Usercentrics.
- Axeptio.
- TCF interfaces.
- Unknown CMPs.
- Iframes.
- Consent persistence failures.
- Reload behaviour.
- Partial consent capabilities.

## End to end tests

Use Playwright where supported.

Verify:

- Installation.
- Default refusal.
- Site overrides.
- Persistence.
- Second visit handling.
- GPC.
- Popup.
- Dashboard.
- Bulk changes.
- Import and export.
- Permissions.
- No unauthorised acceptance.

## Real website tests

Maintain at least 30 test sites across France, the United Kingdom and Saudi Arabia.

Cover retail, ecommerce, media, banking, travel and services.

Record:

- Browser.
- Browser version.
- CMP.
- Requested action.
- Actual action.
- Verification result.
- Audit signals.
- Website breakages.
- Rule version.
- Test date.

Do not count inconclusive results as verified successes.

## Mobile tests

Use actual supported mobile devices.

Test Safari iPhone, Safari iPad and Firefox Android independently.

## Visual regression

Capture approved screenshots for important interfaces and viewport sizes.

Investigate unexpected differences.

Require review before accepting new baselines.

## Telemetry tests

Use synthetic data.

Verify:

- No outbound transmission by default.
- No production transport configured.
- No telemetry without opt in.
- Rejection of prohibited payload fields.
- Correct aggregation.
- Withdrawal state behaviour.
- No effect on consent functionality.
- Correct handling of small samples.
- No unauthorised publication.

---

# 21. Formal Quality Gate

The minimum overall quality score is **8/10**.

This threshold is mandatory but does not override critical failures.

## Quality rubric

| Dimension | Weight |
|---|---:|
| Consent correctness and verification | 25% |
| Privacy and security, including telemetry controls | 20% |
| Reliability and compatibility | 15% |
| Functional completeness | 15% |
| Usability and accessibility | 10% |
| Engineering quality | 10% |
| Documentation and transparency | 5% |
| **Total** | **100%** |

Score every category from 0 to 10 using inspectable evidence.

Calculate the weighted result.

Do not use subjective impressions as a substitute for tests.

## Mandatory release blockers

A production release must not proceed if:

- Unauthorised consent acceptance is detected.
- A claimed success lacks required verification.
- A critical security vulnerability remains unresolved.
- Known extension behaviour breaks login or checkout in the defined tests.
- User preferences are silently lost.
- Prohibited telemetry is transmitted.
- Production telemetry is activated without approval.
- Mandatory browser tests fail.
- Required licence obligations are unresolved.
- Essential functionality is inaccessible.

## Prototype targets

- At least 25 of 30 test sites handled.
- All claimed successes verified.
- Zero observed unauthorised acceptance.
- Zero observed login or checkout breakages in defined tests.

## Production targets

- At least 95% verified handling on the maintained test panel.
- 100% verification coverage for outcomes labelled successful.
- Zero known critical safety or security failures.
- Mandatory compatibility tests passing on every advertised platform.

These are engineering targets, not claims of current performance.

## Iteration process

Claude Code must:

1. Run tests.
2. Assess quality.
3. Identify defects.
4. Fix defects.
5. Run regression tests.
6. Recalculate the score.
7. Continue until quality reaches at least 8/10 and every mandatory release gate passes.

If a blocker cannot be resolved, report it and leave the release blocked.

Never fabricate passing tests or inflate quality scores.

---

# 22. Telemetry Activation and Publication Governance

Create an explicit governance document:

```text
docs/telemetry/decision-register.md
```

Initial states:

| Decision | State |
|---|---|
| Telemetry architecture | Approved |
| Synthetic telemetry tests | Approved |
| Production telemetry collection | Undecided |
| Telemetry backend deployment | Undecided |
| Public aggregate reporting | Undecided |
| Commercial intelligence use | Undecided |

Do not change an undecided state without explicit approval.

## Activation gate

Before production telemetry can be enabled, require:

1. Approved data inventory.
2. Approved processing purposes.
3. Legal basis review.
4. Consent experience review.
5. Privacy policy update.
6. Security and privacy impact assessment.
7. Data retention policy.
8. Infrastructure approval.
9. Browser store policy review.
10. Explicit product owner approval.

## Publication gate

Before public analytics can be published, require:

1. Approved methodology.
2. Disclosure control assessment.
3. Representativeness review.
4. Sample size and uncertainty disclosure.
5. Legal wording review.
6. Editorial independence review.
7. Human publishing approval.

Collection approval does not grant publication approval.

Publication approval does not authorise additional collection.

---

# 23. Release Management

Create:

```text
docs/qa/release-checklist.md
docs/qa/quality-score.md
docs/qa/test-evidence.md
docs/qa/implementation-status.md
docs/compatibility/platform-matrix.md
docs/security/threat-model.md
docs/security/security-review.md
docs/privacy/data-flows.md
docs/telemetry/decision-register.md
docs/telemetry/data-dictionary.md
docs/telemetry/privacy-design.md
docs/telemetry/publication-methodology.md
docs/legal/licence-audit.md
docs/store/permissions.md
CHANGELOG.md
THIRD_PARTY_NOTICES.md
```

Every release must include:

- Release version.
- Supported platforms.
- Test results.
- Verified consent success rate.
- Known limitations.
- Security findings.
- Accessibility findings.
- Quality score.
- Telemetry status.
- Release blockers.
- Release decision.

Maintain reproducible builds, versioned artifacts and rollback documentation.

---

# 24. Distribution and Legal Documentation

Prepare accurate store documentation for each platform.

## Chrome Web Store

Include:

- Single purpose statement.
- Privacy policy.
- Permission explanations.
- Data handling declarations.
- Screenshots.
- Support details.
- English and French copy.

## Firefox Add ons

Prepare Firefox compatible builds and required disclosures.

## Safari and Apple Platforms

Prepare:

- Native application wrapper.
- Safari extension.
- Signing.
- App Store metadata.
- Privacy disclosures.
- Compatibility information.

## Branding

Use:

- `{{EXTENSION_NAME}}`
- `{{PIEVRA_CONTACT}}`
- `{{PIEVRA_LEGAL_ENTITY}}`

Centralise product branding in the configuration and localisation system.

Do not invent a product name or legal details.

## Privacy documentation

Explain:

- Local consent storage.
- Optional browser sync if subsequently introduced.
- Optional Pievra telemetry if activated.
- Data categories.
- Retention.
- Withdrawal.
- Deletion.
- Browser permissions.
- Technical audit limitations.

Do not claim that no data leaves the device once any optional telemetry transmission is enabled.

---

# 25. Milestones

## Milestone 0 — Architecture and feasibility

Deliver:

- Repository inspection.
- Dependency and licence assessment.
- Browser capability matrix.
- Threat model.
- Consent purpose mapping.
- Storage design.
- Telemetry architecture proposal.
- Telemetry decision register.
- Acceptance test strategy.

## Milestone 1 — Chromium consent core

Deliver:

- WXT scaffold.
- Shared consent engine.
- Default refusal.
- Autoconsent integration.
- Consent state machine.
- Verification framework.
- Local storage.
- Unit tests.

## Milestone 2 — Preference management

Deliver:

- Six purpose model.
- Versioned mappings.
- Mixed preferences.
- Site overrides.
- Global defaults.
- Pause feature.
- Persistence tests.

## Milestone 3 — User interface

Deliver:

- Popup.
- Options dashboard.
- Bulk actions.
- Import and export.
- Onboarding.
- Localisation.
- Accessibility.
- Responsive design.

## Milestone 4 — Privacy auditing and GPC

Deliver:

- GPC.
- Technical privacy checks.
- Evidence capture.
- Classification engine.
- User facing explanation.
- Audit methodology.

## Milestone 5 — Telemetry readiness, disabled

Deliver:

- Telemetry schemas.
- Consent state design.
- No operation transport.
- Data minimisation rules.
- Synthetic aggregation tests.
- Telemetry settings design.
- Privacy documentation.
- Publication methodology draft.

Do not deploy a production telemetry endpoint.

Do not send real user data.

## Milestone 6 — Chromium quality and release

Deliver:

- Security review.
- Real site tests.
- Accessibility verification.
- Visual regression.
- Release quality score.
- Store documentation.
- Production candidate.

## Milestone 7 — Desktop expansion

Deliver:

- Firefox desktop adapter.
- Safari macOS adapter.
- Platform specific testing.
- Compatibility documentation.
- Independent release approval.

## Milestone 8 — Mobile expansion

Deliver:

- Safari iOS packaging.
- Safari iPadOS packaging.
- Firefox Android implementation.
- Mobile UI validation.
- Real device testing.
- Mobile security review.
- Independent release approval.

## Milestone 9 — Ongoing quality

Deliver:

- CMP rule maintenance.
- Regression automation.
- Browser compatibility monitoring.
- Dependency management.
- Security updates.
- Release governance.
- Telemetry readiness review when authorised.

---

# 26. Claude Code Execution Rules

Act as the lead engineer, privacy engineering specialist, security reviewer and QA owner.

## Inspect first

Read the repository and existing implementation.

Identify:

- Existing architecture.
- Dependencies.
- Tests.
- Security gaps.
- Missing requirements.
- Browser limitations.
- Relevant available tools.

Do not overwrite valid work without understanding it.

## Plan

Prepare a milestone implementation plan.

Include:

- Files to change.
- Architectural choices.
- Dependencies.
- Security implications.
- Tests.
- Acceptance criteria.
- Unresolved decisions.

## Implement

Execute approved work systematically.

Use available tools where appropriate, including GitHub, Playwright, Context7, Frontend Design and browser developer tools.

Do not claim to have used a tool unless it was available and executed.

## Verify

After meaningful changes:

- Run TypeScript checks.
- Run unit tests.
- Run integration tests.
- Inspect permissions.
- Review security.
- Verify relevant UI states.
- Check for regressions.

## Assess quality

Generate an evidence based quality assessment.

Fix the highest priority issues.

Rerun tests.

Do not mark work as verified without evidence.

## Do not ask unnecessary questions

Proceed independently on ordinary engineering decisions.

Require explicit approval for:

- Telemetry activation.
- Backend deployment.
- Public data publication.
- New personal data collection.
- Licence or legal model changes.
- Invasive permissions.
- Destructive data changes.
- Paid services.
- Production store publication.

If an unresolved decision affects a future capability but does not block current work, document it and continue with the approved scope.

---

# 27. Definition of Done

A milestone is complete only when:

1. Required functionality is implemented.
2. Consent claims have appropriate verification.
3. Security controls are tested.
4. User privacy requirements are met.
5. Core functionality is independent of telemetry.
6. Accessibility requirements are met.
7. Relevant browsers are tested.
8. No mandatory blockers remain.
9. Quality reaches at least 8/10.
10. Documentation and release evidence are complete.

Telemetry architecture can be complete whilst production telemetry remains disabled.

A platform cannot be marked supported without platform specific tests.

Do not confuse implementation completion with production authorisation.

---

# 28. Final Instructions

Build Pievra Consent Memory as a trustworthy, open source privacy product with the architectural option to become an independent privacy intelligence platform.

Prioritise user control, verified consent outcomes, security, reliability and transparency.

Preserve the three strategic release decisions:

**First:** Desktop and mobile are separate release tracks sharing one consent core. Each platform requires its own compatibility and acceptance tests.

**Second:** Consent verification is distinct from privacy compliance assessment. Technical observations must not be represented as definitive legal conclusions.

**Third:** The minimum 8/10 quality score is a mandatory publishing gate, but critical privacy, consent or security failures always block release regardless of score.

Prepare the optional Pievra telemetry capability without activating real data collection.

Preserve the undecided status of telemetry collection and publication until explicit approval is provided.

Do not build or deploy an analytics backend, transmit user telemetry or publish aggregate results without the relevant approval.

Continue implementing, testing and improving the authorised milestone until the quality threshold and all mandatory gates are satisfied.

If an unresolved issue prevents completion, document the blocker, supporting evidence, risk and proposed resolution. Never claim completion without verification.

Start by auditing the existing repository against this entire specification. Produce a prioritised gap analysis, architecture plan, platform compatibility assessment and telemetry decision register. Then implement the first authorised milestone.
