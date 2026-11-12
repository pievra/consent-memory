# Permissions — Chromium, version 0.1.0

Checked on every build by `scripts/check-bundle.mjs` and in the browser by `tests/e2e/consent.spec.ts`.

| Permission | Why it is needed | What it is not used for |
|---|---|---|
| `storage` | Keeps preferences and per site results in `storage.local` on the device | `storage.sync` is never called |
| `scripting` | Runs, in the page's own JavaScript world, (a) check functions shipped inside the Autoconsent package, selected by identifier, to read what a CMP stored, and (b) a read only TCF API reader. Without it no result can be verified | No code string from a page or a message is ever executed |
| `declarativeNetRequestWithHostAccess` | Adds the request header `Sec-GPC: 1` (Global Privacy Control) through one browser managed rule. This variant was chosen over `declarativeNetRequest` because it works only on sites the extension already has access to and adds no install warning | No request is blocked, redirected or read. The rule changes one header and nothing else; it is removed when GPC is switched off and excludes paused sites |
| `webRequest` | Lets the technical audit see which addresses a page contacts, so it can report listed tracking services contacted before consent and after refusal. Observation only | No request is blocked, delayed or changed (the extension does not have `webRequestBlocking`). Only the matching service domain from a bundled list of 65 is kept, per page, and only for pages where a known banner was open. No URL, path or query string is stored |
| Host access `http://*/*`, `https://*/*` | Consent banners appear on any site; the content script must run there to detect and answer them | No page content, form input or URL is stored or sent anywhere. Only the site's registrable domain is stored, and only for sites where a recognised CMP was found |

Not requested: `cookies`, `webRequestBlocking`, `declarativeNetRequest` (the broader variant), `tabs`, `activeTab`, `unlimitedStorage`, optional permissions, `externally_connectable`, `web_accessible_resources`.

Change from the Milestone 0 plan: `scripting` was added. Autoconsent's verification checks need page world access; `scripting.executeScript` with bundled functions was chosen over a page world content script because results return through the browser, not through messages a page could forge.

Extension pages CSP: `script-src 'self'; object-src 'self'; connect-src 'none'`.

Approvals (specification section 26, invasive permissions):

- `scripting`: approved by the product owner on 2026-11-10, after it had been added.
- `declarativeNetRequestWithHostAccess`: added 2026-11-11. Basis: on 2026-11-11 the product owner instructed that all requested functionality be finished to production standard, having been told on 2026-11-10 that Global Privacy Control needs this permission. This is recorded as approval for this permission for this feature only. It was not a separate, named approval; if that reading is wrong, removing the permission and setting `features.gpc` to false disables the feature cleanly.
- `webRequest`: added 2026-11-11 for the technical audit, on the same basis as above (instruction of 2026-11-11 to finish all requested functionality, repeated the same day with "go ahead"). Not a separate, named approval; setting `features.audit` to false and removing the permission disables the feature cleanly.
- `cookies` is not requested.

`scripting` is also used to register the Global Privacy Control page signal: one bundled script that defines `navigator.globalPrivacyControl` and does nothing else.
