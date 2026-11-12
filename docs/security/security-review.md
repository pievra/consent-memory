# Security review — version 0.1.0

Date: 2026-11-11. Scope: the Chromium extension up to and including purpose level execution, measured against `docs/security/threat-model.md`.

## How it was reviewed

| Round | When | Who | Method |
|---|---|---|---|
| 1 to 4 | 2026-11-10 to 2026-11-11 | Automated review of each change before merging | Diff review of pull requests 4, 5, 8 and 10 |
| 5 | 2026-11-11 | An independent reviewer (a separate AI agent given the code and the threat model, not the author's conclusions) | Read-only review of the whole tree |
| 6 | 2026-11-11 | An independent reviewer, same arrangement | Read-only review of the purpose level execution change |
| 7 | 2026-11-11 | An independent reviewer, same arrangement | Read-only review of the wall wording and the objection to legitimate interest |

Limits, stated plainly: every reviewer so far is an AI system. No human security professional has reviewed the code and no penetration test has been run. The independent reviewer read the code and did not run the browser tests. This document records what was looked at and what was found; it is not a certification.

## Findings and their state

Severity is the reviewer's. "Fixed" means the code changed and a named test now fails if the fix is removed.

| # | Round | Severity | Finding | State | Test |
|---|---|---|---|---|---|
| 1 | 1 | High | A frame from another site could have its result recorded as the top site's verified result | Fixed: a cross-site frame can never assert success | `storage.test.ts`, "reports from an embedded frame on another site" |
| 2 | 2 | High | The top page's consent state was read using an address supplied by the page | Fixed: the read is pinned to one document by the browser's document id, with the tab address checked before and after, and needs a completed user action in this page load | `storage.test.ts`, `topFrameSnapshotFor` |
| 3 | 2 | Medium | An attempt reported by another site's frame could later be rechecked and shown as verified | Fixed: recheck only for the site's own attempt, same consent tool, within 10 minutes | `storage.test.ts`, `resumableCmp` |
| 4 | 3 | Medium | A banner disappearing was being counted as verification for 180 rules | Fixed: only checks that read stored state count; the background rejects a report that claims more | `helpers.test.ts`, state test classification |
| 5 | 4 | Medium | A frame from another site could conclude or distort a page's audit | Fixed: audit events are bound to the tab's site and page load; another site's claim is held until the page's own state confirms it | `audit.test.ts`, `claimActed`, `confirmClaim`, `settleClaims` |
| 6 | 4 | Low | Global Privacy Control registration was removed and re-added at each start, leaving a gap | Fixed: updated in place | `gpc.spec.ts` |
| 7 | 5 | **High** | **Import preview hid widened consent.** A shared file with no sites could switch every default to "allow"; the preview showed "0 new, 0 different" and one click applied it, after which the extension would accept on every site. Imported settings were also written without validation | Fixed: the preview counts everything a file would allow (defaults, new sites, changed sites), lists it, and both buttons stay disabled until a separate box is ticked. Settings are validated before writing | `preferences.test.ts`, "switches every default to allow"; `ui.spec.ts`, "an import that would allow everything" |
| 8 | 5 | Medium | A site could cut its own audit short (navigation that never commits, or a prerendered page), so "tracking before consent" could read "passed" on incomplete evidence | Fixed in part: prerendered and inner documents no longer end an audit; "passed" now needs the unanswered banner to have been watched until the refusal or for 8 seconds, otherwise "inconclusive". Open: the audit is still ended by a request, not by the page actually changing (see residual risks) | `audit.test.ts`, "a page that leaves at once" |
| 9 | 5 | Medium | Nothing limited the number of stored sites; a hostile page chaining many hosts could fill storage until the user's own changes failed | Fixed: 4,000 site cap with eviction of the oldest records that hold no user choice; quarantine capped at 20; a frame from another site no longer creates a record by merely containing a consent tool. The settings page warns at 80% of the quota | `preferences.test.ts`, "bounded storage"; `storage.test.ts`, "creates no record" |
| 10 | 5 | Low | Pausing an IPv6 address made every later Global Privacy Control update fail silently | Fixed: such addresses are left out of the exclusions | `gpc.test.ts`, "IPv6 literals" |
| 11 | 5 | Low | A frame from another site could displace the site's own pending attempt | Fixed | `storage.test.ts`, "cannot displace an attempt" |
| 12 | 5 | Low | The diagnostic download listed every site in plain text with browser details | Fixed: site names are replaced by numbers and language and time zone omitted unless the user ticks a box | `consent.spec.ts`, results page test |
| 13 | 5 | Low | Build checks: dependency audit ran after the package was kept; bundle scan missed `Function(` without `new` and string timers; nothing stopped shipped code importing the telemetry module | Fixed: audit runs first; scan extended; lint rule forbids importing `src/telemetry` from anything that ships | CI |
| 14 | 5 | Info | A lookup used `in` on an object, matching inherited keys | Fixed | — |
| 15 | 6 | Medium | **Choices for one site could be submitted on another site's page.** The purpose submission targeted "the tab's top frame", and the worker can take seconds to start. If the tab moved in between (a link, or a hostile page calling `history.back()` to a site on the same consent tool), site A's allowed purposes would have been submitted on site B | Fixed before merging: the submission and the read are injected into the one document that asked, by the browser's document identifier, and the site is taken from that document's address | `purposes.test.ts`, "document identifier"; `purposes.spec.ts`, "never submitted on another site" |
| 16 | 6 | Medium | **A refused purpose could happen as a side effect.** Cookiebot has no storage category, so granting statistics stores cookies even when the user refused "storage and access"; the run was still reported verified | Fixed: an offered purpose is granted only if everything it implies is allowed too | `purposes.test.ts`, "never brings about a refused purpose"; `purposes.spec.ts`, "without storage and access" |
| 17 | 6 | Low | A submission that got no answer was retried and could be followed by a fallback refusal as well | Fixed: sent once; silence leads to a read, never to clicking | `purposes.test.ts`, run tests |
| 18 | 6 | Low | An answer stored on an earlier visit could be read as the new one (errs towards "not confirmed") | Fixed: the read repeats until the state matches, and reports the last state seen | `purposes.spec.ts`, "sticky", "drop" |
| 19 | 6 | Low | Audit "after refusal" checks were skipped after a fallback refusal; a status label could be switched by a stray evidence line; one stale sentence | Fixed | — |

## Round 7 (2026-11-11): "accept or pay" wording and objection to legitimate interest

An independent reviewer (a separate AI agent, read-only, same arrangement as rounds 5 and 6) reviewed the `page:wall` message and the Didomi objection step. Nothing above Low. All four findings were fixed before merging.

| # | Severity | Finding | State | Test |
|---|---|---|---|---|
| 20 | Low | The wall label could outlive the wall: it was cleared only by a later report, and a site whose consent tool stops loading sends none | Fixed: the mark is a dated field (`wallSeenAt`) that lapses after 7 days, and is removed by any report | `storage.test.ts`, "lapses on its own" |
| 21 | Low | The objection was run through the general snippet message, so the background did not check pause, plan or which site the frame was on. Refusal only, but an action the extension starts itself | Fixed: its own message (`page:object`); the background requires the browser's document identifier, the page itself or a frame on its own site, a site that is not paused and a stored plan that is a refusal, and picks the snippet itself | `consent.spec.ts`, "paused site"; "allowed everything" |
| 22 | Low | Page injections fell back to an unpinned target when the browser gave no document identifier | Fixed: no identifier, no injection; `minimum_chrome_version` set to 120 | manifest test |
| 23 | Info | The wall label was driven by an evidence line, which a report's free `reason` field could in principle spell | Fixed by 20: a field of its own that reports cannot set | `storage.test.ts`, "cannot be set through a report" |

Checked and found sound by the reviewer: a wall or objection from another site's frame is refused; `applyWall` creates no record and touches no status, choice or date; nothing is clicked on a wall; the objection runs only after a successful refusal, never after an acceptance or a per purpose submission; its result decides nothing; no earlier fix is weakened. Limit: the reviewer read code and did not run a browser.

## Change after round 7: results download (2026-11-12)

Finding 12 was fixed by a tick box that had to be ticked for site names to be included. A tester sent the wrong kind of file twice because of it. The page now has two buttons, "Download with site names" and "Download without site names", each stating what the file contains, with the consequence written underneath. Site names still leave the device only by the user's explicit act and never by default; the file is saved locally and nothing is sent. Not separately reviewed. Test: `consent.spec.ts`, results page test.

## Open items (none is a release blocker under specification section 21)

| # | Severity | Item | Why it is open |
|---|---|---|---|
| A | Low | The package manager version is pinned (`pnpm@12.18.0`) without an integrity hash | Needs the hash from the registry; the lockfile's own integrity hashes cover every dependency |
| B | Low | No reproducible-build check | Not built |
| C | Low | Secret scanning is a pattern script (10 formats over tracked files), not a full scanner with history | A fuller scanner could not be run in this environment |
| D | Low | The audit for a page ends when the tab requests a new page, not when the new page is shown | Doing better needs another permission (`webNavigation`). Mitigated by finding 8's rule |
| E | Info | The safety check skips a page only when a password or card field already has content | By design for now; recorded as a limit in the threat model (T11) |
| F | Info | Migration does not read back what it wrote | A backup is taken before migration and restored on failure |

## Controls checked and found implemented (round 5)

- A web page cannot reach the settings interface: it is open only to the extension's own pages in a top frame; there is no `externally_connectable` and no web accessible resource.
- No write to another site's record is possible: the site key always comes from the browser's sender data.
- No injection into extension pages: there is no `innerHTML`; all text is rendered as text.
- No network request and no dynamic code in source or bundle; extension pages carry `connect-src 'none'`.
- Telemetry is unreachable from anything that ships.
- Acceptance requires all six purposes to be allowed by the user, never by a default.
- Rules are bundled and pinned; heuristics, generated rules and cosmetic rules are off.

## Not verified by any reviewer

- Behaviour on Microsoft Edge or on Windows.
- Chrome's exact request fields for prerendered pages (finding 8 relies on documented behaviour).
- Limits on reloads and retries at run time on real sites (covered by local fixtures only).
