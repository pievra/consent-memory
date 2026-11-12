# Chrome Web Store listing — version 0.1.0

Status: **approved for submission as an unlisted test release** by the product owner on 2026-11-12 (specification section 26). Not submitted yet: submission needs the owner's developer account. Visibility: **Unlisted** (reachable by link only, not in search). The public listing stays gated on the quality score reaching 8 (`docs/qa/release-checklist.md`). Every claim below is tied to something the product does today; anything not yet true is absent.

## Fields

| Field | English (en-GB) | French (fr) |
|---|---|---|
| Name (from the manifest) | Pievra: Consent Memory | Pievra: Consent Memory |
| Visibility | Unlisted | — |
| Regions | All | — |
| Short description (132 max; shipped in `_locales`) | Refuses optional cookies on recognised banners, checks the refusal was stored, and remembers it. Your choices stay on your device. | Refuse les cookies facultatifs sur les bandeaux reconnus, vérifie que le refus est enregistré. Vos choix restent sur votre appareil. |
| Category | Privacy & Security | — |
| Language | English (United Kingdom), French | — |
| Publisher | MRNIE SAS | — |
| Support contact | contact@pievra.com | — |
| Privacy policy URL | https://github.com/pievra/consent-memory/blob/main/docs/privacy/privacy-policy.md (valid once the repository is public) | — |
| Homepage URL | https://github.com/pievra/consent-memory until pievra.com has a page for the extension | — |

## Detailed description — English

Pievra answers cookie banners for you and tells you, honestly, what happened.

**What it does**

- Refuses every optional purpose on cookie banners from the products it recognises. It never presses "accept" unless you have chosen to allow all purposes on that site.
- Checks the result. After refusing, it asks the site's consent tool what was stored. You see "Refused and confirmed" only when the tool confirms it. If nothing can confirm it, Pievra says "Applied, not confirmed" — a banner disappearing is not counted as proof.
- Remembers each site, with the evidence, so you can review it later. A mark on the toolbar button shows the result for the site you are on.
- Where the consent tool documents how (Didomi, for now), it also objects to “legitimate interest” when refusing. Elsewhere it tells you when legitimate interest remains.
- On “accept or pay” walls it clicks nothing and says the choice is yours.
- Sends the Global Privacy Control signal to every site (you can switch it off).
- Shows a technical audit of sites with a banner: tracking services contacted before you answered and after you refused, how many steps refusing took, and four other observations.

**What it does not do**

- It does not block adverts or trackers. It expresses your refusal and reports what it observes.
- It does not handle every banner. Unrecognised banners are left for you.
- It can press “accept” only on a few consent tools. If you allow everything, on most sites it clicks nothing and tells you so.
- If you allow some purposes and refuse others on a site, that is applied and checked where the site's consent tool allows it (Cookiebot, for now). Elsewhere it refuses them all and tells you which choice it could not apply.
- "Confirmed" is what the site's consent tool reports. It is not proof that all tracking stopped, and it is not a legal finding.

**Your data**

- No account, no server, no analytics. The extension makes no network request of its own.
- Your choices and results are stored in your browser only. Export or delete them at any time.
- Open source under the Mozilla Public License 2.0: https://github.com/pievra/consent-memory

**Early test version**

This is version 0.1.0, shared by link for testing. If you want to help, the welcome page explains how to email us a results file. That is optional, and the extension never sends anything by itself.

Published by MRNIE SAS, Paris.

## Detailed description — French

Pievra répond aux bandeaux cookies à votre place et vous dit, sans embellir, ce qui s'est passé.

**Ce qu'il fait**

- Refuse toutes les finalités facultatives sur les bandeaux des produits qu'il reconnaît. Il n'appuie jamais sur « accepter », sauf si vous avez choisi d'autoriser toutes les finalités sur ce site.
- Vérifie le résultat. Après le refus, il demande à l'outil de consentement du site ce qui a été enregistré. « Refusé et confirmé » n'apparaît que si l'outil le confirme. Si rien ne le confirme, Pievra indique « Appliqué, non confirmé » : la disparition d'un bandeau ne vaut pas preuve.
- Mémorise chaque site, avec les éléments vérifiés, pour que vous puissiez y revenir. Une marque sur le bouton de la barre d'outils indique le résultat pour le site affiché.
- Lorsque l'outil de consentement le documente (Didomi, pour l'instant), il s'oppose aussi à l'« intérêt légitime » lors du refus. Ailleurs, il vous indique quand l'intérêt légitime subsiste.
- Sur les murs « accepter ou payer », il ne clique sur rien et vous laisse le choix.
- Envoie le signal Global Privacy Control à chaque site (désactivable).
- Présente un audit technique des sites à bandeau : services de suivi contactés avant votre réponse et après votre refus, nombre d'étapes nécessaires pour refuser, et quatre autres observations.

