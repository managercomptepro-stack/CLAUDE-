/**
 * scripts/maintenance.ts against the Firestore emulator (firebase-admin, own demo project) with an
 * in-memory Cloudinary: analysis without writes (--dry-run), real run, idempotence, the orphan
 * guard and a failing step.
 */
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runMaintenance, type CloudinaryApi, type CloudinaryAsset } from '../../scripts/maintenance';

const PROJECT = 'demo-nioxxer-maintenance';
const HOST = process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080';
const DAY = 86_400_000;
const NOW = new Date();
const ago = (days: number) => Timestamp.fromMillis(NOW.getTime() - days * DAY);
const avatar = (id: string) => `https://res.cloudinary.com/bcxiwwkh/image/upload/v1759400000/${id}.jpg`;

let app: App;
let db: Firestore;

class FakeCloudinary implements CloudinaryApi {
  deleted: string[] = [];
  failList = false;
  constructor(public folders: Record<string, CloudinaryAsset[]>) {}
  listFolder(folder: string): Promise<CloudinaryAsset[]> {
    if (this.failList) return Promise.reject(new Error('E_CLOUDINARY_500'));
    return Promise.resolve([...(this.folders[folder] ?? [])]);
  }
  deleteImages(ids: readonly string[]): Promise<void> {
    this.deleted.push(...ids);
    for (const f of Object.keys(this.folders)) {
      this.folders[f] = (this.folders[f] ?? []).filter((a) => !ids.includes(a.publicId));
    }
    return Promise.resolve();
  }
}

const asset = (publicId: string, hoursAgo: number): CloudinaryAsset => ({
  publicId,
  createdAt: new Date(NOW.getTime() - hoursAgo * 3_600_000),
});

function cloud(): FakeCloudinary {
  return new FakeCloudinary({
    listings: [
      asset('oldA', 5000),
      asset('oldB', 5000),
      asset('oldC', 5000),
      asset('freshA', 240),
      asset('fresh2', 240),
      asset('orphanOld', 72),
      asset('orphanNew', 1),
      asset('nioxxer_watermark', 9000),
    ],
    avatars: [asset('avUsed', 300), asset('avProfile', 300), asset('avOrphan', 300)],
  });
}

function listing(over: Record<string, unknown>): Record<string, unknown> {
  return {
    ownerUid: 'owner',
    title: 'Annonce',
    status: 'active',
    hidden: false,
    rank: 0,
    boostUntil: null,
    photos: [],
    profilePhotoUrl: null,
    createdAt: ago(10),
    renewedAt: ago(10),
    ...over,
  };
}

async function clear(): Promise<void> {
  const res = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`clear ${res.status}`);
}

