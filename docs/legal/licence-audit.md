# Licence audit — Milestone 0

Status: **draft, not a legal opinion.** Versions and licences were read from the npm registry and the GitHub licence files on 2026-11-10. Nothing is installed yet; the audit must be repeated against the lockfile at Milestone 1 and before every release.

## 1. Candidate dependencies

| Component | Source | Version checked | Licence | Shipped in the extension | Obligations | Commercial restriction |
|---|---|---|---|---|---|---|
| DuckDuckGo Autoconsent | npm `@duckduckgo/autoconsent` | 18.2.0 | MPL-2.0 | Yes (code and rules) | Keep licence notices; publish source of any MPL file we modify, under MPL-2.0; state where the source is available | None |
| Consent O Matic | GitHub `cavi-au/Consent-O-Matic` | 1.1.5 (last push 2026-02-07) | MIT | Yes if integrated (rules and engine code) | Keep copyright and permission notice | None |
| WXT | npm `wxt` | 0.21.5 | MIT | Build tool; small runtime helpers | Notice | None |
| Preact | npm `preact` | 11.2.0 | MIT | Yes | Notice | None |
| Zod | npm `zod` | 4.6.7 | MIT | Yes | Notice | None |
| tldts (public suffix) | npm `tldts` | 7.4.19 | MIT | Yes, includes Public Suffix List data (MPL-2.0) | Notice for both | None |
| TypeScript | npm `typescript` | 7.0.2 | Apache-2.0 | No | — | None |
| Vitest | npm `vitest` | 5.1.0 | MIT | No | — | None |
| Playwright | npm `@playwright/test` | 1.65.0 | Apache-2.0 | No | — | None |
| axe-core Playwright | npm `@axe-core/playwright` | 4.14.0 | MPL-2.0 | No | — | None |
| cdxgen (SBOM) | npm `@cyclonedx/cdxgen` | 12.9.1 | Apache-2.0 | No | — | None |
| pnpm | npm `pnpm` | 12.18.0 | MIT | No | — | None |

Public suffix choice: `tldts` over `psl` (1.15.0, MIT). `tldts` ships typed APIs and a bundled list updated with each release; either satisfies the "maintained public suffix library" requirement.

## 2. Tracker lists — blocking finding

| List | Licence (read from repository) | Usable as bundled data |
|---|---|---|
| DuckDuckGo Tracker Radar | CC BY-NC-SA 4.0 | **No, pending decision** |
| DuckDuckGo tracker-blocklists | CC BY-NC-SA 4.0 | **No, pending decision** |
| Disconnect tracking protection | CC BY-NC-SA 4.0 | **No, pending decision** |
| EasyPrivacy (EasyList project) | Not verified in this audit; repository exposes no licence file through the GitHub API. Understood to be dual GPL-3.0 / CC BY-SA 3.0 | Not until verified |

The three most used tracker datasets are **non-commercial, share-alike**. Pievra is a commercial publisher and section 10.10 of the specification preserves a commercial intelligence option. Bundling any of these lists creates a licence conflict that section 21 treats as a release blocker ("Required licence obligations are unresolved").

Options for the audit feature (Milestone 4):

| Criteria | A. Self-curated list | B. EasyPrivacy | C. Commercial licence (DuckDuckGo or Disconnect) |
|---|---|---|---|
| Upside | No third party obligation; 50 to 150 well known tracker domains cover the checks in section 11 | Broad coverage, maintained daily | Broadest, entity level data |
| Downside | Lower coverage; maintenance is ours | Share-alike on the list; filter syntax needs a parser; licence to verify | Cost and negotiation time unknown |
| Risk | Missed trackers reported as "passed" unless the check reports coverage limits | Licence interaction with the project licence | Dependency on a supplier |
| Reversibility | High | Medium | Low |

Recommendation (medium confidence): **A for the first Chromium release**, with every audit result stating the list it was checked against, and B or C reassessed before any published benchmark. Decision owner: product owner.

## 3. Findings on the consent engines

1. **Autoconsent, MPL-2.0.** File level copyleft. It is compatible with a project under Apache-2.0, MIT or MPL-2.0 provided modified Autoconsent files stay under MPL-2.0 with source available. Integration plan: consume the npm package unmodified; put our logic in separate files.
2. **Consent O Matic, MIT.** Not published as an npm library; integration means vendoring rules and engine code at a pinned commit. It is the only one of the two engines with purpose level controls (see `docs/architecture/purpose-mapping.md`).
3. Autoconsent's repository contains a `rules/generated` directory. Whether it still includes converted Consent O Matic rules, and under what notice, is **not verified** and must be checked at the pinned version before deciding how much of Consent O Matic to vendor.
4. Both rule sets are bundled at build time. No remote rule download (section 17).

## 4. Project licence — decided: MPL-2.0

**Decision (product owner, 2026-11-10): MPL-2.0.** `LICENSE` holds the unmodified text from mozilla.org; the notice is in `README.md`. Consequences: changes anyone makes to this project's files must be published under MPL-2.0; the project can be combined with code under other licences file by file; Autoconsent (also MPL-2.0) needs no special handling. The options considered are kept below for the record.

Not a legal opinion: a lawyer's review before the repository is made public remains advisable, as does a decision on whether outside contributors sign a contributor agreement.

The specification says "open source" without naming a licence. Changing or choosing the legal model requires approval (section 26).

| Criteria | Apache-2.0 | MPL-2.0 | GPL-3.0 |
|---|---|---|---|
| Upside | Patent grant; simplest for contributors and store review | Same licence as Autoconsent; changes to our files stay open | Strongest copyleft |
| Downside | Forks may close their changes | File level obligations for downstream users | Excludes some contributors and reuse; GPL-3.0 and MPL-2.0 combine only through MPL's secondary licence clause |
| Risk | Low | Low | Medium |
| Reversibility | Relicensing needs every contributor's consent once outside contributions exist | Same | Same |

The engineering recommendation was Apache-2.0; the product owner chose MPL-2.0 so that improvements to the project's files stay open.

## 5. Milestone 1 rerun against the lockfile (2026-11-10)

Installed and pinned: `@duckduckgo/autoconsent` 18.1.0 (MPL-2.0), `zod` 4.6.7 (MIT), `tldts` 7.4.19 (MIT), `wxt` 0.21.5, `vite` 7.3.8, `typescript` 6.0.3, `vitest` 5.1.0, `@playwright/test` 1.65.0, `eslint` 10.14.0, `typescript-eslint` 8.72.1. Preact is not installed yet. Every licence in the lockfile is on the allow list below except BlueOak-1.0.0 (minimatch, permissive, development only, not shipped). `THIRD_PARTY_NOTICES.md` created. Autoconsent's generated (`auto_`) rules are bundled in the package data but disabled at run time.

## 6. Actions still open

- Generate `THIRD_PARTY_NOTICES.md` from the lockfile in the build, and a CycloneDX SBOM.
- Add a CI licence check that fails on any licence outside an allow list (MIT, Apache-2.0, BSD-2/3-Clause, ISC, MPL-2.0, CC0-1.0, 0BSD).
- Verify EasyPrivacy's licence text if option B is pursued.