**Ce qu'il ne fait pas**

- Il ne bloque ni publicités ni traceurs. Il exprime votre refus et rapporte ce qu'il observe.
- Il ne traite pas tous les bandeaux. Les bandeaux non reconnus vous sont laissés.
- Il ne peut appuyer sur « accepter » qu'avec quelques outils de consentement. Si vous autorisez tout, il ne clique sur rien sur la plupart des sites, et vous le dit.
- Si vous autorisez certaines finalités et en refusez d'autres sur un site, ce choix est appliqué et vérifié lorsque l'outil de consentement du site le permet (Cookiebot, pour l'instant). Ailleurs, il les refuse toutes et vous indique quel choix n'a pas pu être appliqué.
- « Confirmé » correspond à ce que l'outil de consentement du site indique. Ce n'est pas la preuve que tout suivi a cessé, ni une conclusion juridique.

**Vos données**

- Ni compte, ni serveur, ni mesure d'audience. L'extension n'émet aucune requête réseau de sa propre initiative.
- Vos choix et résultats sont enregistrés dans votre navigateur uniquement. Exportez-les ou supprimez-les à tout moment.
- Logiciel libre sous licence Mozilla Public License 2.0 : https://github.com/pievra/consent-memory

**Première version de test**

Ceci est la version 0.1.0, partagée par lien pour être testée. Si vous souhaitez aider, la page d'accueil explique comment nous envoyer un fichier de résultats par courriel. C'est facultatif, et l'extension n'envoie jamais rien d'elle-même.

Édité par MRNIE SAS, Paris.

## Single purpose statement (store form)

Pievra applies the user's cookie consent choice to website consent banners, verifies and remembers the result, and reports related privacy observations for the same sites.

## Permission justifications (store form)

| Permission | Justification |
|---|---|
| Host permission, all sites | Consent banners appear on any website. The content script must run on each page to recognise a known consent product and operate its refusal controls. No page content is collected. |
| `storage` | Stores the user's choices and per-site results locally. |
| `scripting` | Runs bundled functions in the page to read what the consent product stored, to submit the user's choice through the consent product's documented interface (Cookiebot purposes; Didomi refusal including legitimate interest), and registers the bundled Global Privacy Control signal script. No remote or page-supplied code is executed. |
| `declarativeNetRequestWithHostAccess` | One rule that adds the request header `Sec-GPC: 1`. No request is blocked or redirected. |
| `webRequest` | Observes (never blocks or modifies) request hosts to report, per site, which services from a bundled list were contacted before and after the user's refusal. Only the service name is kept, locally. |

Remote code: none. All code and rules ship in the package.

## Data usage disclosures (store form)

| Question | Answer | Basis |
|---|---|---|
| Does the extension collect or transmit user data? | No | Zero extension-initiated requests: capture test and bundle scan on every build |
| Web history | Not collected or transmitted. A list of domains with a recognised banner is stored locally only | `docs/privacy/data-flows.md` |
| Sold or transferred to third parties | No | No transmission exists |
| Used for purposes unrelated to the single purpose | No | — |
| Used for creditworthiness or lending | No | — |

## Notes for the reviewer (store form, "additional instructions")

No account or login is needed. To see it work: install, visit a site with a OneTrust, Cookiebot or Didomi cookie banner, wait about ten seconds, then click the toolbar button. The extension makes no network request of its own; host access is needed because consent banners appear on any site.

## Assets

| Asset | Size | State |
|---|---|---|
| Icon | 128 × 128, plus 16, 32, 48 | Shipped: the wordmark's "p." on the website's orange |
| Screenshots | 5 at 1280 × 800 | Produced by `scripts/make-store-assets.mjs` from the built extension with sample records (example site names, not measurements) |
| Small promotional tile | 440 × 280 | Produced by the same script |

## Data usage after the tester invitation

The answers above are unchanged: the extension still collects and transmits nothing. A person who chooses to email a results file sends it themselves, outside the extension; the privacy policy describes what is done with it.
