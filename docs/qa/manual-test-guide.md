# Manual test guide — real websites

Time needed: about 45 minutes for all 30 sites. You can stop after any site and continue later.

What this tests: whether the extension refuses cookies correctly on real websites, and whether it breaks anything. It has only ever been run on practice pages, so expect some sites where it does nothing.

**Nothing is sent anywhere.** Results stay in your browser until you download the results file yourself and pass it on.

## Before you start

**Turn off any VPN tracker blocking first.** VPN apps with a "threat protection" or ad blocking feature (NordVPN, for example), and network filters such as NextDNS or Pi-hole, remove cookie banners before Chrome sees them. With one switched on you will see no banners and the test records nothing. Quick check: open an incognito window and go to `https://www.bbc.co.uk/`. If no cookie banner appears, something is still filtering.

You need Google Chrome (or Microsoft Edge) on a computer, and two files:

- `consent-memory-0.1.0-chrome.zip` — the extension
- `results-sheet.csv` — a list of the 30 sites with columns for you to fill in (opens in Excel, Numbers or Google Sheets)

## Step 1 — Unzip the extension

Double-click `consent-memory-0.1.0-chrome.zip`. You get a folder. Remember where it is, and do not delete it while testing: Chrome runs the extension from that folder.

## Step 2 — Make a clean Chrome profile

A fresh profile matters. In your normal profile, sites already remember your cookie choices and will not show their banners.

1. In Chrome, click your profile picture (top right) → **Add** (or **Add Chrome profile**).
2. Choose **Continue without an account**. Name it `Consent test`.
3. A new, empty Chrome window opens. Do everything below in that window.

## Step 3 — Load the extension

1. In the address bar type `chrome://extensions` and press Enter. (In Edge: `edge://extensions`.)
2. Switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose the folder from step 1 — the one that contains a file called `manifest.json`.
4. A card appears named **Pievra**.
5. Click the puzzle-piece icon in the toolbar and pin the extension so its icon stays visible.

Chrome will warn that the extension can "read and change all your data on all websites". It needs that to find and answer cookie banners on any site. It stores only the site name and the result, and only for sites where it recognised a banner.

## Step 4 — Test each site

Open `results-sheet.csv`. For each row:

1. Copy the address into the test window and press Enter.
2. **Wait 15 seconds without touching anything.** Watch what the cookie banner does.
3. Fill in the row:
   - **banner_appeared** — `yes` or `no` (did you see a cookie banner at all, even briefly?)
   - **banner_gone_after_15s** — `yes` or `no`
   - **page_works** — `yes` if you can scroll and click a link normally; `no` if the page is frozen, greyed out or blank
   - **notes** — anything odd: a second banner, a pop-up, the page jumping, a login wall
4. Press the reload button once. Did the banner come back? Put `came back` in notes if so.

Rules while testing:

- **Do not log in. Do not buy anything. Do not type in any form.**
- Do not click the cookie banner yourself. If it is still there after 15 seconds, write that down and move on.
- If a site asks you to prove you are human, or is blocked in your country, write `blocked` in notes and move on.

## Step 5 — Download the results

1. Click the extension icon → **Open results**.
2. You will see one row per site where a banner product was recognised. Sites with no row were left alone.
3. Click **Download with site names**. A file named `pievra-results-<date>.json` is saved to your Downloads folder.

## Step 6 — Send back two files

- your filled-in `results-sheet.csv`
- the downloaded `pievra-results-<date>.json`

Also say **which country you were in** while testing, and whether you used Chrome or Edge. Banners differ by visitor country, so results from France tell us how these sites behave for a visitor in France, including the UK and Saudi sites.

The results file lists the sites from this test profile where a banner was recognised. It contains nothing from your normal Chrome profile.

## Step 7 — Clean up

1. `chrome://extensions` → **Remove** on the extension card.
2. Profile picture → the cog icon → find `Consent test` → three dots → **Delete**. This removes everything the test stored.
3. Delete the unzipped folder.

## If something goes wrong

| What you see | What to do |
|---|---|
| "Manifest file is missing or unreadable" | You picked the wrong folder. Pick the one that directly contains `manifest.json` |
| No "Load unpacked" button | Developer mode is off (step 3.2) |
| A work computer refuses to load it | Company policy blocks unpacked extensions. Use a personal computer |
| A site looks broken | Note it, then open the same address in your normal Chrome profile to check whether it is broken there too. Write the answer in notes — this is the most valuable thing you can report |
| The results page is empty after several sites | Press **Refresh**. If still empty, write that down; it is a result in itself |

## How the results will be counted

- **Handled**: result is Verified, or Partial with a correct explanation, and the page works.
- **Not handled**: any other result, or no row at all when you saw a banner.
- **Breakage**: page does not work in the test profile but works in your normal profile.
- A site where you saw no banner is left out of the rate.

Targets for this prototype: at least 25 of 30 handled, no site where cookies were accepted, no broken pages.
