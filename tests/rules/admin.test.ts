import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  adminDocs,
  contactDoc,
  createEnv,
  daysAgo,
  daysFromNow,
  fs,
  memberDocs,
  seed,
  SETTINGS,
  storedListing,
  userCtx,
} from './setup';
import type { AuditTargetType } from '../../src/data/audit';

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
    ...adminDocs('boss', 'super'),
    ...adminDocs('mod', 'moderator'),
    'listings/alice_1': storedListing('alice'),
    'listings/alice_1/private/contact': contactDoc(),
  });
});

let auditSeq = 0;
const TARGET_TYPES: Record<string, AuditTargetType> = {
  settings: 'settings',
  admins: 'admin',
  users: 'user',
  publicProfiles: 'profile',
  listings: 'listing',
  boostRequests: 'boostRequest',
  verificationRequests: 'verification',
};

/** Target type of a document path, as the admin page will write it in the audit entry. */
function targetTypeOf(path: string): AuditTargetType {
  const type = TARGET_TYPES[path.split('/')[0] ?? ''];
  if (!type) throw new Error(`no audit target type for ${path}`);
  return type;
}

/** Adds an auditLog entry to the batch and returns its id (to put in `auditId`). */
function audit(
  db: Firestore,
  batch: ReturnType<typeof writeBatch>,
  actor: string,
  path: string,
  action: string,
  targetType: AuditTargetType = targetTypeOf(path),
  after: DocumentData | null = null,
) {
  const id = `a${Date.now()}_${auditSeq++}`;
  batch.set(doc(db, `auditLog/${id}`), {
    actorUid: actor,
    action,
    targetType,
    targetId: path.split('/').pop() ?? '',
    before: null,
    after,
    reason: null,
    createdAt: serverTimestamp(),
  });
  return id;
}

/** One audited admin write of `data` on `path` (target id = last path segment). */
function adminWrite(actor: string, path: string, data: DocumentData, withAudit = true, set = false) {
  const db = fs(userCtx(env, actor));
  const batch = writeBatch(db);
  const payload = withAudit ? { ...data, auditId: audit(db, batch, actor, path, 'test') } : data;
  if (set) batch.set(doc(db, path), payload);
  else batch.update(doc(db, path), payload);
  // Sanctions of a member: the mirror read by moderators follows in the same batch.
  if (path.startsWith('users/') && 'strikes' in data && 'publishBanned' in data) {
    batch.set(doc(db, `sanctions/${path.split('/')[1]}`), {
      strikes: data['strikes'],
      publishBanned: data['publishBanned'],
    });
  }
  return batch.commit();
}

describe('admins', () => {
  it('lets the super-admin add a moderator (audited)', async () => {
    await assertSucceeds(
      adminWrite(
        'boss',
        'admins/newmod',
        { role: 'moderator', addedBy: 'boss', addedAt: serverTimestamp() },
        true,
        true,
      ),
    );
  });

  it('refuses a moderator adding a moderator, and the super creating another super', async () => {
    await assertFails(
      adminWrite(
        'mod',
        'admins/x',
        { role: 'moderator', addedBy: 'mod', addedAt: serverTimestamp() },
        true,
        true,
      ),
    );
    await assertFails(
      adminWrite(
        'boss',
        'admins/x',
        { role: 'super', addedBy: 'boss', addedAt: serverTimestamp() },
        true,
        true,
      ),
    );
  });

  it('refuses the super-admin demoting another super-admin; allows removing a moderator', async () => {
    await seed(env, adminDocs('boss2', 'super'));
    const entry = (role: string) => ({ role, addedBy: 'boss', addedAt: serverTimestamp() });
    await assertFails(adminWrite('boss', 'admins/boss2', entry('none'), true, true));
    await assertSucceeds(adminWrite('boss', 'admins/mod', entry('none'), true, true));
  });

  it('refuses a member reading the admin list, lets an admin read their own role', async () => {
    await assertFails(getDocs(collection(fs(userCtx(env, 'alice')), 'admins')));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'mod')), 'admins/mod')));
  });
});

