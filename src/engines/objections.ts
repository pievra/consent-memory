/**
 * Objecting to "legitimate interest" as part of a refusal.
 *
 * On some consent tools the banner's refuse button withdraws consent but leaves legitimate
 * interest declared, so the run ends "partly done". Where the tool documents a single call that
 * refuses both for every purpose and vendor, that call is made right after a refusal succeeds.
 *
 * Rules for an entry here:
 * - the call is in the tool's public documentation and can only refuse, never grant;
 * - it is one of the snippets shipped with the detection engine, selected by name: no code of
 *   ours or of the page is run;
 * - it runs only after a refusal, never after an acceptance or a per purpose submission;
 * - the result is not trusted: whether legitimate interest is gone is decided afterwards from
 *   the page's consent state, exactly as before.
 *
 * didomi: `Didomi.setUserDisagreeToAll()` — "disabled consents and legitimate interests for all
 * purposes and vendors" (developers.didomi.io, Web SDK reference, read 2026-11-11). The engine
 * already uses the same snippet as its refusal when a Didomi banner has no refuse button.
 *
 * Not listed, because no documented call exists: Quantcast / InMobi Choice, Sourcepoint.
 */
const OBJECTION_SNIPPETS: Readonly<Record<string, string>> = Object.freeze({
  didomi: 'EVAL_DIDOMI_OPT_OUT',
});

export const objectionSnippet = (cmp: string | undefined): string | null =>
  cmp !== undefined && Object.hasOwn(OBJECTION_SNIPPETS, cmp) ? OBJECTION_SNIPPETS[cmp]! : null;
