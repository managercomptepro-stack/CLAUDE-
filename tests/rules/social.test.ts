import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  adminDocs,
  anonCtx,
  createEnv,
  daysAgo,
  fs,
  memberDocs,
  seed,
  SETTINGS,
  storedListing,
  userCtx,
} from './setup';

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    'settings/public': SETTINGS,
    ...memberDocs('alice'),
    'listings/alice_1': storedListing('alice', { likes: 2, reportsCount: 0 }),
  });
});

function like(uid: string, anonymous = true) {
  const db = fs(anonymous ? anonCtx(env, uid) : userCtx(env, uid));
  const batch = writeBatch(db);
  batch.set(doc(db, `likes/alice_1_${uid}`), { listingId: 'alice_1', uid, createdAt: serverTimestamp() });
  batch.update(doc(db, 'listings/alice_1'), { likes: increment(1) });
  return batch.commit();
}

function unlike(uid: string) {
  const db = fs(anonCtx(env, uid));
  const batch = writeBatch(db);
  batch.delete(doc(db, `likes/alice_1_${uid}`));
  batch.update(doc(db, 'listings/alice_1'), { likes: increment(-1) });
  return batch.commit();
}

/**
 * A report as src/lib/social.ts writes it. Verified account (default): report + count (+ hide).
 * Anonymous visitor: the report alone, `verified: false` (owner's decision of 3 Oct 2026).
 */
function report(
  uid: string,
  hide = false,
  reason = 'minor',
  o: { anonymous?: boolean; claimVerified?: boolean; count?: boolean; ctxVerified?: boolean } = {},
) {
  const anonymous = o.anonymous ?? false;
  const db = fs(anonymous ? anonCtx(env, uid) : userCtx(env, uid, o.ctxVerified ?? true));
  const verified = o.claimVerified ?? (!anonymous && (o.ctxVerified ?? true));
  const batch = writeBatch(db);
  batch.set(doc(db, `reports/alice_1_${uid}`), {
    listingId: 'alice_1',
    uid,
    reason,
    note: '',
    verified,
    createdAt: serverTimestamp(),
  });
  if (o.count ?? verified) {
    batch.update(
      doc(db, 'listings/alice_1'),
      hide ? { reportsCount: increment(1), hidden: true } : { reportsCount: increment(1) },
    );
  }
  return batch.commit();
}

