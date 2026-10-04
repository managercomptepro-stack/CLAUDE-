import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  anonCtx,
  contactDoc,
  createEnv,
  daysAgo,
  daysFromNow,
  fs,
  memberDocs,
  newListing,
  PHOTO,
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
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, { 'settings/public': SETTINGS, ...memberDocs('alice'), ...memberDocs('bob') });
});

const alice = () => userCtx(env, 'alice');

describe('listings — create', () => {
  it('accepts a verified adult publishing in slot 1 with its private contact', async () => {
    await assertSucceeds(publish(alice(), 'alice_1', newListing('alice')));
  });

  it('refuses an unverified e-mail', async () => {
    await assertFails(publish(userCtx(env, 'alice', false), 'alice_1', newListing('alice')));
  });

  it('follows the account cap set by the super-admin, above or below the general one', async () => {
    await seed(env, { 'users/alice': { ...memberDocs('alice')['users/alice'], maxListings: 9 } });
    await assertSucceeds(publish(alice(), 'alice_9', newListing('alice')));
    await assertFails(publish(alice(), 'alice_10', newListing('alice')));
    await seed(env, { 'users/alice': { ...memberDocs('alice')['users/alice'], maxListings: 1 } });
    await assertSucceeds(publish(alice(), 'alice_1', newListing('alice')));
    await assertFails(publish(alice(), 'alice_2', newListing('alice')));
    // Back to the general setting (null): 7.
    await seed(env, { 'users/alice': { ...memberDocs('alice')['users/alice'], maxListings: null } });
    await assertSucceeds(publish(alice(), 'alice_7', newListing('alice')));
  });

  it('refuses a listing id outside 1–7, and follows maxActiveListings when changed', async () => {
    await assertFails(publish(alice(), 'alice_8', newListing('alice')));
    await assertFails(publish(alice(), 'alice_0', newListing('alice')));
    await assertSucceeds(publish(alice(), 'alice_7', newListing('alice')));
    await seed(env, { 'settings/public': { ...SETTINGS, maxActiveListings: 3 } });
    await assertFails(publish(alice(), 'alice_4', newListing('alice')));
    await assertSucceeds(publish(alice(), 'alice_3', newListing('alice')));
  });

  it("refuses publishing under someone else's id", async () => {
    await assertFails(publish(alice(), 'bob_1', newListing('alice')));
    await assertFails(publish(alice(), 'alice_1', newListing('bob')));
  });

  it('refuses a banned account', async () => {
    await seed(env, memberDocs('alice', { banned: true, strikes: 5 }));
    await assertFails(publish(alice(), 'alice_1', newListing('alice')));
  });

  it('refuses a listing without its private contact document', async () => {
    const db = fs(alice());
    const batch = writeBatch(db);
    batch.set(doc(db, 'listings/alice_1'), newListing('alice'));
    await assertFails(batch.commit());
  });

  it('refuses a contact whose call permission contradicts the contact mode', async () => {
    await assertFails(
      publish(alice(), 'alice_1', newListing('alice', { contactMode: 'message' }), contactDoc(true)),
    );
    await assertSucceeds(
      publish(alice(), 'alice_2', newListing('alice', { contactMode: 'call_message' }), contactDoc(true)),
    );
  });

  it.each([
    ['minor term in title', { title: 'Jeune lycéenne sage' }],
    ['minor age in description', { description: 'Bonjour, j’ai 16 ans et je cherche un ami.' }],
    ['minor term after a new line', { description: 'Bonjour à tous.\nJe suis encore mineure.' }],
    ['price in offer', { offer: 'Massage 10 000 f' }],
    ['tariff word', { description: 'Mes tarifs sont très abordables pour vous.' }],
    ['phone number in description', { description: 'Appelle-moi vite au 6 78 80 24 47 merci.' }],
    ['wa.me link', { offer: 'wa.me/237678802447' }],
    ['e-mail in district', { district: 'moi@exemple.com' }],
    ['upper-case minor term', { title: 'ECOLIERE SAGE' }],
  ])('refuses a forbidden text: %s', async (_label, overrides) => {
    await assertFails(publish(alice(), 'alice_1', newListing('alice', overrides)));
  });

  it('accepts the owner’s legitimate examples (« 25 ans », « 1m75 », « 2 enfants », « né en 1995 »)', async () => {
    await assertSucceeds(
      publish(
        alice(),
        'alice_1',
        newListing('alice', {
          title: 'Femme de 25 ans, 1m75',
          description: 'Maman de 2 enfants, née en 1995, je cherche une relation sérieuse.',
        }),
      ),
    );
  });

  it('refuses texts that are too long or missing', async () => {
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { title: 'x'.repeat(61) })));
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { description: 'Court' })));
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { offer: 'o'.repeat(301) })));
  });

  it('refuses 0 or 6 photos, accepts 5', async () => {
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { photos: [] })));
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { photos: Array(6).fill(PHOTO) })));
    await assertSucceeds(publish(alice(), 'alice_1', newListing('alice', { photos: Array(5).fill(PHOTO) })));
  });

  it('refuses a boost, counters, hidden flag or verified badge set by the author', async () => {
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { rank: 2 })));
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { boostUntil: daysFromNow(7) })));
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { views: 100 })));
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { likes: 5 })));
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { verified: true })));
  });

  it('refuses denormalised fields that differ from the profile (pseudo, birth month)', async () => {
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { pseudo: 'Quelqu’un' })));
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { birthMonth: daysAgo(3000) })));
  });

  it('accepts the heaviest valid listing, then its heaviest edit (1000-expression limit)', async () => {
    const heavy = {
      photos: Array(5).fill(PHOTO),
      title: 't'.repeat(60),
      description: 'Une description longue et honnête. '.repeat(28).slice(0, 1000),
      offer: 'o'.repeat(300),
      district: 'd'.repeat(40),
      contactMode: 'call_message',
    };
    await assertSucceeds(publish(alice(), 'alice_1', newListing('alice', heavy)));
    const db = fs(alice());
    const batch = writeBatch(db);
    batch.update(doc(db, 'listings/alice_1'), {
      ...heavy,
      title: 'u'.repeat(60),
      contactMode: 'message',
      renewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'listings/alice_1/private/contact'), { callAllowed: false });
    await assertSucceeds(batch.commit());
  });

  it('refuses a city outside the 28 cities', async () => {
    await assertFails(publish(alice(), 'alice_1', newListing('alice', { citySlug: 'paris' })));
  });
});