describe('settings', () => {
  it('lets the super-admin change prices (audited)', async () => {
    await assertSucceeds(
      adminWrite('boss', 'settings/public', { prices: { premium: 2500, sponsored: 500 } }),
    );
  });

  it('refuses a moderator or a member changing settings', async () => {
    await assertFails(adminWrite('mod', 'settings/public', { prices: { premium: 1, sponsored: 1 } }));
    await assertFails(
      updateDoc(doc(fs(userCtx(env, 'alice')), 'settings/public'), { maxActiveListings: 50 }),
    );
  });

  it('refuses an admin write without its auditLog entry', async () => {
    await assertFails(
      adminWrite('boss', 'settings/public', { prices: { premium: 2500, sponsored: 500 } }, false),
    );
  });

  it('refuses invalid values (negative price)', async () => {
    await assertFails(adminWrite('boss', 'settings/public', { prices: { premium: -5, sponsored: 500 } }));
  });

  it('support number: any international number (owner, 3 Oct 2026), nothing else', async () => {
    await assertSucceeds(adminWrite('boss', 'settings/public', { supportWhatsApp: '+79003269415' }));
    await assertFails(adminWrite('boss', 'settings/public', { supportWhatsApp: '79003269415' }));
    await assertFails(adminWrite('boss', 'settings/public', { supportWhatsApp: '+12' }));
  });

  it('days of each formula set apart (owner, 3 Oct 2026): 1 to 90 each, never one number', async () => {
    await assertSucceeds(adminWrite('boss', 'settings/public', { boostDays: { premium: 10, sponsored: 3 } }));
    await assertFails(adminWrite('boss', 'settings/public', { boostDays: 7 }));
    await assertFails(adminWrite('boss', 'settings/public', { boostDays: { premium: 91, sponsored: 7 } }));
    await assertFails(adminWrite('boss', 'settings/public', { boostDays: { premium: 7, sponsored: 0 } }));
    await assertFails(adminWrite('boss', 'settings/public', { boostDays: { premium: 7 } }));
  });
});

describe('cap of active listings per account (owner, 3 Oct 2026)', () => {
  it('the super-admin sets it (audited) or goes back to the general setting', async () => {
    await assertSucceeds(adminWrite('boss', 'users/alice', { maxListings: 12 }));
    await assertSucceeds(adminWrite('boss', 'users/alice', { maxListings: null }));
    await assertSucceeds(adminWrite('boss', 'users/alice', { maxListings: 0 }));
  });

  it('refuses a moderator, the member, no audit, or a value outside 0–50', async () => {
    await assertFails(adminWrite('mod', 'users/alice', { maxListings: 12 }));
    await assertFails(adminWrite('alice', 'users/alice', { maxListings: 12 }));
    await assertFails(updateDoc(doc(fs(userCtx(env, 'alice')), 'users/alice'), { maxListings: 12 }));
    await assertFails(adminWrite('boss', 'users/alice', { maxListings: 12 }, false));
    await assertFails(adminWrite('boss', 'users/alice', { maxListings: 51 }));
    await assertFails(adminWrite('boss', 'users/alice', { maxListings: '9' }));
  });
});