describe('likes — one per visitor', () => {
  it('lets an anonymous visitor like once, then refuses a second like', async () => {
    await assertSucceeds(like('v1'));
    await assertFails(like('v1'));
  });

  it('lets the visitor remove their like, refuses removing someone else’s', async () => {
    await assertSucceeds(like('v1'));
    await assertFails(unlike('v2'));
    await assertSucceeds(unlike('v1'));
  });

  it('refuses a like counter change without the like document, or by more than 1', async () => {
    const db = fs(anonCtx(env, 'v1'));
    await assertFails(updateDoc(doc(db, 'listings/alice_1'), { likes: increment(1) }));
    const batch = writeBatch(db);
    batch.set(doc(db, 'likes/alice_1_v1'), { listingId: 'alice_1', uid: 'v1', createdAt: serverTimestamp() });
    batch.update(doc(db, 'listings/alice_1'), { likes: increment(5) });
    await assertFails(batch.commit());
  });

  it('refuses a like document without the counter, or forged for another uid', async () => {
    const db = fs(anonCtx(env, 'v1'));
    await assertFails(
      setDoc(doc(db, 'likes/alice_1_v1'), { listingId: 'alice_1', uid: 'v1', createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(db, 'likes/alice_1_v2'), { listingId: 'alice_1', uid: 'v2', createdAt: serverTimestamp() }),
    );
  });

  it('never lets the counter go below 0', async () => {
    await seed(env, {
      'listings/alice_1': storedListing('alice', { likes: 0, createdAt: daysAgo(1) }),
      'likes/alice_1_v1': { listingId: 'alice_1', uid: 'v1', createdAt: Timestamp.now() },
    });
    await assertFails(unlike('v1'));
  });

  it('refuses a like left over from a deleted listing decrementing the new one in the same slot', async () => {
    await seed(env, {
      'listings/alice_1': storedListing('alice', { likes: 3 }),
      'likes/alice_1_v1': { listingId: 'alice_1', uid: 'v1', createdAt: daysAgo(30) },
    });
    await assertFails(unlike('v1'));
  });

  it('requires a session (anonymous at least)', async () => {
    const db = fs(env.unauthenticatedContext());
    const batch = writeBatch(db);
    batch.set(doc(db, 'likes/alice_1_x'), { listingId: 'alice_1', uid: 'x', createdAt: serverTimestamp() });
    batch.update(doc(db, 'listings/alice_1'), { likes: increment(1) });
    await assertFails(batch.commit());
  });

  it('lets a visitor know whether they liked (get own like), not list likes', async () => {
    await like('v1');
    const db = fs(anonCtx(env, 'v1'));
    await assertSucceeds(getDoc(doc(db, 'likes/alice_1_v1')));
    await assertFails(getDoc(doc(fs(anonCtx(env, 'v2')), 'likes/alice_1_v1')));
    await assertFails(getDocs(collection(db, 'likes')));
  });
});

describe('reports — one per visitor, auto-hide at the threshold', () => {
  it('accepts one report per visitor, refuses a second', async () => {
    await assertSucceeds(report('v1'));
    await assertFails(report('v1'));
  });

  it('anonymous or unverified visitor: report stored, never counted (owner, 3 Oct 2026)', async () => {
    await assertSucceeds(report('anon1', false, 'minor', { anonymous: true }));
    await assertSucceeds(report('unv1', false, 'minor', { ctxVerified: false }));
    const l = await getDoc(doc(fs(env.unauthenticatedContext()), 'listings/alice_1'));
    expect(l.data()?.['reportsCount']).toBe(0);
    // Refused: counting it, or claiming to be verified.
    await assertFails(report('anon2', false, 'minor', { anonymous: true, count: true }));
    await assertFails(report('anon3', false, 'minor', { anonymous: true, claimVerified: true, count: true }));
    await assertFails(
      report('anon4', false, 'minor', { anonymous: true, claimVerified: true, count: false }),
    );
    await assertFails(report('unv2', false, 'minor', { ctxVerified: false, count: true }));
  });

  it('anonymous visitors cannot hide a listing, even at the threshold', async () => {
    await seed(env, { 'listings/alice_1': storedListing('alice', { reportsCount: 9 }) });
    await assertFails(report('anon9', true, 'minor', { anonymous: true, count: true }));
    await assertSucceeds(report('ver10', true));
  });

  it('refuses an unknown reason', async () => {
    await assertFails(report('v1', false, 'boring'));
  });

  it('refuses hiding before the threshold (10)', async () => {
    await seed(env, { 'listings/alice_1': storedListing('alice', { reportsCount: 8 }) });
    await assertFails(report('v9', true));
  });

  it('hides the listing with the 10th distinct report', async () => {
    await seed(env, { 'listings/alice_1': storedListing('alice', { reportsCount: 9 }) });
    await assertSucceeds(report('v10', true));
    // Hidden: no longer visible to visitors.
    await assertFails(getDoc(doc(fs(env.unauthenticatedContext()), 'listings/alice_1')));
  });

  it('follows the threshold set in settings', async () => {
    await seed(env, {
      'settings/public': { ...SETTINGS, reportsHideThreshold: 3 },
      'listings/alice_1': storedListing('alice', { reportsCount: 2 }),
    });
    await assertSucceeds(report('v3', true));
  });

  it('keeps reports private: admins read them, visitors do not', async () => {
    await report('v1');
    await seed(env, adminDocs('mod', 'moderator'));
    await assertFails(getDoc(doc(fs(userCtx(env, 'v1')), 'reports/alice_1_v1')));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'mod')), 'reports/alice_1_v1')));
  });

  it('refuses modifying or deleting a report', async () => {
    await report('v1');
    const db = fs(userCtx(env, 'v1'));
    await assertFails(updateDoc(doc(db, 'reports/alice_1_v1'), { reason: 'other' }));
  });
});
