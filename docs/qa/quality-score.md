# Quality score

Date: 2026-11-11, after the welcome page, six security review rounds, the 30 site run and purpose level execution. Scored against the release rubric in specification section 21, which measures the product. Each score is tied to counts in `test-evidence.md`. Nothing is scored on expectation.

| Dimension | Weight | Score | Evidence | What raises it |
|---|---:|---:|---|---|
| Consent correctness and verification | 25% | 7 | 20 consent and audit browser tests on local fixtures; 0 accept clicks in every refusal scenario. Real sites: 30 site run from a server (16 reached; of 8 banners with a refusal route, 6 answered and 5 verified; 2 pay walls left alone; 0 accepted), plus one person's 5 sites. The specification's target of 25 of 30 handled is unmeasured: 14 sites refused the server | The panel from ordinary browsers in the three countries; a second evidence source for common consent tools |
| Privacy and security, including telemetry controls | 20% | 8 | 0 extension requests by capture and bundle scan; 4 permissions, each justified; telemetry absent from the package and unimportable by lint; 19 review findings over 6 rounds, all fixed with tests, 6 low or informational items open; credential pattern scan; bill of materials. No human security review | A human review; a full secret scanner; reproducible build |
| Reliability and compatibility | 15% | 7 | Restart, worker termination, reload, storage cap and quota warning tested. All browser tests pass on Chrome for Testing 156, Chromium in CI and Microsoft Edge 156 in CI. No breakage observed on 16 real sites. Not run on Windows; Edge not used by a person | Windows; breakage data from a person-run panel |
| Functional completeness | 15% | 9 | All 7 specified capabilities usable: automatic handling, purpose level preferences (executed and verified on Cookiebot, 3 real sites; refusal of everything elsewhere), consent memory, verification, dashboard with onboarding, Global Privacy Control, technical audit; telemetry scaffold built and disabled as specified | Purpose adapters for more consent tools |
| Usability and accessibility | 10% | 7 | Popup, settings, welcome page in English and French; 0 serious or critical automated accessibility findings on all three; keyboard test; no overflow from 320 to 1440 px; one non-technical person completed a 5 site test. No screen reader test, no manual accessibility review | Manual review with a screen reader |
| Engineering quality | 10% | 8 | Strict TypeScript, 0 lint errors, 209 unit and 55 browser tests, two browsers gated in CI, pinned dependencies, install scripts off | Coverage measurement |
| Documentation and transparency | 5% | 9 | Specification, threat model, security review, permissions, data flows, privacy policy (English, French), store listing draft, release checklist, audit methodology, evidence with stated limits | Published policy; screenshots |

**Weighted score: 7.70 / 10** (1.75 + 1.60 + 1.05 + 1.35 + 0.70 + 0.80 + 0.45). Previous: 7.55.

## Release decision

**Blocked on the score alone.** No mandatory blocker is open: no unauthorised acceptance, unverified success claim, prohibited telemetry or silent preference loss has been observed in any test or on any real site; licence obligations are met; the browser suite passes on Chrome and Edge.

## What stands between here and 8

| Step | Needs | Effect on the score |
|---|---|---:|
| The 30 site panel from ordinary browsers in France, the United Kingdom and Saudi Arabia, meeting the 25 of 30 target or explaining each miss | People in those countries, or approval of a paid testing service | Consent correctness 7 to 8: +0.25 |
| A run on Windows (Chrome or Edge) by a person | A person with Windows | Reliability 7 to 8: +0.15 |
| Manual accessibility review with a screen reader | A person | Usability 7 to 8: +0.10 |

Those three bring the score to 8.20; the first alone brings it to 7.95, the first two to 8.10. None can be produced from this server: each needs a person's browser.
