/**
 * firestore.indexes.json covers every shape of the feed query (src/lib/feed.ts). The emulator
 * requires no index, so this is the only local check. Proven on nioxxer-staging (2 Oct 2026):
 * with orderBy(rank desc, createdAt desc) and a range on birthMonth, Firestore wants birthMonth
 * DESCENDING, after createdAt (the range field follows the direction of the last orderBy).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Field {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
}
interface Index {
  collectionGroup: string;
  fields: Field[];
}

const { indexes } = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as { indexes: Index[] };

function hasIndex(equalities: string[], ordered: Field[]): boolean {
  return indexes.some((ix) => {
    if (ix.collectionGroup !== 'listings') return false;
    const eq = ix.fields.slice(0, equalities.length);
    const rest = ix.fields.slice(equalities.length);
    return (
      eq.every((f) => f.order === 'ASCENDING') &&
      [...eq.map((f) => f.fieldPath)].sort().join() === [...equalities].sort().join() &&
      JSON.stringify(rest) === JSON.stringify(ordered)
    );
  });
}

const ORDER: Field[] = [
  { fieldPath: 'rank', order: 'DESCENDING' },
  { fieldPath: 'createdAt', order: 'DESCENDING' },
];

describe('feed indexes', () => {
  for (const genre of [false, true]) {
    for (const age of [false, true]) {
      it(`city${genre ? ' + profile' : ''}${age ? ' + age range' : ''}`, () => {
        const eq = ['status', 'hidden', 'citySlug', ...(genre ? ['genre'] : [])];
        const ordered = age ? [...ORDER, { fieldPath: 'birthMonth', order: 'DESCENDING' as const }] : ORDER;
        expect(hasIndex(eq, ordered)).toBe(true);
      });
    }
  }
});
