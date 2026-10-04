/**
 * Identity of the publisher shown in /mentions-legales (loi n° 2010/021). Only the owner can give
 * these facts: `null` shows « À compléter » on the page, and `npm run deploy` refuses to publish
 * to production while one is missing (scripts/check-legal.ts). Never invent them.
 */
export interface Publisher {
  readonly name: string | null;
  readonly legalForm: string | null;
  readonly address: string | null;
  readonly rccm: string | null;
  readonly taxId: string | null;
  readonly director: string | null;
}

export const PUBLISHER: Publisher = {
  // Given by the owner on 4 Oct 2026 (contact: WhatsApp +79003269415).
  name: 'PAPA BONHEUR',
  legalForm: 'Personne physique',
  address: 'Moscou City, Russie',
  rccm: 'Non communiqué (personne physique)',
  taxId: 'Non communiqué (personne physique)',
  director: 'PAPA BONHEUR',
};

/** Fields still empty (the deploy check and the tests read this). */
export function missingPublisherFields(p: Publisher = PUBLISHER): (keyof Publisher)[] {
  return (Object.keys(p) as (keyof Publisher)[]).filter((k) => !p[k]?.trim());
}
