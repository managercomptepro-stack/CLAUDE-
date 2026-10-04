/**
 * Account deletion as a REQUEST (owner's decision of 3 Oct 2026): the member sets
 * `users.deletionRequestedAt` and closes their listings in one batch; the account can no longer
 * publish or edit; the data stays readable by the admins for 60 days; the super-admin erases it
 * (audited, tombstone `deletedAccounts/{uid}` for the nightly job that removes the sign-in account),
 * or the nightly job does it after 60 days (tests/rules/maintenance.test.ts).
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  adminDocs,
  contactDoc,
  createEnv,
  daysAgo,
  fs,
  memberDocs,
  newListing,
  publish,
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

const REQUESTED = { deletionRequestedAt: daysAgo(3) };

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    'settings/public': SETTINGS,
    ...memberDocs('alice'),
    ...memberDocs('bob'),
    ...adminDocs('boss', 'super'),
    ...adminDocs('mod', 'moderator'),
    'listings/alice_1': storedListing('alice'),
    'listings/alice_1/private/contact': contactDoc(),
    'listings/alice_2': storedListing('alice', { status: 'removed', removedReason: 'Motif' }),
    'listings/bob_1': storedListing('bob'),
    'listings/bob_1/private/contact': contactDoc(),
  });
});

/** Member side: one batch, the request and the closing of the active listings. */
function requestDeletion(uid: string, listingIds: string[]) {
  const db = fs(userCtx(env, uid));
  const batch = writeBatch(db);
  batch.update(doc(db, `users/${uid}`), { deletionRequestedAt: serverTimestamp() });
  for (const id of listingIds) {
    batch.update(doc(db, `listings/${id}`), { status: 'closed', updatedAt: serverTimestamp() });
  }
  return batch.commit();
}

/** Seeds alice as having asked for deletion 3 days ago, her listing closed. */
async function aliceRequested(extra: DocumentData = {}) {
  await seed(env, {
    'users/alice': { ...memberDocs('alice')['users/alice'], ...REQUESTED, ...extra },
    'listings/alice_1': storedListing('alice', { status: 'closed' }),
    'users/alice/notifications/n1': {
      type: 'warning',
      title: 'Avertissement',
      body: '',
      read: false,
      createdAt: Timestamp.now(),
      auditId: 'x',
    },
    'verificationRequests/alice': { status: 'pending', photo: 'id', createdAt: Timestamp.now() },
  });
}

/** Super-admin's last batch: audit entry + tombstone + private record deleted (or marked). */
function finalErase(actor: string, uid: string, keepRecord: boolean, withAudit = true) {
  const db = fs(userCtx(env, actor));
  const batch = writeBatch(db);
  const auditId = `erase_${uid}_${Date.now()}`;
  if (withAudit) {
    batch.set(doc(db, `auditLog/${auditId}`), {
      actorUid: actor,
      action: 'account_erase',
      targetType: 'user',
      targetId: uid,
      before: null,
      after: null,
      reason: null,
      createdAt: serverTimestamp(),
    });
  }
  batch.set(doc(db, `deletedAccounts/${uid}`), { erasedAt: serverTimestamp(), auditId });
  if (keepRecord) {
    // Marked erased, the request removed (it no longer counts as a pending one).
    batch.update(doc(db, `users/${uid}`), {
      erasedAt: serverTimestamp(),
      deletionRequestedAt: deleteField(),
      auditId,
    });
  } else batch.delete(doc(db, `users/${uid}`));
  return batch.commit();
}

