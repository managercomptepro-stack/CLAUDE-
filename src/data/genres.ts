/** Closed list of profiles (SPEC § 3), used for sign-up, listings and filters. */
export const GENRES = ['femme', 'homme', 'gay', 'lesbienne', 'trans', 'couple', 'autre'] as const;

export type Genre = (typeof GENRES)[number];

export function isGenre(value: string): value is Genre {
  return (GENRES as readonly string[]).includes(value);
}