describe('moderation', () => {
  interface RemovalOptions {
    /** Listing named in the strike's audit entry (default: the removed one). */
    strikeFor?: string;
    removeListing?: boolean;
    strike?: boolean;
    /** Write the `sanctions` mirror with the strike (default). */
    mirror?: boolean;
  }

  /** Removal of alice_1 for an infraction: listing + strike + notification, as src/lib/admin.ts writes it. */
  function removeForInfraction(actor: string, strikes: number, banned: boolean, o: RemovalOptions = {}) {
    const db = fs(userCtx(env, actor));
    const batch = writeBatch(db);
    if (o.removeListing ?? true) {
      batch.update(doc(db, 'listings/alice_1'), {
        status: 'removed',
        removedReason: 'Contenu interdit',
        auditId: audit(db, batch, actor, 'listings/alice_1', 'listing.remove'),
      });
    }
    if (o.strike ?? true) {
      const strikeAudit = audit(db, batch, actor, 'users/alice', 'user.strike', 'user', {
        strikes,
        publishBanned: banned,
        listingId: o.strikeFor ?? 'alice_1',
      });
      batch.update(doc(db, 'users/alice'), { strikes, publishBanned: banned, auditId: strikeAudit });
      if (o.mirror ?? true) batch.set(doc(db, 'sanctions/alice'), { strikes, publishBanned: banned });
      batch.set(doc(db, 'users/alice/notifications/n1'), {
        type: 'listing_removed',
        title: 'Annonce supprimée',
        body: 'Motif : contenu interdit.',
        read: false,
        createdAt: serverTimestamp(),
        auditId: strikeAudit,
      });
    }
    return batch.commit();
  }

  it('ties a strike to a real removal: none without it, none twice, none for another listing', async () => {
    // Strike alone (no listing removed in the batch).
    await assertFails(removeForInfraction('mod', 1, false, { removeListing: false }));
    // Removal without the strike (SPEC § 10: 5 removals block publication), moderator or super.
    await assertFails(removeForInfraction('mod', 0, false, { strike: false }));
    await assertFails(removeForInfraction('boss', 0, false, { strike: false }));
    // Strike naming a listing of another member.
    await seed(env, { ...memberDocs('bob'), 'listings/bob_1': storedListing('bob') });
    await assertFails(removeForInfraction('mod', 1, false, { strikeFor: 'bob_1' }));
    // Listing already removed: no second strike.
    await seed(env, {
      'listings/alice_1': storedListing('alice', { status: 'removed', removedReason: 'Contenu interdit' }),
    });
    await assertFails(removeForInfraction('mod', 1, false));
  });

  it('keeps the sanctions mirror in step: a strike without it, or a different value, is refused', async () => {
    await assertFails(removeForInfraction('mod', 1, false, { mirror: false }));
    const db = fs(userCtx(env, 'mod'));
    await assertFails(setDoc(doc(db, 'sanctions/alice'), { strikes: 3, publishBanned: false }));
    await assertSucceeds(removeForInfraction('mod', 1, false));
    // The team reads the mirror; a member does not, and cannot write it.
    await assertSucceeds(getDoc(doc(db, 'sanctions/alice')));
    await assertFails(getDoc(doc(fs(userCtx(env, 'alice')), 'sanctions/alice')));
    await assertFails(
      setDoc(doc(fs(userCtx(env, 'alice')), 'sanctions/alice'), { strikes: 1, publishBanned: false }),
    );
  });

  it('allows a removal without strike when the member has no private record any more', async () => {
    await seed(env, { 'listings/carol_1': storedListing('carol') });
    await assertSucceeds(
      adminWrite('mod', 'listings/carol_1', { status: 'removed', removedReason: 'Contenu interdit' }),
    );
  });

  it('lets only the super-admin put a removed listing back online', async () => {
    await seed(env, {
      'listings/alice_1': storedListing('alice', { status: 'removed', removedReason: 'Contenu interdit' }),
    });
    await assertFails(adminWrite('mod', 'listings/alice_1', { status: 'active', removedReason: null }));
    await assertSucceeds(adminWrite('boss', 'listings/alice_1', { status: 'active', removedReason: null }));
  });

  it('lets a moderator remove a listing with a reason, strike +1 and a notification', async () => {
    await assertSucceeds(removeForInfraction('mod', 1, false));
  });

  it('refuses a removal without a reason', async () => {
    await assertFails(adminWrite('mod', 'listings/alice_1', { status: 'removed', removedReason: null }));
  });

  it('forces the publication ban at the 5th strike (moderator)', async () => {
    await seed(env, memberDocs('alice', { strikes: 4 }));
    await assertFails(removeForInfraction('mod', 5, false));
    await assertSucceeds(removeForInfraction('mod', 5, true));
  });

  it('refuses a moderator jumping strikes or lifting a ban; the super-admin can lift it', async () => {
    await seed(env, memberDocs('alice', { strikes: 5, banned: true }));
    await assertFails(adminWrite('mod', 'users/alice', { strikes: 7, publishBanned: true }));
    await assertFails(adminWrite('mod', 'users/alice', { strikes: 6, publishBanned: false }));
    await assertSucceeds(adminWrite('boss', 'users/alice', { strikes: 0, publishBanned: false }));
  });

  it('« Rétablir »: an admin un-hides a listing and resets its report count (audited)', async () => {
    await seed(env, { 'listings/alice_1': storedListing('alice', { hidden: true, reportsCount: 10 }) });
    await assertSucceeds(adminWrite('mod', 'listings/alice_1', { hidden: false, reportsCount: 0 }));
  });

  it('dates the decision with the server time only (older anonymous reports leave the queue)', async () => {
    await seed(env, { 'listings/alice_1': storedListing('alice', { reportsCount: 3 }) });
    await assertSucceeds(
      adminWrite('mod', 'listings/alice_1', { reportsCount: 0, reportsClearedAt: serverTimestamp() }),
    );
    await assertFails(
      adminWrite('mod', 'listings/alice_1', { reportsCount: 0, reportsClearedAt: daysFromNow(30) }),
    );
  });

  it('refuses « Rétablir » without audit or by a member', async () => {
    await seed(env, { 'listings/alice_1': storedListing('alice', { hidden: true, reportsCount: 10 }) });
    await assertFails(adminWrite('mod', 'listings/alice_1', { hidden: false }, false));
    await assertFails(adminWrite('alice', 'listings/alice_1', { hidden: false }));
  });

  it('refuses a moderator granting a boost or a badge; the super-admin can', async () => {
    await assertFails(adminWrite('mod', 'listings/alice_1', { rank: 2, boostUntil: daysFromNow(7) }));
    await assertFails(adminWrite('mod', 'publicProfiles/alice', { verified: true }));
    await assertSucceeds(adminWrite('boss', 'listings/alice_1', { rank: 2, boostUntil: daysFromNow(7) }));
    await assertSucceeds(adminWrite('boss', 'publicProfiles/alice', { verified: true }));
  });

  it('lets the super-admin delete an expired listing (« Nettoyage »), not an active one', async () => {
    await seed(env, { 'listings/alice_2': storedListing('alice', { renewedAt: daysAgo(181) }) });
    const db = fs(userCtx(env, 'boss'));
    await assertFails(deleteDoc(doc(db, 'listings/alice_1')));
    await assertSucceeds(deleteDoc(doc(db, 'listings/alice_2')));
  });

  it('lets the super-admin erase a WhatsApp contact only with its listing', async () => {
    await seed(env, {
      'listings/alice_2': storedListing('alice', { renewedAt: daysAgo(181) }),
      'listings/alice_2/private/contact': contactDoc(),
    });
    const db = fs(userCtx(env, 'boss'));
    await assertFails(deleteDoc(doc(db, 'listings/alice_1/private/contact')));
    const batch = writeBatch(db);
    batch.delete(doc(db, 'listings/alice_2/private/contact'));
    batch.delete(doc(db, 'listings/alice_2'));
    await assertSucceeds(batch.commit());
  });
});

