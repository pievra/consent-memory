# Changelog

## 0.1.0 — 2026-11-12

First release: an unlisted test release on the Chrome Web Store (link only), by the owner's decision of 2026-11-12. Store name "Pievra: Consent Memory". The welcome and results pages invite testers to email a results file; the extension itself still sends nothing.

- Detects recognised consent platforms with Autoconsent 18.1.0 and refuses optional purposes by default.
- Reports a result as verified only when the consent platform's own state confirms it.
- Stores results on the device for sites where a consent platform was found.
- Pievra branding: new icon (the wordmark's “p.” on the website's orange), brand header in the popup with a link to pievra.com, controls in ink with orange links.
- “Accept or pay” walls (Sourcepoint): left untouched as before, and now named as such instead of “No banner open”. Recognised by the consent tool's own marker on its subscribe button, never by page text; only the site's own frame can set it.
- Refusals on Didomi banners now also object to legitimate interest, through the tool's documented `setUserDisagreeToAll()` call. The result is still decided from the page's consent state, never from the call.
- First impressions, from a person's first run: the popup folds the per site choices so the result comes first; “partly done” says which of its two causes applies and what the user can do; the toolbar button carries a mark for the result (✓ ! ? × II); the settings warn when a default is set to allow; the welcome page lists the results people actually meet.
- Consent tools are shown under their product names (OneTrust, Cookiebot, Sourcepoint, Quantcast Choice and about 40 more). The settings and welcome pages carry the Pievra header. The tester results page has two labelled download buttons and uses the same result names as the popup; the file is now `pievra-results-<date>.json`. When everything is allowed and the consent tool cannot be accepted, the result says so and nothing is recorded as an attempt that could not be confirmed.
- Popup: result for the current site in plain language, per purpose choices for that site, pause.
- Settings: defaults, list of sites with search, filter and sort, forget with undo, bulk refusal with preview, export, import, delete everything. English and French.
- A result counts as confirmed only when the consent platform's stored state can be read; a banner closing is not enough.
- Global Privacy Control: sends `Sec-GPC: 1` and sets `navigator.globalPrivacyControl`, on by default, switchable in settings, not sent to paused sites.
- Technical audit: six observations per site (tracking before consent and after refusal, ease of refusing, preselected purposes, readable consent state, response to GPC), shown as observations, never as a legal finding.
- Diagnostic results page with a user initiated download, for manual testing.
- Choices that mix allow and refuse are applied purpose by purpose, and verified, on sites using Cookiebot. A purpose is granted only when "storage and access" is allowed too. On other consent tools a mixed choice is still applied as a refusal of everything.
- Welcome page shown once after installation, in English and French, and reachable from the settings.
- Settings warn when the extension's storage is 80% full.
- Extension description localised in English and French; icon added.
- Checks on every build: credential pattern scan of tracked files, software bill of materials (CycloneDX).
- Site panel runner (`pnpm panel`) for recording behaviour on the 30 site panel.
