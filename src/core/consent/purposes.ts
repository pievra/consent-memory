export const PURPOSES = ['storage', 'preferences', 'analytics', 'content', 'advertising', 'other'] as const;
export type Purpose = (typeof PURPOSES)[number];

export const CHOICES = ['allow', 'refuse'] as const;
export type Choice = (typeof CHOICES)[number];

export type Choices = Record<Purpose, Choice>;

/** Built in default: every optional purpose is refused. */
export const REFUSE_ALL: Readonly<Choices> = Object.freeze({
  storage: 'refuse',
  preferences: 'refuse',
  analytics: 'refuse',
  content: 'refuse',
  advertising: 'refuse',
  other: 'refuse',
});

export function isPurpose(value: unknown): value is Purpose {
  return typeof value === 'string' && (PURPOSES as readonly string[]).includes(value);
}