async function seed(): Promise<void> {
  const docs: Record<string, Record<string, unknown>> = {
    'listings/old_1': listing({
      renewedAt: ago(200),
      createdAt: ago(200),
      photos: ['oldA:10x10', 'oldB:10x10'],
    }),
    'listings/old_1/private/contact': { whatsapp: '+237600000000', callAllowed: false },
    'pendingBoosts/old_1': { requestId: 'r3', createdAt: ago(1) },
    'pendingBoosts/fresh_2': { requestId: 'r5', createdAt: ago(1) },
    'listings/old_2': listing({ renewedAt: ago(190), rank: 2, boostUntil: ago(1), photos: ['oldC:10x10'] }),
    'listings/fresh_1': listing({
      rank: 1,
      boostUntil: ago(2),
      photos: ['freshA:10x10'],
      profilePhotoUrl: avatar('avUsed'),
    }),
    'listings/fresh_2': listing({ rank: 2, boostUntil: ago(-3), photos: ['fresh2:10x10'] }),
    'listings/fresh_3': listing({ rank: 2, boostUntil: null }),
    'likes/old_1_u1': { listingId: 'old_1', uid: 'u1', createdAt: ago(100) },
    'likes/fresh_1_u3': { listingId: 'fresh_1', uid: 'u3', createdAt: ago(5) },
    'likes/gone_1_u4': { listingId: 'gone_1', uid: 'u4', createdAt: ago(50) },
    'likes/fresh_2_u5': { listingId: 'fresh_2', uid: 'u5', createdAt: ago(30) },
    'reports/old_1_u2': { listingId: 'old_1', uid: 'u2', reason: 'other', note: '', createdAt: ago(100) },
    'reports/gone_2_u6': { listingId: 'gone_2', uid: 'u6', reason: 'other', note: '', createdAt: ago(50) },
    'reports/fresh_1_u7': { listingId: 'fresh_1', uid: 'u7', reason: 'other', note: '', createdAt: ago(1) },
    'publicProfiles/p1': { pseudo: 'P1', photoUrl: avatar('avProfile'), verified: false },
    'boostRequests/r1': { status: 'approved', handledAt: ago(40), screenshot: 'data:image/jpeg;base64,AA' },
    'boostRequests/r2': { status: 'rejected', handledAt: ago(10), screenshot: 'data:image/jpeg;base64,AA' },
    'boostRequests/r3': { status: 'pending', handledAt: null, screenshot: 'data:image/jpeg;base64,AA' },
    'boostRequests/r4': { status: 'approved', handledAt: ago(40), screenshot: null },
    'verificationRequests/v1': {
      status: 'approved',
      handledAt: ago(1),
      idImage: 'data:image/jpeg;base64,AA',
    },
    'verificationRequests/v2': { status: 'pending', handledAt: null, idImage: 'data:image/jpeg;base64,AA' },
  };
  const batch = db.batch();
  for (const [path, data] of Object.entries(docs)) batch.set(db.doc(path), data);
  await batch.commit();
}

async function snapshot(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const name of [
    'listings',
    'likes',
    'reports',
    'publicProfiles',
    'boostRequests',
    'verificationRequests',
    'auditLog',
  ]) {
    for (const d of (await db.collection(name).get()).docs) out[d.ref.path] = d.data();
  }
  const contact = await db.doc('listings/old_1/private/contact').get();
  out['contact'] = contact.exists;
  return out;
}

async function audit(): Promise<{ action: string; actorUid: string; targetId: string; reason: unknown }[]> {
  return (await db.collection('auditLog').get()).docs.map((d) => ({
    action: String(d.get('action')),
    actorUid: String(d.get('actorUid')),
    targetId: String(d.get('targetId')),
    reason: d.get('reason'),
  }));
}

const EXPECTED = {
  expiredListings: 2,
  expiredLikes: 1,
  expiredReports: 1,
  expiredPhotos: 3,
  boostsExpired: 1,
  orphanLikes: 2,
  orphanReports: 1,
  orphanPhotos: 2,
  screenshotsErased: 1,
  idImagesErased: 1,
};

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT }, 'maintenance-test');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await clear();
  await seed();
});