describe('auditLog', () => {
  it('is append-only: no update, no delete, not readable by moderators', async () => {
    await adminWrite('mod', 'listings/alice_1', { hidden: false, reportsCount: 0 });
    await seed(env, {
      'auditLog/fixed': {
        actorUid: 'mod',
        action: 'x',
        targetType: 'listing',
        targetId: 'alice_1',
        before: null,
        after: null,
        reason: null,
        createdAt: new Date(),
      },
    });
    await assertFails(updateDoc(doc(fs(userCtx(env, 'boss')), 'auditLog/fixed'), { action: 'changed' }));
    await assertFails(deleteDoc(doc(fs(userCtx(env, 'boss')), 'auditLog/fixed')));
    await assertFails(getDoc(doc(fs(userCtx(env, 'mod')), 'auditLog/fixed')));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'boss')), 'auditLog/fixed')));
  });

  it('refuses an entry forged in the name of another admin, or by a member', async () => {
    const entry = (actorUid: string) => ({
      actorUid,
      action: 'x',
      targetType: 'listing',
      targetId: 'y',
      before: null,
      after: null,
      reason: null,
      createdAt: serverTimestamp(),
    });
    await assertFails(setDoc(doc(fs(userCtx(env, 'mod')), 'auditLog/f1'), entry('boss')));
    await assertFails(setDoc(doc(fs(userCtx(env, 'alice')), 'auditLog/f2'), entry('alice')));
  });

  it('refuses an audit entry naming another kind of target', async () => {
    const db = fs(userCtx(env, 'boss'));
    const batch = writeBatch(db);
    const auditId = audit(db, batch, 'boss', 'publicProfiles/alice', 'badge', 'user');
    batch.update(doc(db, 'publicProfiles/alice'), { verified: true, auditId });
    await assertFails(batch.commit());
  });

  it('refuses one audit entry covering two documents', async () => {
    const db = fs(userCtx(env, 'boss'));
    const batch = writeBatch(db);
    const auditId = audit(db, batch, 'boss', 'listings/alice_1', 'boost');
    batch.update(doc(db, 'listings/alice_1'), { rank: 2, boostUntil: daysFromNow(7), auditId });
    batch.update(doc(db, 'users/alice'), { strikes: 0, publishBanned: false, auditId });
    await assertFails(batch.commit());
  });
});

