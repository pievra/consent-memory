# Technical privacy audit — methodology

Version 1, 2026-11-11. Tracker list version 2026.11.2 (65 services).

## What it is

Six technical observations made by the extension on a page where a known consent banner was open. They describe what the browser could see. They are **not** a legal assessment: a request to a tracking service can be necessary or lawful, and the absence of a signal does not show compliance. No score is computed and nothing is published.

## When it runs

Only on pages where a recognised consent tool showed a banner, on a site that is not paused. Sites without a known banner are not audited and nothing about them is stored.

| Moment | What is recorded |
|---|---|
| Arrival | Listed services the page contacts, from the first request |
| Banner found, before any action | The page's own consent state (TCF) and US privacy string, read once |
| Refusal steps complete | The split between "before" and "after" |
| 8 seconds after the run ends, or when the page is left | The six checks are written to the site record |

## What counts as a tracking request

A request from the page to a domain on the bundled list (`src/audit/trackers.ts`), or a subdomain of one, where that domain belongs to a different site from the page. Only the listed service domain is kept — never the URL, path, query string or any identifier. At most 25 services per phase.

The list is this project's own compilation of 65 well known advertising and analytics services. It is short on purpose. Consequences, stated with every result ("checked against 65 well known tracking services"):

- A service that is not listed is not seen. "Passed" means "none of the listed services", not "no tracking".
- Tag loaders (for example googletagmanager.com) are not listed: loading a container is not itself tracking.
- First party tracking is not seen.

## The six checks

| Check | Passed | Signal detected | Inconclusive | Not applicable |
|---|---|---|---|---|
| Tracking before consent | No listed service contacted before the refusal completed | At least one was; services named | — | — |
| Tracking after refusal | None contacted in the 8 seconds after the refusal | At least one was; services named | The page was left before 8 seconds had passed | Nothing was refused (the user allowed everything, or no action ran) |
| Refusal accessibility | The refusal took 1 click | It took 2 or more; count given | Click count unknown, or the refusal went through the tool's API | Nothing was refused |
| Optional purposes preselected | TCF state "banner shown" with 0 purposes consented | Same state with 1 or more purposes already consented | No TCF state, or not in the "banner shown" state | — |
| Consent information available | The page exposes a TCF state | — | It does not | — |
| Behaviour associated with GPC | US privacy string shows an opt out | String shows no opt out although the signal was sent | String unreadable or has no opt out field | GPC is off, or the site exposes no US privacy string |

Missing evidence is always "inconclusive". It is never counted as "passed".

## Presentation

"N checks passed, N signals detected, N inconclusive", then each check with a sentence. Wording avoids "compliant", "illegal", "violation". Checks that do not apply are not listed.

## Known limits

- One visit, one page, one location. Sites behave differently by visitor country, device and time.
- 8 seconds after a refusal does not capture later requests.
- Requests made by a service worker of the site, and requests from tabs opened before the extension started, may not be attributed.
- If the browser stops the extension's background while a page is open, observation continues from stored state, but a burst of requests during the restart can be missed.
- A banner inside a frame that closes itself may conclude only when the page is left.
- The "refusal accessibility" count is what the automation needed, which is a proxy for what a person would need.

## Observed on real sites (exploratory, 2026-11-11, one visit each, server in Germany)

| Site | Before consent | After refusal | Steps |
|---|---|---|---|
| hsbc.co.uk | Passed | Passed | 1 |
| bt.com | Passed (after the tag loader was removed from the list) | 1 service | 1 |
| jarir.com | 4 services | Passed | Not observed (API) |
| bbc.com | Passed | 7 services | Not observed |

Four sites from one location: an illustration of the output, not a finding about those sites.

## Retention

Audit observations are removed 90 days after they were made. The user's choices and the consent result are kept.