describe('maintenance job', () => {
  it('--dry-run: counts everything and changes nothing (Firestore and Cloudinary)', async () => {
    const before = await snapshot();
    const c = cloud();
    const report = await runMaintenance(db, c, { now: NOW, dryRun: true, orphans: true });
    expect(report).toMatchObject({ ...EXPECTED, dryRun: true, errors: [], skipped: [] });
    expect(await snapshot()).toEqual(before);
    expect(c.deleted).toEqual([]);
  });

  it('real run: deletes what expired, keeps the rest, audits as « system », then has nothing left to do', async () => {
    const c = cloud();
    const report = await runMaintenance(db, c, { now: NOW, dryRun: false, orphans: true });
    expect(report).toMatchObject({ ...EXPECTED, dryRun: false, errors: [], skipped: [] });

    const exists = async (path: string) => (await db.doc(path).get()).exists;
    for (const gone of [
      'listings/old_1',
      'listings/old_1/private/contact',
      'pendingBoosts/old_1',
      'listings/old_2',
      'likes/old_1_u1',
      'reports/old_1_u2',
      'likes/gone_1_u4',
      'likes/fresh_2_u5',
      'reports/gone_2_u6',
    ]) {
      expect(await exists(gone), gone).toBe(false);
    }
    for (const kept of [
      'pendingBoosts/fresh_2',
      'likes/fresh_1_u3',
      'reports/fresh_1_u7',
      'listings/fresh_2',
      'listings/fresh_3',
    ]) {
      expect(await exists(kept), kept).toBe(true);
    }
    const f1 = (await db.doc('listings/fresh_1').get()).data();
    expect(f1).toMatchObject({ rank: 0, boostUntil: null });
    expect(typeof f1?.['auditId']).toBe('string');
    expect((await db.doc('listings/fresh_2').get()).get('rank')).toBe(2);
    expect((await db.doc('listings/fresh_3').get()).data()).toMatchObject({ rank: 2, boostUntil: null });
    expect((await db.doc('boostRequests/r1').get()).get('screenshot')).toBeNull();
    expect((await db.doc('boostRequests/r2').get()).get('screenshot')).not.toBeNull();
    expect((await db.doc('boostRequests/r3').get()).get('screenshot')).not.toBeNull();
    expect((await db.doc('verificationRequests/v1').get()).get('idImage')).toBeNull();
    expect((await db.doc('verificationRequests/v2').get()).get('idImage')).not.toBeNull();

    expect(c.deleted.sort()).toEqual(['avOrphan', 'oldA', 'oldB', 'oldC', 'orphanOld']);

    const entries = await audit();
    expect(entries.every((e) => e.actorUid === 'system')).toBe(true);
    expect(entries.map((e) => e.action).sort()).toEqual(
      [
        'badge.erase_image',
        'boost.erase_screenshot',
        'listing.boost_expire',
        'listing.expire',
        'listing.expire',
        'maintenance.run',
      ].sort(),
    );
    const run = (await db.collection('auditLog').where('action', '==', 'maintenance.run').get()).docs[0];
    expect(run?.get('after')).toMatchObject({ ...EXPECTED, skipped: '' });
    expect(run?.get('reason')).toBeNull();
    expect(entries.find((e) => e.action === 'listing.boost_expire')?.targetId).toBe('fresh_1');

    const again = await runMaintenance(db, c, { now: NOW, dryRun: false, orphans: true });
    expect(again).toMatchObject({
      expiredListings: 0,
      boostsExpired: 0,
      orphanLikes: 0,
      orphanReports: 0,
      orphanPhotos: 0,
      screenshotsErased: 0,
      idImagesErased: 0,
      errors: [],
    });
  });

  it('without --orphans (weekdays): skips the whole-collection scans', async () => {
    const report = await runMaintenance(db, cloud(), { now: NOW, dryRun: true, orphans: false });
    expect(report.skipped).toEqual(['orphan-social', 'orphan-photos']);
    expect(report).toMatchObject({ orphanLikes: 0, orphanPhotos: 0, expiredListings: 2 });
  });

  it('orphan guard: refuses to delete most photos when no listing references them, unless --force', async () => {
    await clear();
    const c = new FakeCloudinary({
      listings: Array.from({ length: 25 }, (_, i) => asset(`p${i}`, 100)),
      avatars: [],
    });
    const guarded = await runMaintenance(db, c, { now: NOW, dryRun: false, orphans: true });
    expect(guarded.errors.join()).toContain('E_ORPHAN_GUARD');
    expect(c.deleted).toEqual([]);
    const forced = await runMaintenance(db, c, { now: NOW, dryRun: false, orphans: true, force: true });
    expect(forced.errors).toEqual([]);
    expect(c.deleted).toHaveLength(25);
  });

  it('orphan guard: a few photos but nothing referenced at all → nothing deleted', async () => {
    await clear();
    const c = new FakeCloudinary({
      listings: [asset('a', 100), asset('b', 100)],
      avatars: [asset('c', 100)],
    });
    const report = await runMaintenance(db, c, { now: NOW, dryRun: false, orphans: true });
    expect(report.errors.join()).toContain('E_ORPHAN_GUARD');
    expect(c.deleted).toEqual([]);
  });

  it('a failing step is reported (exit code 1) and does not stop the others', async () => {
    const c = cloud();
    c.failList = true;
    const report = await runMaintenance(db, c, { now: NOW, dryRun: false, orphans: true });
    expect(report.errors).toEqual(['orphan-photos: E_CLOUDINARY_500']);
    expect(report).toMatchObject({
      expiredListings: 2,
      boostsExpired: 1,
      screenshotsErased: 1,
      orphanLikes: 2,
    });
    const run = (await db.collection('auditLog').where('action', '==', 'maintenance.run').get()).docs[0];
    expect(run?.get('reason')).toBe('orphan-photos: E_CLOUDINARY_500');
  });
});

