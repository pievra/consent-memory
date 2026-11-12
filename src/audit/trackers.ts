// Tracking services recognised by the technical audit.
//
// Compiled by this project from publicly known service hostnames. It is deliberately short:
// well known advertising and analytics services only. It is not derived from any third
// party list (the common ones are licensed for non-commercial use; see docs/legal/licence-audit.md).
// Tag loaders such as googletagmanager.com are left out on purpose: loading a container is not
// itself tracking, and listing it produced a signal on sites that load it before consent and
// fire nothing until a choice is made.
// A site that uses a service not listed here will show "passed" for that service, which is
// why every audit result records the list version and says how many services it knows.
export const TRACKER_LIST_VERSION = '2026.11.2';

export type TrackerCategory = 'advertising' | 'analytics';

const ADVERTISING = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com', 'facebook.net', 'criteo.com', 'criteo.net',
  'adnxs.com', 'rubiconproject.com', 'pubmatic.com', 'openx.net', 'taboola.com', 'outbrain.com', 'amazon-adsystem.com', 'adsrvr.org',
  'casalemedia.com', 'smartadserver.com', 'teads.tv', 'id5-sync.com', 'rlcdn.com', 'crwdcntrl.net', 'bluekai.com', 'demdex.net',
  'bidswitch.net', 'sharethrough.com', '3lift.com', 'yieldmo.com', 'media.net', 'moatads.com', 'doubleverify.com', 'adform.net',
  'agkn.com', 'tapad.com', 'onetag-sys.com', 'seedtag.com', 'weborama.fr', '33across.com', 'ads-twitter.com', 'ads.linkedin.com',
  'snap.licdn.com', 'bat.bing.com', 'analytics.tiktok.com', 'ct.pinterest.com', 'sc-static.net', 'quantserve.com', 'lijit.com',
];
const ANALYTICS = [
  'google-analytics.com', 'analytics.google.com', 'hotjar.com', 'clarity.ms', 'scorecardresearch.com',
  'omtrdc.net', 'segment.io', 'cdn.segment.com', 'mixpanel.com', 'amplitude.com', 'fullstory.com', 'mouseflow.com', 'chartbeat.com',
  'chartbeat.net', 'xiti.com', 'mc.yandex.ru', 'nr-data.net', 'piano.io', 'matomo.cloud',
];
/** Present only so that automated tests can exercise the audit. `.localhost` never leaves the machine. */
const TEST_ONLY = ['fixture-tracker.localhost'];

export const TRACKERS: ReadonlyMap<string, TrackerCategory> = new Map<string, TrackerCategory>([
  ...ADVERTISING.map((d) => [d, 'advertising'] as const),
  ...ANALYTICS.map((d) => [d, 'analytics'] as const),
  ...TEST_ONLY.map((d) => [d, 'advertising'] as const),
]);
export const TRACKER_COUNT = ADVERTISING.length + ANALYTICS.length;
