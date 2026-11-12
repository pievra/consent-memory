# Purpose level execution

Status: built, on (`features.purposeLevelExecution`), one adapter (Cookiebot). 2026-11-11.

## What it does

When the choices for a site mix "allow" and "refuse", and the site's consent tool has a **purpose adapter**, the extension sets each purpose the tool offers and then reads back what the tool stored. Everywhere else a mixed choice is still applied as a refusal of everything, and the allowed purposes are reported as not granted.

All refused (the default) and all six allowed are unchanged: they use the whole banner refusal and acceptance.

## Rules an adapter must meet

1. **Fixed meaning.** The tool's categories mean the same thing on every site that uses it. Nothing is inferred from position, wording or a site's configuration.
2. **Documented interface.** Purposes are set through the tool's own published interface, not by clicking through its settings screens.
3. **Readable result.** The tool exposes what it stored, so the outcome can be verified purpose by purpose.

## Cookiebot adapter

| Cookiebot category | Purpose | Set with | Read from |
|---|---|---|---|
| Preferences | `preferences` | `Cookiebot.submitCustomConsent(preferences, statistics, marketing)` | `Cookiebot.consent.preferences` |
| Statistics | `analytics` | same | `Cookiebot.consent.statistics` |
| Marketing | `advertising` | same | `Cookiebot.consent.marketing` |

Not offered by Cookiebot: `storage`, `content`, `other`.

**Implied purposes.** Each optional Cookiebot category works by storing cookies, and Cookiebot has no separate storage category. A category is therefore granted only if the user allowed it **and** allowed `storage`. With `storage` refused, nothing can be granted and everything is refused. "Marketing" is mapped to `advertising` only; a user who allows `content` or `other` is told those could not be granted.

Rule in general: an offered purpose is granted only if the user allowed it and everything granting it implies. Nothing the user refused is brought about as a side effect.

## Outcomes

| Situation | Result |
|---|---|
| Tool reports every offered purpose as asked, and no allowed purpose is left ungranted | Verified, shown as "Choices applied and confirmed" |
| Same, but an allowed purpose is not offered by the tool | Partial, naming the purpose |
| Tool reports a purpose that should be off as on | Failed. Never a success |
| Tool reports a purpose that should be on as off | Partial |
| Tool has not recorded an answer | Applied, not confirmed |
| The interface is missing on this page | Falls back to refusing everything |

## Controls

- Top level page only; never from inside a frame.
- The page script names the consent tool and nothing else. The background decides what to switch on from the stored choices for the site.
- The site is taken from the address of the document that sent the request, and the functions are injected into that one document by the browser's document identifier. If the tab has moved, the browser refuses the injection.
- The submission is sent once. Silence is never treated as "not applied", so the run cannot both submit and fall back to clicking.
- A report carrying per purpose evidence is accepted only from a top level page whose consent tool has an adapter.

## Evidence from real sites, 2026-11-11

Chrome for Testing 156, from a server in Germany, fresh profile each time. The last column is the site's own `CookieConsent` cookie after the run.

| Site | Allowed | Result | Stored by the site |
|---|---|---|---|
| cookiebot.com | storage, analytics | Verified | preferences false, statistics true, marketing false |
| dr.dk | storage, analytics, preferences | Verified | preferences true, statistics true, marketing false |
| berlingske.dk | storage, advertising | Verified | preferences false, statistics false, marketing true |
| dr.dk | analytics (storage refused) | Partial: everything refused, analytics reported as not granted | all false |
| dr.dk | nothing | Verified refusal | all false |

Three sites, one visit each: enough to show the interface behaves as documented, not a measure of coverage.

## Consent-O-Matic: assessed, not used

The original plan (specification section 7) was to bundle Consent-O-Matic's rules (MIT, commit `8ca8500`, 44 consent tools) for this feature. Reading the rules showed two properties that conflict with this product's first rule, never to grant what the user did not allow:

1. **Categories are assigned by position or by one site's identifiers.** The Tealium rule maps `toggle_cat1` to analytics, `toggle_cat3` to advertising, and so on; the OneTrust rule assigns categories by the order of the tabs. Sites configure these differently, so on another site the same rule can switch on a different purpose from the one the user allowed. Outside TCF sites nothing would detect it.
2. **A "save" step can fall through to an accept button.** The Cookiebot rule's save step ends by clicking `#CybotCookiebotDialogBodyButtonAccept`, which is the "Allow all" button in current Cookiebot layouts.

Those rules are good at what Consent-O-Matic uses them for most, switching everything off. For granting selected purposes they would need each rule to be reviewed and tested against live sites. Adapters over documented interfaces were chosen instead: fewer consent tools, and every result checkable.

No Consent-O-Matic code or data ships in the extension.

## Next adapters, in order of how well they meet the rules

| Tool | Fixed categories | Interface | Note |
|---|---|---|---|
| CookieYes | Yes | Partly documented | Candidate |
| Complianz | Yes | Documented | Candidate |
| Osano | Yes | Documented | Candidate |
| OneTrust | No: sites define their own groups; default codes are common but not guaranteed | Documented | Needs a safe way to recognise a group's meaning |
| TCF based tools (Didomi, Sourcepoint, Quantcast) | Yes for TCF purposes | No standard interface to set purposes | Verification exists; setting does not |