describe('member: deletion request', () => {
  it('sets the request (server time) and closes the active listings in one batch', async () => {
    await assertSucceeds(requestDeletion('alice', ['alice_1']));
    // Closed: no longer public, still readable by its owner and the admins.
    await assertFails(getDoc(doc(fs(env.unauthenticatedContext()), 'listings/alice_1')));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'alice')), 'listings/alice_1')));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'mod')), 'listings/alice_1')));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'boss')), 'users/alice')));
  });

  it('refuses a chosen date, a second request, and taking the request back', async () => {
    const db = fs(userCtx(env, 'alice'));
    await assertFails(updateDoc(doc(db, 'users/alice'), { deletionRequestedAt: daysAgo(90) }));
    await aliceRequested();
    await assertFails(updateDoc(doc(db, 'users/alice'), { deletionRequestedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { deletionRequestedAt: deleteField() }));
  });

  it('refuses closing a listing without a request, or someone else closing it', async () => {
    const db = fs(userCtx(env, 'alice'));
    await assertFails(
      updateDoc(doc(db, 'listings/alice_1'), { status: 'closed', updatedAt: serverTimestamp() }),
    );
    await assertFails(requestDeletion('alice', ['bob_1']));
  });

  it('once requested: no publishing, no listing edit, no contact change', async () => {
    await aliceRequested();
    const ctx = userCtx(env, 'alice');
    await assertFails(publish(ctx, 'alice_3', newListing('alice')));
    await assertFails(
      updateDoc(doc(fs(ctx), 'listings/alice_1'), { status: 'active', updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(doc(fs(ctx), 'users/alice'), { city: 'kribi' }));
  });

  it('a member without request still publishes and edits (unchanged)', async () => {
    await assertSucceeds(publish(userCtx(env, 'bob'), 'bob_2', newListing('bob')));
    await assertSucceeds(updateDoc(doc(fs(userCtx(env, 'bob')), 'users/bob'), { city: 'kribi' }));
  });
});

describe('super-admin: erasing a requested account', () => {
  it('erases listings, contacts, notifications, badge request, profile, pseudo, then the record', async () => {
    await aliceRequested();
    const db = fs(userCtx(env, 'boss'));
    // A listing and its contact go in the same batch (the contact rule checks the listing is gone).
    const batch = writeBatch(db);
    batch.delete(doc(db, 'listings/alice_1'));
    batch.delete(doc(db, 'listings/alice_1/private/contact'));
    await assertSucceeds(batch.commit());
    await assertSucceeds(deleteDoc(doc(db, 'listings/alice_2')));
    await assertSucceeds(getDocs(collection(db, 'users/alice/notifications')));
    await assertSucceeds(deleteDoc(doc(db, 'users/alice/notifications/n1')));
    await assertSucceeds(deleteDoc(doc(db, 'verificationRequests/alice')));
    await assertSucceeds(deleteDoc(doc(db, 'publicProfiles/alice')));
    await assertSucceeds(deleteDoc(doc(db, 'usernames/membrealice')));
    await assertSucceeds(finalErase('boss', 'alice', false));
    await assertSucceeds(getDoc(doc(db, 'deletedAccounts/alice')));
  });

  it('refuses the record deletion while the public profile exists, or without audit', async () => {
    await aliceRequested();
    await assertFails(finalErase('boss', 'alice', false));
    await assertSucceeds(deleteDoc(doc(fs(userCtx(env, 'boss')), 'publicProfiles/alice')));
    await assertFails(finalErase('boss', 'alice', false, false));
  });

  it('a sanctioned account keeps its private record, marked as erased (decision 13)', async () => {
    await aliceRequested({ strikes: 2 });
    const db = fs(userCtx(env, 'boss'));
    await assertSucceeds(deleteDoc(doc(db, 'publicProfiles/alice')));
    await assertFails(finalErase('boss', 'alice', false));
    await assertSucceeds(finalErase('boss', 'alice', true));
  });

  it('the super-admin can still sanction a member who asked (no escape from a ban)', async () => {
    await aliceRequested();
    const db = fs(userCtx(env, 'boss'));
    const batch = writeBatch(db);
    const auditId = `ban_${Date.now()}`;
    batch.set(doc(db, `auditLog/${auditId}`), {
      actorUid: 'boss',
      action: 'user.ban',
      targetType: 'user',
      targetId: 'alice',
      before: null,
      after: null,
      reason: null,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users/alice'), { publishBanned: true, strikes: 0, auditId });
    batch.set(doc(db, 'sanctions/alice'), { publishBanned: true, strikes: 0 });
    await assertSucceeds(batch.commit());
  });

  it('refuses all of it for a member who did not ask, and for a moderator', async () => {
    const boss = fs(userCtx(env, 'boss'));
    await assertFails(deleteDoc(doc(boss, 'publicProfiles/bob')));
    await assertFails(deleteDoc(doc(boss, 'usernames/membrebob')));
    await assertFails(deleteDoc(doc(boss, 'listings/bob_1')));
    await assertFails(getDocs(collection(boss, 'users/bob/notifications')));
    await aliceRequested();
    const mod = fs(userCtx(env, 'mod'));
    await assertFails(deleteDoc(doc(mod, 'publicProfiles/alice')));
    await assertFails(deleteDoc(doc(mod, 'listings/alice_1')));
    await assertFails(deleteDoc(doc(mod, 'verificationRequests/alice')));
  });

  it('tombstones: super-admin reads, nobody writes them outside the erase batch', async () => {
    await aliceRequested();
    await assertFails(
      setDoc(doc(fs(userCtx(env, 'boss')), 'deletedAccounts/alice'), {
        erasedAt: serverTimestamp(),
        auditId: 'none',
      }),
    );
    await assertFails(getDoc(doc(fs(userCtx(env, 'mod')), 'deletedAccounts/alice')));
    await assertFails(getDoc(doc(fs(userCtx(env, 'bob')), 'deletedAccounts/alice')));
  });

  it('after the erase: the member reads their tombstone and cannot sign up again with this uid', async () => {
    await aliceRequested();
    const boss = fs(userCtx(env, 'boss'));
    await assertSucceeds(deleteDoc(doc(boss, 'publicProfiles/alice')));
    await assertSucceeds(deleteDoc(doc(boss, 'usernames/membrealice')));
    await assertSucceeds(finalErase('boss', 'alice', false));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'alice')), 'deletedAccounts/alice')));
    const signUp = (uid: string, pseudo: string) => {
      const db = fs(userCtx(env, uid));
      const batch = writeBatch(db);
      batch.set(doc(db, `users/${uid}`), {
        ...memberDocs(uid)[`users/${uid}`],
        email: `${uid}@example.cm`,
        termsAcceptedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, `publicProfiles/${uid}`), {
        pseudo,
        photoUrl: null,
        memberSince: serverTimestamp(),
        verified: false,
      });
      batch.set(doc(db, `usernames/${pseudo.toLowerCase()}`), { uid });
      return batch.commit();
    };
    await assertFails(signUp('alice', 'Alice_new'));
    // Same sign-up for a uid without tombstone: accepted (the tombstone is what refuses alice).
    await assertSucceeds(signUp('carol', 'Carol_new'));
  });
});