class FakeAuth {
  deleted: string[] = [];
  fail = false;
  deleteUsers(uids: string[]): Promise<{ failureCount: number }> {
    if (this.fail) return Promise.resolve({ failureCount: uids.length });
    this.deleted.push(...uids);
    return Promise.resolve({ failureCount: 0 });
  }
}

/** Deletion requests (owner's decision of 3 Oct 2026): erased by the job after 60 days. */
async function seedAccounts(): Promise<void> {
  const member = (asked: number | null, strikes = 0) => ({
    email: 'x@example.cm',
    strikes,
    publishBanned: false,
    createdAt: ago(300),
    ...(asked === null ? {} : { deletionRequestedAt: ago(asked) }),
  });
  const docs: Record<string, Record<string, unknown>> = {
    'users/gone': member(61),
    'publicProfiles/gone': { pseudo: 'Gone_237', photoUrl: avatar('avGone'), verified: false },
    'usernames/gone_237': { uid: 'gone' },
    'listings/gone_1': listing({ ownerUid: 'gone', status: 'closed', photos: ['goneA:10x10'] }),
    'listings/gone_1/private/contact': { whatsapp: '+237600000001', callAllowed: false },
    'likes/gone_1_u9': { listingId: 'gone_1', uid: 'u9', createdAt: ago(5) },
    'users/gone/notifications/n1': { type: 'warning', title: 'T', body: '', read: true, createdAt: ago(9) },
    'verificationRequests/gone': { status: 'pending', handledAt: null, idImage: 'data:image/jpeg;base64,AA' },
    'users/sanctioned': member(70, 2),
    'publicProfiles/sanctioned': { pseudo: 'Sanc_237', photoUrl: null, verified: false },
    'usernames/sanc_237': { uid: 'sanctioned' },
    'users/recent': member(10),
    'publicProfiles/recent': { pseudo: 'Recent_237', photoUrl: null, verified: false },
    'users/stays': member(null),
    'deletedAccounts/byadmin': { erasedAt: ago(1), auditId: 'a1' },
  };
  const batch = db.batch();
  for (const [path, data] of Object.entries(docs)) batch.set(db.doc(path), data);
  await batch.commit();
}

