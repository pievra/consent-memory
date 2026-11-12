import { isWall } from '../../engines/walls';

/** What the toolbar button shows for the site in a tab. Null means no mark. */
export interface Badge {
  text: string;
  /** Background colour. The mark itself carries the meaning; colour only supports it. */
  color: string;
}

const SIX_MONTHS_MS = 182 * 24 * 3600 * 1000;
const OK = '#1f6b45';
const WARN = '#8a5a00';
const BAD = '#a1271f';
const NEUTRAL = '#52525b';

interface BadgeRecord {
  status: string;
  paused: boolean;
  lastVerified?: string | undefined;
  wallSeenAt?: string | undefined;
}

/**
 * One character per kind of result, so the result is readable without opening the popup:
 * ✓ refused and confirmed · ! needs a look (partly done, or an "accept or pay" wall) ·
 * ? applied, not confirmed · × could not manage · II paused. Nothing is shown when nothing was
 * done, and a confirmation older than six months is not shown as current.
 */
export function badgeFor(record: BadgeRecord | null, now: number): Badge | null {
  if (!record) return null;
  if (record.paused) return { text: 'II', color: NEUTRAL };
  switch (record.status) {
    case 'verified':
      return record.lastVerified !== undefined && now - Date.parse(record.lastVerified) > SIX_MONTHS_MS ? null : { text: '✓', color: OK };
    case 'partial':
    case 'recorded':
      return { text: '!', color: WARN };
    case 'attempted':
    case 'inconclusive':
      return { text: '?', color: WARN };
    case 'failed':
      return { text: '×', color: BAD };
    case 'detected':
      return isWall(record, now) ? { text: '!', color: WARN } : null;
    default:
      return null;
  }
}
