/**
 * "Accept or pay" walls: a consent message whose only alternatives are accepting everything or
 * paying. There is no free refusal to carry out, so nothing is ever clicked on one. Recognising
 * the wall only changes what the user is told: "this site asks you to accept or pay" instead of
 * "no banner open".
 *
 * A wall is recognised by a marker that the consent tool itself puts on its "subscribe" button,
 * never by the words on the page. One entry per consent tool, keyed by the engine's rule name.
 * - Sourcepoint-frame: choice type 9 is the pay or subscribe action. The engine's own rule uses
 *   the same marker to decline to act (lib/cmps/sourcepoint-frame.ts, detectPopup).
 */
export const WALL_MARKERS: Readonly<Record<string, string>> = Object.freeze({
  'Sourcepoint-frame': '.sp_choice_type_9',
});

export const wallMarker = (cmp: string | undefined): string | null => (cmp !== undefined && Object.hasOwn(WALL_MARKERS, cmp) ? WALL_MARKERS[cmp]! : null);

/** How long a wall seen on one visit is still shown as the site's state. After that the label lapses. */
export const WALL_LABEL_MS = 7 * 24 * 3600 * 1000;

/**
 * True while the record says nothing more than "detected" and a wall was seen recently. The mark
 * is removed by the next report for the site; the time limit covers the case where no report
 * comes (the user subscribed or accepted, and the consent tool no longer loads).
 */
export function isWall(record: { status: string; wallSeenAt?: string | undefined }, now: number = Date.now()): boolean {
  if (record.status !== 'detected' || record.wallSeenAt === undefined) return false;
  const age = now - Date.parse(record.wallSeenAt);
  return age >= 0 && age < WALL_LABEL_MS;
}
