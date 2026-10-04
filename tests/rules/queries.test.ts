/**
 * Proofs of the [À PROUVER] query hypotheses of ARCHITECTURE § 9, on the Firestore emulator.
 * NB: the emulator does not require composite indexes; firestore.indexes.json must still be
 * deployed and checked on the real project (see PROGRESS.md).
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';
import * as lite from 'firebase/firestore/lite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  contactDoc,
  createEnv,
  fs,
  memberDocs,
  newListing,
  PROJECT_ID,
  publish,
  seed,
  SETTINGS,
  storedListing,
  userCtx,
} from './setup';

let env: RulesTestEnvironment;
const T0 = Date.UTC(2026, 8, 1);
const at = (minutes: number) => Timestamp.fromMillis(T0 + minutes * 60_000);
const born = (year: number) => Timestamp.fromMillis(Date.UTC(year, 0, 1));

/** id → [rank, createdAt minutes, birth year, city, hidden, status] */
const FIXTURES: Record<string, [number, number, number, string, boolean, string]> = {
  a_1: [0, 10, 1995, 'douala', false, 'active'],
  a_2: [2, 5, 1990, 'douala', false, 'active'],
  a_3: [1, 20, 2000, 'douala', false, 'active'],
  a_4: [0, 30, 1980, 'douala', false, 'active'],
  a_5: [2, 40, 1996, 'douala', false, 'active'],
  b_1: [1, 50, 1993, 'douala', false, 'active'],
  b_2: [0, 60, 1999, 'yaounde', false, 'active'],
  b_3: [0, 70, 1994, 'douala', true, 'active'],
  b_4: [0, 80, 1992, 'douala', false, 'removed'],
};

beforeAll(async () => {
  env = await createEnv();
  await env.clearFirestore();
  const docs: Record<string, DocumentData> = { 'settings/public': SETTINGS };
  for (const [id, [rank, minutes, year, city, hidden, status]] of Object.entries(FIXTURES)) {
    docs[`listings/${id}`] = storedListing(id.split('_')[0] ?? '', {
      rank,
      createdAt: at(minutes),
      birthMonth: born(year),
      citySlug: city,
      hidden,
      status,
      removedReason: status === 'removed' ? 'Motif' : null,
    });
  }
  await seed(env, docs);
});
afterAll(async () => env.cleanup());

const feed = () => collection(fs(env.unauthenticatedContext()), 'listings');
const PUBLIC = [where('status', '==', 'active'), where('hidden', '==', false)] as const;

describe('feed order: Premium > Sponsorisé > gratuit, newest first in each group', () => {
  it('orders by rank desc then createdAt desc, without removed or hidden listings', async () => {
    const snap = await getDocs(
      query(
        feed(),
        ...PUBLIC,
        where('citySlug', '==', 'douala'),
        orderBy('rank', 'desc'),
        orderBy('createdAt', 'desc'),
      ),
    );
    expect(snap.docs.map((d) => d.id)).toEqual(['a_5', 'a_2', 'b_1', 'a_3', 'a_4', 'a_1']);
  });

  it('paginates with startAfter without duplicates or holes', async () => {
    const base = [...PUBLIC, orderBy('rank', 'desc'), orderBy('createdAt', 'desc')] as const;
    const first = await getDocs(query(feed(), ...base, limit(3)));
    const second = await getDocs(query(feed(), ...base, startAfter(first.docs[2]), limit(10)));
    const ids = [...first.docs, ...second.docs].map((d) => d.id);
    expect(ids).toEqual(['a_5', 'a_2', 'b_1', 'a_3', 'b_2', 'a_4', 'a_1']);
  });
});

describe('Premium rail of every city (owner decision of 3 Oct 2026)', () => {
  it('visitor lists every promotion without a city filter: rank > 0, rank then createdAt', async () => {
    const snap = await assertSucceeds(
      getDocs(
        query(
          feed(),
          ...PUBLIC,
          where('rank', '>', 0),
          orderBy('rank', 'desc'),
          orderBy('createdAt', 'desc'),
          limit(100),
        ),
      ),
    );
    expect(snap.docs.map((d) => d.id)).toEqual(['a_5', 'a_2', 'b_1', 'a_3']);
  });

  it('refused without the public filters (hidden or removed listings could leak)', async () => {
    await assertFails(getDocs(query(feed(), where('rank', '>', 0), orderBy('rank', 'desc'), limit(100))));
  });
});

describe('[À PROUVER] age filter: range on birthMonth together with orderBy rank, createdAt', () => {
  it('keeps the rank/createdAt order and filters the age range (born 1990–1996)', async () => {
    const snap = await getDocs(
      query(
        feed(),
        ...PUBLIC,
        where('citySlug', '==', 'douala'),
        where('birthMonth', '>=', born(1990)),
        where('birthMonth', '<=', born(1996)),
        orderBy('rank', 'desc'),
        orderBy('createdAt', 'desc'),
      ),
    );
    // a_5 (1996, P), a_2 (1990, P), b_1 (1993, S), a_1 (1995, free); a_3 (2000) and a_4 (1980) out.
    expect(snap.docs.map((d) => d.id)).toEqual(['a_5', 'a_2', 'b_1', 'a_1']);
  });

  it('works with the genre « in » filter as well', async () => {
    const snap = await getDocs(
      query(
        feed(),
        ...PUBLIC,
        where('genre', 'in', ['femme', 'couple']),
        where('birthMonth', '>=', born(1990)),
        orderBy('rank', 'desc'),
        orderBy('createdAt', 'desc'),
      ),
    );
    expect(snap.docs.map((d) => d.id)).toEqual(['a_5', 'a_2', 'b_1', 'a_3', 'b_2', 'a_1']);
  });
});

describe('[À PROUVER] firestore/lite: queries and count aggregation', () => {
  it('reads the feed and counts listings per city with the lite SDK', async () => {
    const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-api-key' }, 'lite-proof');
    try {
      const db = lite.getFirestore(app);
      lite.connectFirestoreEmulator(db, '127.0.0.1', 8080);
      const listings = lite.collection(db, 'listings');
      const q = lite.query(
        listings,
        lite.where('status', '==', 'active'),
        lite.where('hidden', '==', false),
        lite.where('citySlug', '==', 'douala'),
      );
      const page = await lite.getDocs(
        lite.query(q, lite.orderBy('rank', 'desc'), lite.orderBy('createdAt', 'desc')),
      );
      expect(page.docs[0]?.id).toBe('a_5');
      const count = await lite.getCount(q);
      expect(count.data().count).toBe(6);
    } finally {
      await deleteApp(app);
    }
  });
});

describe('[À PROUVER] lower() handles accented capitals in the rules', () => {
  it('refuses « ÉCOLIÈRE » (É → é) and accepts a neutral capitalised title', async () => {
    await seed(env, memberDocs('alice'));
    const ctx = userCtx(env, 'alice');
    await assertFails(publish(ctx, 'alice_1', newListing('alice', { title: 'ÉCOLIÈRE SAGE' })));
    await assertSucceeds(publish(ctx, 'alice_2', newListing('alice', { title: 'FEMME ÉLÉGANTE' })));
  });
});

describe('contact document is never part of a listing', () => {
  it('has no WhatsApp number in the public listing document', async () => {
    await seed(env, { 'listings/c_1': storedListing('c'), 'listings/c_1/private/contact': contactDoc() });
    const snap = await getDocs(query(feed(), ...PUBLIC, where('ownerUid', '==', 'c')));
    expect(JSON.stringify(snap.docs[0]?.data())).not.toContain('+237');
  });
});
