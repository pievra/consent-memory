# Pievra — privacy policy

Version 1.1 for extension version 0.1.0, 12 November 2026. It takes effect when the extension is published.

Publisher and data controller for anything described here: MRNIE SAS, 16 rue du Dragon, 75006 Paris, France — RCS Paris 109 701 664. Privacy contact: dpo@mrnie.com. General contact: contact@pievra.com.

## In one paragraph

Pievra works entirely inside your browser. It has no server, no account and no analytics. The publisher receives no data about you, your browsing or your choices from the extension, because the extension sends none. The only way anything reaches the publisher is if you decide to email it yourself (see below). Everything it remembers is stored in your browser on your device and can be exported or deleted by you at any time.

## What Pievra stores on your device

| What | Why | How long |
|---|---|---|
| Your default choice (refuse or allow) for six purposes, and whether Global Privacy Control is on | To apply your choices | Until you change or delete it |
| For each site where a recognised cookie banner product was found, or where you set a choice: the site's domain (for example `example.com`), your choices for it, whether you paused it | To remember the site | Until you forget the site or delete everything |
| For the same sites: the result (for example "refused and confirmed"), the banner product's name, short evidence lines, the dates of the last attempt and last confirmation | To show you what happened and on what evidence | Same |
| For the same sites: the outcome of six technical checks and, for two of them, up to 10 names of tracking services from a list bundled in the extension | To show you the technical audit | Deleted automatically after 90 days |

Not stored: sites where no recognised banner was found and you set nothing; web addresses beyond the domain; page titles or content; cookie names or values; anything you type.

Nothing is copied to your browser account: the browser's sync storage is never used.

## What leaves your device

Nothing is sent to MRNIE or to any third party by the extension. It makes no network request of its own. This is checked on every build by an automated capture and by inspection of the packaged files.

Two things change what websites themselves receive from your browser:

1. **Your refusal.** Pievra presses the refusal controls of the site's own cookie banner, as you would. The site learns what any visitor's refusal tells it.
2. **Global Privacy Control**, on by default. Each request to a site that is not paused carries the header `Sec-GPC: 1`, and pages can read the same signal. It is one bit, identical for everyone who has it on, and carries no identifier. It can make your browser slightly more distinguishable from one that does not send it. You can switch it off in the settings.

## If you choose to email us a results file

Version 0.1.0 is an early test version. Its welcome and results pages invite you to help by emailing a results file to contact@pievra.com. This is optional, and the extension never sends the file itself: you download it and you send it.

| | |
|---|---|
| What we receive | Your email address and whatever your email service adds; the file. With "site names": the domains of sites where a recognised banner was found, the result and evidence for each, your browser version, languages and time zone. Without: the same, with sites numbered instead of named and without languages and time zone |
| Why | Only to find and fix sites where Pievra fails, and to count how often it works |
| Legal basis | Your consent, given by sending the file. You can withdraw it by writing to dpo@mrnie.com; we then delete the file and your message |
| Who sees it | MRNIE SAS and its email provider. It is not sold, shared or published. Figures we publish from such files are totals only (for example "41 of 50 banners handled"), never a person's list of sites |
| How long | Deleted at the latest 6 months after receipt |

If you would rather not show where you have been, use "Download without site names", or do not send anything: the extension works exactly the same.

## Permissions and what they are used for

| Permission | Use |
|---|---|
| Access to all websites | Cookie banners can appear on any site; the extension must be present to recognise and answer them |
| Storage | Keeps the data listed above in your browser |
| Scripting | Asks the site's consent tool what it stored, and sets the Global Privacy Control signal for pages |
| Declarative net request (with host access) | Adds the `Sec-GPC: 1` header. Blocks or redirects nothing |
| Web request (observation only) | Lets the technical audit see which listed tracking services a page contacts. Cannot block or change a request; only the service's name is kept |

## Your controls

In the settings page you can: change every choice; pause Pievra on a site; forget one site, several, or all; export your choices to a file; delete everything. Uninstalling the extension removes all of its data from the browser.

Unless you emailed a results file, MRNIE holds no data about you, so there is nothing for it to give access to, correct or erase on its side. If you have a question about this policy, or wish to exercise a right under the GDPR or the UK GDPR, write to dpo@mrnie.com. You may also complain to your data protection authority (in France, the CNIL; in the United Kingdom, the ICO).

## Statistics and telemetry

None. The source code contains a design for optional, opt-in, aggregated statistics. It is switched off, is not included in the packaged extension, has no server to send to, and has not been approved for use. If that ever changes, this policy will change first, and nothing will be collected without your explicit opt-in. Nothing will ever be collected about the period before you opted in.

## What Pievra's results mean

"Confirmed" means the site's consent tool reports that it stored your refusal. It is not proof that all tracking stopped and it is not a legal finding about any site. The technical audit reports observations against a bundled list of 65 tracking services; it is not a compliance assessment.

## Children

Pievra is a general privacy tool and is not directed at children. It collects no data from anyone.

## Changes

Changes are listed in the project's change log and take effect with the version that carries them. A change that would cause any data to leave your device would require your opt-in first.

## Open source

The source code is licensed under the Mozilla Public License 2.0 and is public at https://github.com/pievra/consent-memory, so these statements can be checked.