describe('boost requests (manual Mobile Money payment)', () => {
  const SCREENSHOT = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD';

  function requestBoost(requestId: string, overrides: DocumentData = {}) {
    const db = fs(userCtx(env, 'alice'));
    const batch = writeBatch(db);
    batch.set(doc(db, `boostRequests/${requestId}`), {
      listingId: 'alice_1',
      ownerUid: 'alice',
      tier: 'premium',
      operator: 'mtn',
      amount: 2000,
      txRef: null,
      screenshot: SCREENSHOT,
      status: 'pending',
      rejectReason: null,
      createdAt: serverTimestamp(),
      handledBy: null,
      handledAt: null,
      ...overrides,
    });
    batch.set(doc(db, 'pendingBoosts/alice_1'), { requestId, createdAt: serverTimestamp() });
    return batch.commit();
  }

  function decide(actor: string, requestId: string, decision: DocumentData) {
    const db = fs(userCtx(env, actor));
    const batch = writeBatch(db);
    batch.update(doc(db, `boostRequests/${requestId}`), {
      ...decision,
      handledBy: actor,
      handledAt: serverTimestamp(),
      auditId: audit(db, batch, actor, `boostRequests/${requestId}`, 'boost.decide'),
    });
    batch.delete(doc(db, 'pendingBoosts/alice_1'));
    return batch.commit();
  }

  it('lets the author request a boost with the exact price and a screenshot', async () => {
    await assertSucceeds(requestBoost('r1'));
  });

  it('refuses a second pending request for the same listing', async () => {
    await assertSucceeds(requestBoost('r1'));
    await assertFails(requestBoost('r2'));
  });

  it('refuses a wrong amount, a non-JPEG screenshot, or another member’s listing', async () => {
    await assertFails(requestBoost('r1', { amount: 100 }));
    await assertFails(requestBoost('r1', { screenshot: 'https://evil.example/x.png' }));
    await seed(env, memberDocs('bob'));
    const db = fs(userCtx(env, 'bob'));
    await assertFails(
      setDoc(doc(db, 'boostRequests/r3'), {
        listingId: 'alice_1',
        ownerUid: 'bob',
        tier: 'sponsored',
        operator: 'orange',
        amount: 500,
        txRef: null,
        screenshot: SCREENSHOT,
        status: 'pending',
        rejectReason: null,
        createdAt: serverTimestamp(),
        handledBy: null,
        handledAt: null,
      }),
    );
  });

  it('refuses a moderator validating a payment; the super-admin can', async () => {
    await requestBoost('r1');
    await assertFails(decide('mod', 'r1', { status: 'approved', rejectReason: null }));
    await assertSucceeds(decide('boss', 'r1', { status: 'approved', rejectReason: null }));
  });

  it('requires a reason to reject', async () => {
    await requestBoost('r1');
    await assertFails(decide('boss', 'r1', { status: 'rejected', rejectReason: null }));
    await assertSucceeds(decide('boss', 'r1', { status: 'rejected', rejectReason: 'Montant non reçu' }));
  });

  it('keeps payment screenshots away from moderators and other members', async () => {
    await requestBoost('r1');
    await seed(env, memberDocs('bob'));
    await assertFails(getDoc(doc(fs(userCtx(env, 'mod')), 'boostRequests/r1')));
    await assertFails(getDoc(doc(fs(userCtx(env, 'bob')), 'boostRequests/r1')));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'alice')), 'boostRequests/r1')));
  });

  it('refuses deleting the pending lock without deciding the request', async () => {
    await requestBoost('r1');
    await assertFails(deleteDoc(doc(fs(userCtx(env, 'boss')), 'pendingBoosts/alice_1')));
  });

  it('shows the pending lock to the author and the super-admin only', async () => {
    await requestBoost('r1');
    await seed(env, memberDocs('bob'));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'alice')), 'pendingBoosts/alice_1')));
    await assertFails(getDoc(doc(fs(userCtx(env, 'bob')), 'pendingBoosts/alice_1')));
  });

  it('lets the super-admin erase a handled screenshot (« Nettoyage »), not a pending one', async () => {
    await requestBoost('r1');
    const db = fs(userCtx(env, 'boss'));
    await assertFails(updateDoc(doc(db, 'boostRequests/r1'), { screenshot: null }));
    await decide('boss', 'r1', { status: 'approved', rejectReason: null });
    await assertSucceeds(updateDoc(doc(db, 'boostRequests/r1'), { screenshot: null }));
  });
});