describe('listings — author edits', () => {
  beforeEach(async () =>
    seed(env, {
      'listings/alice_1': storedListing('alice'),
      'listings/alice_1/private/contact': contactDoc(),
    }),
  );

  it('the WhatsApp number: changed by its author, not once publication is blocked', async () => {
    await assertSucceeds(
      setDoc(doc(fs(alice()), 'listings/alice_1/private/contact'), {
        whatsapp: '+237699887766',
        callAllowed: false,
      }),
    );
    await seed(env, memberDocs('alice', { strikes: 5, banned: true }));
    await assertFails(
      setDoc(doc(fs(alice()), 'listings/alice_1/private/contact'), {
        whatsapp: '+237677665544',
        callAllowed: false,
      }),
    );
  });

  it('lets the author edit texts and photos', async () => {
    const db = fs(alice());
    await assertSucceeds(
      updateDoc(doc(db, 'listings/alice_1'), { title: 'Nouveau titre', updatedAt: serverTimestamp() }),
    );
  });

  it('lets the author republish (renewedAt = now) and refuses a renewedAt in the future', async () => {
    const db = fs(alice());
    await assertSucceeds(
      updateDoc(doc(db, 'listings/alice_1'), { renewedAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(doc(db, 'listings/alice_1'), { renewedAt: daysFromNow(400), updatedAt: serverTimestamp() }),
    );
  });

  it('refuses the author touching rank, boostUntil, views, verified, status', async () => {
    const db = fs(alice());
    const ref = doc(db, 'listings/alice_1');
    await assertFails(updateDoc(ref, { rank: 2, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { boostUntil: daysFromNow(7), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { views: 999 }));
    await assertFails(updateDoc(ref, { verified: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { status: 'removed', updatedAt: serverTimestamp() }));
  });

  it('refuses an edit introducing a forbidden text', async () => {
    await assertFails(
      updateDoc(doc(fs(alice()), 'listings/alice_1'), {
        offer: 'Prix 5000 frs',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses edits by another member', async () => {
    await assertFails(
      updateDoc(doc(fs(userCtx(env, 'bob')), 'listings/alice_1'), {
        title: 'Piraté',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('refuses editing a listing removed by moderation, but allows erasing it (decision 3)', async () => {
    await seed(env, {
      'listings/alice_1': storedListing('alice', { status: 'removed', removedReason: 'Contenu interdit' }),
    });
    const db = fs(alice());
    await assertFails(
      updateDoc(doc(db, 'listings/alice_1'), { title: 'Retour', updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(doc(db, 'listings/alice_1'), { status: 'active', removedReason: null }));
    await assertSucceeds(deleteDoc(doc(db, 'listings/alice_1')));
  });
});

describe('listings — views', () => {
  beforeEach(async () => seed(env, { 'listings/alice_1': storedListing('alice', { views: 4 }) }));

  it('lets any visitor add exactly 1 view', async () => {
    await assertSucceeds(
      updateDoc(doc(fs(env.unauthenticatedContext()), 'listings/alice_1'), { views: increment(1) }),
    );
  });

  it('refuses +2, a decrease, or another field with the view', async () => {
    const ref = doc(fs(env.unauthenticatedContext()), 'listings/alice_1');
    await assertFails(updateDoc(ref, { views: increment(2) }));
    await assertFails(updateDoc(ref, { views: 3 }));
    await assertFails(updateDoc(ref, { views: increment(1), likes: 50 }));
  });
});

describe('listings — expired boost reset (decision 2)', () => {
  it('lets anyone demote an expired boost to rank 0 / null', async () => {
    await seed(env, { 'listings/alice_1': storedListing('alice', { rank: 2, boostUntil: daysAgo(1) }) });
    await assertSucceeds(
      updateDoc(doc(fs(env.unauthenticatedContext()), 'listings/alice_1'), { rank: 0, boostUntil: null }),
    );
  });

  it('refuses it while the boost is still running', async () => {
    await seed(env, { 'listings/alice_1': storedListing('alice', { rank: 2, boostUntil: daysFromNow(2) }) });
    await assertFails(
      updateDoc(doc(fs(env.unauthenticatedContext()), 'listings/alice_1'), { rank: 0, boostUntil: null }),
    );
  });

  it('refuses it on an unlimited boost (boostUntil null)', async () => {
    await seed(env, { 'listings/alice_1': storedListing('alice', { rank: 1, boostUntil: null }) });
    await assertFails(updateDoc(doc(fs(env.unauthenticatedContext()), 'listings/alice_1'), { rank: 0 }));
  });

  it('refuses any other change or another target value through this path', async () => {
    await seed(env, { 'listings/alice_1': storedListing('alice', { rank: 2, boostUntil: daysAgo(1) }) });
    const ref = doc(fs(env.unauthenticatedContext()), 'listings/alice_1');
    await assertFails(updateDoc(ref, { rank: 0, boostUntil: null, title: 'Changé' }));
    await assertFails(updateDoc(ref, { rank: 1, boostUntil: null }));
    await assertFails(updateDoc(ref, { rank: 0, boostUntil: daysFromNow(30) }));
  });
});

describe('listings — reading', () => {
  beforeEach(async () =>
    seed(env, {
      'listings/alice_1': storedListing('alice'),
      'listings/alice_1/private/contact': contactDoc(),
      'listings/alice_2': storedListing('alice', { status: 'removed', removedReason: 'Motif' }),
      'listings/alice_2/private/contact': contactDoc(),
      'listings/bob_1': storedListing('bob', { hidden: true }),
    }),
  );

  it('lets anyone read an active listing and query the public feed', async () => {
    const db = fs(env.unauthenticatedContext());
    await assertSucceeds(getDoc(doc(db, 'listings/alice_1')));
    await assertSucceeds(
      getDocs(
        query(collection(db, 'listings'), where('status', '==', 'active'), where('hidden', '==', false)),
      ),
    );
  });

  it('refuses a feed query that does not filter out removed/hidden listings', async () => {
    await assertFails(getDocs(collection(fs(env.unauthenticatedContext()), 'listings')));
  });

  it('hides removed and hidden listings from visitors, shows them to their author', async () => {
    const visitor = fs(env.unauthenticatedContext());
    await assertFails(getDoc(doc(visitor, 'listings/alice_2')));
    await assertFails(getDoc(doc(visitor, 'listings/bob_1')));
    await assertSucceeds(getDoc(doc(fs(alice()), 'listings/alice_2')));
    await assertSucceeds(
      getDocs(query(collection(fs(alice()), 'listings'), where('ownerUid', '==', 'alice'))),
    );
  });

  it('serves the WhatsApp contact by get only, never by list, to a session (anonymous is enough)', async () => {
    const db = fs(anonCtx(env, 'visitor1'));
    await assertSucceeds(getDoc(doc(db, 'listings/alice_1/private/contact')));
    await assertFails(getDocs(collection(db, 'listings/alice_1/private')));
  });

  it('refuses the contact without any session (no scraping with a bare API key)', async () => {
    await assertFails(getDoc(doc(fs(env.unauthenticatedContext()), 'listings/alice_1/private/contact')));
  });

  it('refuses the contact of a removed listing to visitors', async () => {
    await assertFails(getDoc(doc(fs(anonCtx(env, 'visitor1')), 'listings/alice_2/private/contact')));
  });
});

describe('listings — deletion', () => {
  beforeEach(async () =>
    seed(env, {
      'listings/alice_1': storedListing('alice'),
      'listings/alice_1/private/contact': contactDoc(),
    }),
  );

  it('lets the author delete the listing and its contact', async () => {
    const db = fs(alice());
    await assertSucceeds(deleteDoc(doc(db, 'listings/alice_1/private/contact')));
    await assertSucceeds(deleteDoc(doc(db, 'listings/alice_1')));
  });

  it('refuses deletion by another member', async () => {
    const db = fs(userCtx(env, 'bob'));
    await assertFails(deleteDoc(doc(db, 'listings/alice_1')));
    await assertFails(deleteDoc(doc(db, 'listings/alice_1/private/contact')));
  });

  it('refuses the author deleting a listing hidden by reports (awaiting an admin)', async () => {
    await seed(env, { 'listings/alice_1': storedListing('alice', { hidden: true, reportsCount: 10 }) });
    await assertFails(deleteDoc(doc(fs(alice()), 'listings/alice_1')));
  });

  it('still lets the author erase a hidden listing once moderation removed it', async () => {
    await seed(env, {
      'listings/alice_1': storedListing('alice', { hidden: true, status: 'removed', removedReason: 'Motif' }),
    });
    await assertSucceeds(deleteDoc(doc(fs(alice()), 'listings/alice_1')));
  });
});
