import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { adminDocs, anonCtx, birthDate, createEnv, fs, memberDocs, seed, SETTINGS, userCtx } from './setup';

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, { 'settings/public': SETTINGS });
});

function newUser(uid: string, overrides: DocumentData = {}): DocumentData {
  return {
    email: `${uid}@example.cm`,
    birthDate: birthDate(25),
    genre: 'homme',
    city: 'yaounde',
    whatsapp: '+237699112233',
    termsVersion: '2026-10-1',
    termsAcceptedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    strikes: 0,
    publishBanned: false,
    ...overrides,
  };
}

/** Sign-up batch: users + publicProfiles + usernames, as the sign-up page will write it. */
async function signUp(uid: string, pseudo: string, user: DocumentData = newUser(uid), verified = false) {
  const db = fs(userCtx(env, uid, verified));
  const batch = writeBatch(db);
  batch.set(doc(db, `users/${uid}`), user);
  batch.set(doc(db, `publicProfiles/${uid}`), {
    pseudo,
    photoUrl: null,
    memberSince: serverTimestamp(),
    verified: false,
  });
  batch.set(doc(db, `usernames/${pseudo.toLowerCase()}`), { uid });
  return batch.commit();
}

describe('users — sign-up', () => {
  it('accepts an adult with a complete profile (e-mail not yet verified)', async () => {
    await assertSucceeds(signUp('bob', 'Bob_237'));
  });

  it('accepts someone who turns 18 exactly 6575 days ago', async () => {
    const exact = new Date(Date.now() - 6575 * 86_400_000 - 60_000);
    await assertSucceeds(signUp('eve', 'Eve2000', newUser('eve', { birthDate: exact })));
  });

  it('refuses a minor of 17 years and 364 days', async () => {
    const minor = new Date(Date.now() - (6575 - 1) * 86_400_000);
    await assertFails(signUp('kid', 'Kid2008', newUser('kid', { birthDate: minor })));
  });

  it('refuses a pre-filled strike count or ban flag', async () => {
    await assertFails(signUp('bob', 'Bob_237', newUser('bob', { strikes: 3 })));
    await assertFails(signUp('bob', 'Bob_237', newUser('bob', { publishBanned: true })));
  });

  it('refuses an unknown city, genre, or an invalid WhatsApp number', async () => {
    await assertFails(signUp('bob', 'Bob_237', newUser('bob', { city: 'paris' })));
    await assertFails(signUp('bob', 'Bob_237', newUser('bob', { genre: 'robot' })));
    await assertFails(signUp('bob', 'Bob_237', newUser('bob', { whatsapp: '678802447' })));
  });

  it('refuses an old terms version and an e-mail different from the account', async () => {
    await assertFails(signUp('bob', 'Bob_237', newUser('bob', { termsVersion: '2020-1' })));
    await assertFails(signUp('bob', 'Bob_237', newUser('bob', { email: 'other@example.cm' })));
  });

  it('refuses an anonymous session', async () => {
    const db = fs(anonCtx(env, 'anon1'));
    await assertFails(setDoc(doc(db, 'users/anon1'), newUser('anon1')));
  });

  it("refuses writing someone else's profile", async () => {
    const db = fs(userCtx(env, 'mallory'));
    await assertFails(setDoc(doc(db, 'users/bob'), newUser('bob')));
  });
});

describe('usernames — unique pseudo', () => {
  it('refuses a pseudo already taken (case-insensitive)', async () => {
    await assertSucceeds(signUp('bob', 'Bob_237'));
    await assertFails(signUp('carl', 'BOB_237'));
  });

  it('refuses a pseudo with forbidden terms or bad characters', async () => {
    await assertFails(signUp('bob', 'teen_love'));
    await assertFails(signUp('bob', 'Admin_237'));
    await assertFails(signUp('bob', 'nioxxer.officiel'));
    await assertFails(signUp('bob', 'lycéenne'));
    await assertFails(signUp('bob', 'ab'));
  });

  it('refuses a username document pointing to another uid', async () => {
    const db = fs(userCtx(env, 'bob'));
    await assertFails(setDoc(doc(db, 'usernames/someone'), { uid: 'alice' }));
  });

  it('lets anyone check whether a pseudo exists, but not list them', async () => {
    await seed(env, memberDocs('alice'));
    const db = fs(env.unauthenticatedContext());
    await assertSucceeds(getDoc(doc(db, 'usernames/membrealice')));
    await assertSucceeds(getDoc(doc(db, 'usernames/free-name')));
  });
});

