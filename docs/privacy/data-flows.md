# Data flows — version 0.1.0

## Summary

The extension makes no network request of its own (checked by capture and by bundle inspection on every build), and none of the stored data leaves the device. One thing is added to the requests your browser already makes: the Global Privacy Control header, described below.

## What is stored, where, and why

| Data | Where | Written when | Removed by |
|---|---|---|---|
| Default choices for six purposes | `storage.local`, key `settings` | The user changes a default | Delete everything |
| Per site record: registrable domain, the user's choices for that site, pause flag | `storage.local`, key `site:<domain>` | A known consent tool is found on the site, or the user sets a choice or pause for it | Forget (per site or bulk), delete everything |
| Per site result: status, consent tool name, short evidence lines, dates of last attempt and last confirmation, who made the attempt | Same record | After a run | Same |
| Per site audit: outcome of six technical checks, and for two of them up to 10 tracking service domains from a bundled list | Same record | A few seconds after a visit where a known banner was open | Automatically after 90 days; forget; delete everything |
| Per tab observation in progress: service domains seen on the current page | `storage.session` (memory only) | While a page is open | When the page is left or the browser closes |
| Store metadata: schema version, creation date | `storage.local`, key `meta` | First start | Uninstalling |
| Quarantined records that failed validation | `storage.local`, `quarantine:*` | A stored record is found corrupt | Delete everything |

Not stored: sites where no known consent tool was found and no choice was set; URLs, paths, page titles or content; cookie names or values; request hosts; anything typed into a page.

`storage.sync` is never used, so nothing is copied to a browser account.

## Flows inside the browser

```text
web page ──(DOM read, clicks on the consent tool's own controls)── content script
content script ──(validated messages)── background ──(validated writes)── storage.local
background ──(bundled check functions, read only TCF listener)── web page's own JavaScript world
popup / settings ──(validated messages, extension pages only)── background
settings ──(user initiated download)── a file on the user's disk
a file chosen by the user ──(validated, choices only)── background
```

## What a website can learn

That a refusal was made through its consent tool's own controls, as for any visitor who clicks "reject".

With Global Privacy Control on (the default), every request to a site that is not paused carries the header `Sec-GPC: 1`, and pages can read `navigator.globalPrivacyControl === true`. This is a one bit signal, the same for every user who has it on; it carries no identifier. It does make the browser slightly more distinguishable from one that does not send it. It can be switched off in settings.

## Exports

Two user initiated downloads: choices (`consent-memory-choices-<date>.json`) and, on the diagnostic results page, results (`consent-memory-results-<date>.json`, which also records the browser's user agent string, languages and time zone). Both list the domains held in storage. They are written by the browser to the user's disk and go nowhere else.

## Telemetry

Not present in any build. See `docs/telemetry/`.