describe('verified badge requests', () => {
  const ID_IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ';
  const submit = (uid: string, verified = true) =>
    setDoc(doc(fs(userCtx(env, uid, verified)), `verificationRequests/${uid}`), {
      idImage: ID_IMAGE,
      status: 'pending',
      createdAt: serverTimestamp(),
      handledBy: null,
      handledAt: null,
    });

  it('lets a verified member submit an ID photo; refuses an unverified e-mail', async () => {
    await assertSucceeds(submit('alice'));
    await seed(env, memberDocs('bob'));
    await assertFails(submit('bob', false));
  });

  it('ID photos: the super-admin only reads and decides, erasing the image (owner, 3 Oct 2026)', async () => {
    await submit('alice');
    await assertFails(getDoc(doc(fs(userCtx(env, 'mod')), 'verificationRequests/alice')));
    await assertFails(getDocs(collection(fs(userCtx(env, 'mod')), 'verificationRequests')));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'boss')), 'verificationRequests/alice')));
    await assertSucceeds(getDocs(collection(fs(userCtx(env, 'boss')), 'verificationRequests')));
    const decision = { status: 'approved', idImage: null, handledBy: 'boss', handledAt: serverTimestamp() };
    await assertFails(adminWrite('mod', 'verificationRequests/alice', { ...decision, handledBy: 'mod' }));
    await assertFails(adminWrite('boss', 'verificationRequests/alice', { ...decision, idImage: ID_IMAGE }));
    await assertSucceeds(adminWrite('boss', 'verificationRequests/alice', decision));
  });

  it("refuses reading someone else's ID photo", async () => {
    await submit('alice');
    await seed(env, memberDocs('bob'));
    await assertFails(getDoc(doc(fs(userCtx(env, 'bob')), 'verificationRequests/alice')));
  });

  it('allows a new request after a refusal, not while one is pending', async () => {
    await submit('alice');
    await assertFails(submit('alice'));
    await adminWrite('boss', 'verificationRequests/alice', {
      status: 'rejected',
      idImage: null,
      handledBy: 'boss',
      handledAt: serverTimestamp(),
    });
    // New request = update of the member's fields (the admin's auditId stays untouched).
    const ref = doc(fs(userCtx(env, 'alice')), 'verificationRequests/alice');
    const resubmit = {
      idImage: ID_IMAGE,
      status: 'pending',
      createdAt: serverTimestamp(),
      handledBy: null,
      handledAt: null,
    };
    await assertFails(updateDoc(ref, { ...resubmit, auditId: 'forged' }));
    await assertSucceeds(updateDoc(ref, resubmit));
  });
});

describe('admin lists', () => {
  it('lets only the super-admin list private profiles and admins', async () => {
    await assertSucceeds(getDocs(collection(fs(userCtx(env, 'boss')), 'users')));
    await assertFails(getDocs(collection(fs(userCtx(env, 'mod')), 'users')));
    // Private records (e-mail, birth date, WhatsApp): not for moderators (owner, 3 Oct 2026).
    await assertFails(getDoc(doc(fs(userCtx(env, 'mod')), 'users/alice')));
    await assertSucceeds(getDoc(doc(fs(userCtx(env, 'boss')), 'users/alice')));
    await assertFails(getDocs(collection(fs(userCtx(env, 'alice')), 'users')));
    await assertSucceeds(getDocs(collection(fs(userCtx(env, 'boss')), 'admins')));
    await assertFails(getDocs(collection(fs(userCtx(env, 'mod')), 'admins')));
  });
});