describe('users — updates', () => {
  beforeEach(async () => seed(env, memberDocs('alice')));

  it('lets the owner change city and WhatsApp', async () => {
    const db = fs(userCtx(env, 'alice'));
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { city: 'kribi', whatsapp: '+237655443322' }));
  });

  it('refuses any change of the birth date (immutable)', async () => {
    const db = fs(userCtx(env, 'alice'));
    await assertFails(updateDoc(doc(db, 'users/alice'), { birthDate: birthDate(40) }));
  });

  it('refuses the owner touching strikes or publishBanned', async () => {
    const db = fs(userCtx(env, 'alice', true));
    await assertFails(updateDoc(doc(db, 'users/alice'), { strikes: 0, publishBanned: true }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { publishBanned: false, strikes: 1 }));
  });

  it('refuses another member reading a private profile, allows the owner', async () => {
    await seed(env, memberDocs('bob'));
    await assertFails(getDoc(doc(fs(userCtx(env, 'bob')), 'users/alice')));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'alice')), 'users/alice')));
  });

  it('accepts a new terms version only with a fresh acceptance date', async () => {
    await seed(env, { 'settings/public': { ...SETTINGS, termsVersion: '2027-01-1' } });
    const db = fs(userCtx(env, 'alice'));
    await assertFails(updateDoc(doc(db, 'users/alice'), { termsVersion: '2027-01-1' }));
    await assertSucceeds(
      updateDoc(doc(db, 'users/alice'), { termsVersion: '2027-01-1', termsAcceptedAt: serverTimestamp() }),
    );
  });
});

describe('publicProfiles', () => {
  beforeEach(async () => seed(env, memberDocs('alice')));

  it('is readable by everyone one at a time; the list of all members is for the team only', async () => {
    await assertSucceeds(getDoc(doc(fs(env.unauthenticatedContext()), 'publicProfiles/alice')));
    await assertFails(getDocs(collection(fs(env.unauthenticatedContext()), 'publicProfiles')));
    await assertFails(getDocs(collection(fs(userCtx(env, 'bob')), 'publicProfiles')));
    await seed(env, { 'admins/mod': { role: 'moderator', addedBy: 'console', addedAt: new Date() } });
    await assertSucceeds(getDocs(collection(fs(userCtx(env, 'mod')), 'publicProfiles')));
  });

  it('lets the owner set a Cloudinary photo URL, refuses another URL', async () => {
    const db = fs(userCtx(env, 'alice'));
    // Shape of a real `secure_url` of the nioxxer_avatar preset (upload test, 2 Oct 2026).
    await assertSucceeds(
      updateDoc(doc(db, 'publicProfiles/alice'), {
        photoUrl: 'https://res.cloudinary.com/bcxiwwkh/image/upload/v1790960020/j0jjvgfilrtqchvyoqes.jpg',
      }),
    );
    await assertSucceeds(updateDoc(doc(db, 'publicProfiles/alice'), { photoUrl: null }));
    // Transformations in the stored URL (e.g. a text overlay) are refused.
    await assertFails(
      updateDoc(doc(db, 'publicProfiles/alice'), {
        photoUrl:
          'https://res.cloudinary.com/bcxiwwkh/image/upload/l_text:Arial_80:hello/v1790960020/j0jjvgfilrtqchvyoqes.jpg',
      }),
    );
    await assertFails(
      updateDoc(doc(db, 'publicProfiles/alice'), {
        photoUrl: 'https://res.cloudinary.com/bcxiwwkh/image/upload/v1/x.jpg?x=1',
      }),
    );
    await assertFails(updateDoc(doc(db, 'publicProfiles/alice'), { photoUrl: 'https://evil.example/x.jpg' }));
    await assertFails(
      updateDoc(doc(db, 'publicProfiles/alice'), {
        photoUrl: 'https://res.cloudinary.com/another-cloud/image/upload/v1/x.jpg',
      }),
    );
  });

  it('refuses the owner changing the pseudo or the verified badge', async () => {
    const db = fs(userCtx(env, 'alice'));
    await assertFails(updateDoc(doc(db, 'publicProfiles/alice'), { pseudo: 'Autre' }));
    await assertFails(updateDoc(doc(db, 'publicProfiles/alice'), { verified: true }));
  });
});