describe('maintenance job — deletion requests after 60 days', () => {
  beforeEach(seedAccounts);

  it('--dry-run counts the accounts and sign-ins, erases nothing', async () => {
    const auth = new FakeAuth();
    const report = await runMaintenance(db, cloud(), { now: NOW, dryRun: true, orphans: false }, auth);
    expect(report).toMatchObject({ accountsPurged: 2, signInsDeleted: 3, errors: [] });
    expect(auth.deleted).toEqual([]);
    expect((await db.doc('users/gone').get()).exists).toBe(true);
  });

  it('erases accounts asked 60+ days ago, keeps a sanctioned record, removes the sign-in accounts', async () => {
    const auth = new FakeAuth();
    const c = cloud();
    const report = await runMaintenance(db, c, { now: NOW, dryRun: false, orphans: false }, auth);
    expect(report).toMatchObject({ accountsPurged: 2, signInsDeleted: 3, errors: [] });
    const gone = [
      'users/gone',
      'publicProfiles/gone',
      'usernames/gone_237',
      'listings/gone_1',
      'listings/gone_1/private/contact',
      'likes/gone_1_u9',
      'users/gone/notifications/n1',
      'verificationRequests/gone',
      'publicProfiles/sanctioned',
      'usernames/sanc_237',
      'deletedAccounts/byadmin',
      // Tombstones of the night's purges: removed with their sign-in accounts.
      'deletedAccounts/gone',
      'deletedAccounts/sanctioned',
    ];
    for (const path of gone) expect((await db.doc(path).get()).exists, path).toBe(false);
    const kept = await db.doc('users/sanctioned').get();
    expect(kept.get('strikes')).toBe(2);
    expect(kept.get('erasedAt')).toBeInstanceOf(Timestamp);
    expect(kept.get('deletionRequestedAt')).toBeUndefined();
    for (const path of ['users/recent', 'publicProfiles/recent', 'users/stays']) {
      expect((await db.doc(path).get()).exists, path).toBe(true);
    }
    expect(auth.deleted.sort()).toEqual(['byadmin', 'gone', 'sanctioned']);
    expect(c.deleted).toEqual(expect.arrayContaining(['goneA', 'avGone']));
    const purges = (await db.collection('auditLog').where('action', '==', 'user.purge').get()).docs;
    expect(purges.map((d) => [d.get('targetId'), d.get('actorUid')]).sort()).toEqual([
      ['gone', 'system'],
      ['sanctioned', 'system'],
    ]);

    // Next night: nothing left to do (the kept record is marked as erased).
    const again = await runMaintenance(db, c, { now: NOW, dryRun: false, orphans: false }, new FakeAuth());
    expect(again).toMatchObject({ accountsPurged: 0, signInsDeleted: 0, errors: [] });
  });

  it('sign-in removal failing: error reported, tombstones kept for the next night', async () => {
    const auth = new FakeAuth();
    auth.fail = true;
    const report = await runMaintenance(db, cloud(), { now: NOW, dryRun: false, orphans: false }, auth);
    expect(report.errors).toEqual(['accounts: E_AUTH_DELETE 3']);
    // Every tombstone kept: the next night tries again, and nobody signs up again with these uids.
    for (const uid of ['byadmin', 'gone', 'sanctioned']) {
      expect((await db.doc(`deletedAccounts/${uid}`).get()).exists, uid).toBe(true);
    }
  });

  it('without Auth access: the accounts are erased and the sign-ins are reported as skipped', async () => {
    const report = await runMaintenance(db, cloud(), { now: NOW, dryRun: false, orphans: false });
    expect(report.skipped).toContain('sign-ins');
    expect((await db.doc('users/gone').get()).exists).toBe(false);
    expect((await db.doc('deletedAccounts/byadmin').get()).exists).toBe(true);
    expect((await db.doc('deletedAccounts/gone').get()).exists).toBe(true);
  });
});

describe('maintenance job — mass-erase guards (security audit of 3 Oct 2026)', () => {
  beforeEach(seedAccounts);

  it('too many expired listings or accounts at once: nothing erased, error, --force goes through', async () => {
    const guard = { expiredListings: 1, accountsPurged: 1 };
    const report = await runMaintenance(
      db,
      cloud(),
      { now: NOW, dryRun: false, orphans: false, guard },
      new FakeAuth(),
    );
    expect(report.errors.join(' | ')).toMatch(
      /expired: E_MASS_GUARD: 2 annonces.*accounts: E_MASS_GUARD: 2 comptes/,
    );
    expect((await db.doc('listings/old_1').get()).exists).toBe(true);
    expect((await db.doc('users/gone').get()).exists).toBe(true);

    const forced = await runMaintenance(
      db,
      cloud(),
      { now: NOW, dryRun: false, orphans: false, guard, force: true },
      new FakeAuth(),
    );
    expect(forced.errors).toEqual([]);
    expect((await db.doc('listings/old_1').get()).exists).toBe(false);
    expect((await db.doc('users/gone').get()).exists).toBe(false);
  });

  it('the journal entry of an expired listing keeps no title nor owner', async () => {
    await runMaintenance(db, cloud(), { now: NOW, dryRun: false, orphans: false }, new FakeAuth());
    const entries = (await db.collection('auditLog').where('action', '==', 'listing.expire').get()).docs;
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) expect(Object.keys(e.get('before') as object)).toEqual(['renewedAt']);
  });
});
