# Publication methodology — draft

Status: **draft for a decision that has not been taken.** Public aggregate reporting and commercial use are undecided (`decision-register.md`, Decision C). Nothing may be published from users' data under the current states. This draft exists so that the decision, if taken, starts from written rules.

## 1. What a published figure may say

A technical observation about consent handling attempts, never a statement about websites' legal compliance.

- Allowed: "Of N observed refusal attempts on OneTrust banners in the period, X% were confirmed by the banner's own stored state."
- Not allowed: "X% of websites comply with GDPR", any ranking of named sites, any score for a named site.

## 2. Definitions fixed before any figure

| Term | Definition |
|---|---|
| Attempt | One `consent_action_outcome` record |
| Verified rate | `verified` ÷ all attempts with any status. `inconclusive`, `attempted`, `partial`, `failed` stay in the denominator and never in the numerator |
| Period | Whole ISO weeks, stated |
| Population | Opted in users of the extension on the stated browsers. Stated with every figure: it is self selected and not representative of web users or of websites |

## 3. Minimum conditions for one figure

1. At least 200 contributing batches and 2,000 attempts in the cell. Smaller cells are not shown.
2. No cell that differs from a previously published cell by fewer than 200 batches (differencing).
3. CMP families with fewer than 50 contributing batches are reported inside "other".
4. Uncertainty shown as a 95% interval; the method named.
5. The engine and rule versions in the period are listed, because a rule change moves the figures.
6. A named person signs off each release. No automated publication.

These thresholds are proposals. They are not a guarantee of anonymity: repeated releases, small markets and rare CMPs each need a disclosure assessment at the time, and formal differential privacy should be evaluated if releases become regular.

## 4. Independence

No ranking, score or verdict is sold or influenced by a commercial relationship. Any commercial use of aggregates needs its own disclosure, a purpose compatibility assessment and a separate approval.

## 5. Corrections

Each release names a contact for corrections and states how a correction is published. Site owners are not named, so there is no per site appeal; a methodology challenge is answered in public.

## 6. Guard in code

No code path exports aggregates outside tests. Any publication tooling written later must refuse to run unless the register row "Public aggregate reporting" reads "Approved".