describe('notifications', () => {
  beforeEach(async () => {
    await seed(env, { ...memberDocs('alice'), ...adminDocs('mod', 'moderator') });
    await seed(env, {
      'users/alice/notifications/n1': {
        type: 'warning',
        title: 'Avertissement',
        body: 'Merci de respecter les règles.',
        read: false,
        createdAt: new Date(),
      },
    });
  });

  it('lets the owner read and mark as read, nothing else', async () => {
    const db = fs(userCtx(env, 'alice'));
    await assertSucceeds(getDoc(doc(db, 'users/alice/notifications/n1')));
    await assertSucceeds(updateDoc(doc(db, 'users/alice/notifications/n1'), { read: true }));
    await assertFails(updateDoc(doc(db, 'users/alice/notifications/n1'), { title: 'Faux' }));
  });

  /** Notification with its audit entry in the same batch (rules: `auditedBy`). */
  function notifyAudited(actor: string, id: string, type: string, withAudit = true) {
    const db = fs(userCtx(env, actor));
    const batch = writeBatch(db);
    const auditId = `aud_${id}`;
    if (withAudit) {
      batch.set(doc(db, `auditLog/${auditId}`), {
        actorUid: actor,
        action: 'user.warn',
        targetType: 'user',
        targetId: 'alice',
        before: null,
        after: null,
        reason: 'Test',
        createdAt: serverTimestamp(),
      });
    }
    batch.set(doc(db, `users/alice/notifications/${id}`), {
      type,
      title: 'T',
      body: 'B',
      read: false,
      createdAt: serverTimestamp(),
      auditId,
    });
    return batch.commit();
  }

  it('refuses a member creating a notification, allows an admin with its audit entry', async () => {
    await assertFails(notifyAudited('alice', 'n2', 'warning'));
    await assertSucceeds(notifyAudited('mod', 'n3', 'warning'));
  });

  it('refuses an admin notification without its audit entry of the same batch', async () => {
    await assertFails(notifyAudited('mod', 'n5', 'warning', false));
  });

  it('keeps payment and badge news to the super-admin', async () => {
    await seed(env, adminDocs('boss', 'super'));
    await assertFails(notifyAudited('mod', 'n6', 'boost_approved'));
    await assertFails(notifyAudited('mod', 'n7', 'badge_granted'));
    await assertSucceeds(notifyAudited('boss', 'n8', 'boost_approved'));
  });

  it('lets the owner list and count their notifications (bell, /compte), refuses another member', async () => {
    await seed(env, memberDocs('bob'));
    const list = (uid: string) =>
      getDocs(
        query(
          collection(fs(userCtx(env, uid)), 'users/alice/notifications'),
          orderBy('createdAt', 'desc'),
          limit(30),
        ),
      );
    const unread = (uid: string) =>
      getCountFromServer(
        query(collection(fs(userCtx(env, uid)), 'users/alice/notifications'), where('read', '==', false)),
      );
    await assertSucceeds(list('alice'));
    await assertSucceeds(unread('alice'));
    await assertFails(list('bob'));
    await assertFails(unread('bob'));
  });

  it("refuses reading someone else's notifications", async () => {
    await seed(env, memberDocs('bob'));
    await assertFails(getDoc(doc(fs(userCtx(env, 'bob')), 'users/alice/notifications/n1')));
  });

  it('lets the owner delete a notification, refuses another member', async () => {
    await seed(env, memberDocs('bob'));
    await assertFails(deleteDoc(doc(fs(userCtx(env, 'bob')), 'users/alice/notifications/n1')));
    await assertSucceeds(deleteDoc(doc(fs(userCtx(env, 'alice')), 'users/alice/notifications/n1')));
  });

  it('refuses an unknown notification type', async () => {
    await assertFails(notifyAudited('mod', 'n4', 'promo'));
  });
});

describe('account deletion (a request since 3 Oct 2026: no self-delete)', () => {
  function deleteAccount(uid: string) {
    const db = fs(userCtx(env, uid));
    const batch = writeBatch(db);
    batch.delete(doc(db, `users/${uid}`));
    batch.delete(doc(db, `publicProfiles/${uid}`));
    batch.delete(doc(db, `usernames/membre${uid}`));
    return batch.commit();
  }

  it('refuses the owner deleting profile, public profile and pseudo, together or alone', async () => {
    await seed(env, memberDocs('alice'));
    const db = fs(userCtx(env, 'alice'));
    await assertFails(deleteAccount('alice'));
    await assertFails(deleteDoc(doc(db, 'users/alice')));
    await assertFails(deleteDoc(doc(db, 'publicProfiles/alice')));
    await assertFails(deleteDoc(doc(db, 'usernames/membrealice')));
  });

  it("refuses deleting someone else's data", async () => {
    await seed(env, memberDocs('alice'));
    const db = fs(userCtx(env, 'bob'));
    await assertFails(deleteDoc(doc(db, 'users/alice')));
    await assertFails(deleteDoc(doc(db, 'usernames/membrealice')));
  });
});
