/**
 * Daily maintenance (ARCHITECTURE § 8), run by .github/workflows/maintenance.yml with a Firebase
 * service account and the Cloudinary Admin API (secrets of GitHub Actions only, never in the repo):
 *   1. expired listings (renewedAt + 180 days) → listing, private contact, likes, reports, photos;
 *   1b. orphan likes / reports (listing gone, or older than the listing now in the same slot);
 *   2. expired promotions → rank 0, boostUntil null;
 *   3. Cloudinary photos (listings, avatars) unused for more than 48 hours;
 *   4. payment screenshots handled more than 30 days ago, ID images of handled badge requests;
 *   4b. accounts whose deletion was asked more than 60 days ago → erased (listings, numbers,
 *       likes, reports, photos, notifications, badge request, profile, pseudo; the private record
 *       of a sanctioned account is kept, marked); then the sign-in accounts of every erased
 *       account (these + the tombstones `deletedAccounts` left by the super-admin) are removed;
 *   5. one summary entry in `auditLog` (actor « system »); exit code 1 if a step failed.
 * Steps 1b and 3 read whole collections: they run on Sundays (UTC) or with --orphans, to spare
 * the Spark read quota. --dry-run reports what would be done and writes nothing.
 *
 *   npm run maintenance -- --dry-run [--orphans] [--force]
 *
 * The log holds counters only (no personal data).
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldPath,
  FieldValue,
  getFirestore,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { ACCOUNT_PURGE_DAYS, LISTING_LIFETIME_DAYS } from '../src/data/limits.ts';

const DAY_MS = 86_400_000;
export const SYSTEM_ACTOR = 'system';
/** Captures of handled payments are kept this long (same as the admin « Nettoyage »). */
export const SCREENSHOT_KEEP_DAYS = 30;
/** An uploaded photo not referenced after this delay is an orphan (upload abandoned, replaced…). */
export const ORPHAN_PHOTO_HOURS = 48;
/** Cloudinary asset folders of the upload presets (ARCHITECTURE § 6). */
export const PHOTO_FOLDERS = ['listings', 'avatars'] as const;
/** Assets of the account that are not user photos (the watermark overlay), never deleted. */
const PROTECTED_ASSETS = new Set(['nioxxer_watermark']);
/**
 * Guard against a wrong project or an empty read: refuse to delete more than half of the photos
 * older than 48 h (beyond a handful) unless --force.
 */
const ORPHAN_GUARD = { min: 20, share: 0.5 } as const;
/**
 * Same idea for steps 1 and 4b (security audit of 3 Oct 2026): a wrong constant or clock would
 * erase every listing or account at once. Above these numbers in one night, nothing is erased and
 * the run fails until someone checks and passes --force.
 */
export const MASS_GUARD = { expiredListings: 200, accountsPurged: 50 } as const;
const PAGE = 300;
const BATCH_OPS = 400;

// ── Cloudinary Admin API (REST, Basic auth) ───────────────────────────────

export interface CloudinaryAsset {
  publicId: string;
  createdAt: Date;
}

export interface CloudinaryApi {
  listFolder(folder: string): Promise<CloudinaryAsset[]>;
  deleteImages(publicIds: readonly string[]): Promise<void>;
}

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * GET /resources/by_asset_folder (max_results ≤ 500, next_cursor) and
 * DELETE /resources/image/upload?public_ids[]=… (≤ 100 per call) — Cloudinary Admin API reference.
 */
export function cloudinaryRest(
  cloud: string,
  key: string,
  secret: string,
  fetchImpl: FetchLike = fetch,
): CloudinaryApi {
  const base = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}`;
  const headers = { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` };
  const call = async (url: string, method = 'GET'): Promise<Record<string, unknown>> => {
    const res = await fetchImpl(url, { method, headers });
    if (!res.ok) throw new Error(`E_CLOUDINARY_${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  };
  return {
    async listFolder(folder) {
      const assets: CloudinaryAsset[] = [];
      let cursor: string | undefined;
      do {
        const q = `asset_folder=${encodeURIComponent(folder)}&max_results=500${cursor ? `&next_cursor=${encodeURIComponent(cursor)}` : ''}`;
        const page = await call(`${base}/resources/by_asset_folder?${q}`);
        for (const r of (page['resources'] as Record<string, unknown>[] | undefined) ?? []) {
          if (r['resource_type'] !== undefined && r['resource_type'] !== 'image') continue;
          assets.push({ publicId: String(r['public_id']), createdAt: new Date(String(r['created_at'])) });
        }
        cursor = typeof page['next_cursor'] === 'string' ? page['next_cursor'] : undefined;
      } while (cursor);
      return assets;
    },
    async deleteImages(publicIds) {
      for (let i = 0; i < publicIds.length; i += 100) {
        const q = publicIds
          .slice(i, i + 100)
          .map((id) => `public_ids[]=${encodeURIComponent(id)}`)
          .join('&');
        await call(`${base}/resources/image/upload?${q}`, 'DELETE');
      }
    },
  };
}

// ── Photo references ──────────────────────────────────────────────────────

/** « <publicId>:<w>x<h> » → publicId. */
export function photoId(ref: string): string {
  return ref.split(':')[0] ?? '';
}

/** Public id of a stored avatar `secure_url` (…/image/upload/v123/<publicId>.jpg), or null. */
export function avatarId(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const m = /\/image\/upload\/v\d+\/([A-Za-z0-9_-]+)\.[a-z]+$/.exec(url);
  return m?.[1] ?? null;
}

// ── Run ───────────────────────────────────────────────────────────────────

/** The part of firebase-admin Auth the job uses (an in-memory fake in the tests). */
export interface AuthApi {
  /** Removes sign-in accounts; an unknown uid is not a failure. */
  deleteUsers(uids: string[]): Promise<{ failureCount: number }>;
}

export interface MaintenanceOptions {
  now: Date;
  dryRun: boolean;
  /** Steps 1b and 3 (whole-collection scans). */
  orphans: boolean;
  /** Bypass the orphan-photo and mass-erase guards. */
  force?: boolean;
  /** Tests only: lower guard thresholds. */
  guard?: { expiredListings: number; accountsPurged: number };
}

export interface MaintenanceReport {
  dryRun: boolean;
  expiredListings: number;
  expiredLikes: number;
  expiredReports: number;
  expiredPhotos: number;
  boostsExpired: number;
  orphanLikes: number;
  orphanReports: number;
  orphanPhotos: number;
  screenshotsErased: number;
  idImagesErased: number;
  accountsPurged: number;
  signInsDeleted: number;
  skipped: string[];
  errors: string[];
}

function emptyReport(dryRun: boolean): MaintenanceReport {
  return {
    dryRun,
    expiredListings: 0,
    expiredLikes: 0,
    expiredReports: 0,
    expiredPhotos: 0,
    boostsExpired: 0,
    orphanLikes: 0,
    orphanReports: 0,
    orphanPhotos: 0,
    screenshotsErased: 0,
    idImagesErased: 0,
    accountsPurged: 0,
    signInsDeleted: 0,
    skipped: [],
    errors: [],
  };
}

function millis(v: unknown): number | null {
  return v instanceof Timestamp ? v.toMillis() : null;
}

/** Every document of a query, page by page (works the same whether documents are deleted or not). */
async function allDocs(q: Query, orderField: string | FieldPath): Promise<QueryDocumentSnapshot[]> {
  const out: QueryDocumentSnapshot[] = [];
  let last: QueryDocumentSnapshot | undefined;
  for (;;) {
    let page = q.orderBy(orderField).limit(PAGE);
    if (last) page = page.startAfter(last);
    const snap = await page.get();
    out.push(...snap.docs);
    if (snap.size < PAGE) return out;
    last = snap.docs[snap.docs.length - 1];
  }
}

async function deleteAll(db: Firestore, refs: readonly DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_OPS) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + BATCH_OPS)) batch.delete(ref);
    await batch.commit();
  }
}

interface AuditInput {
  action: string;
  targetType: string;
  targetId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}

/** Same shape as the admin entries (src/lib/admin.ts `audit`), actor « system ». */
function auditEntry(a: AuditInput): Record<string, unknown> {
  return {
    actorUid: SYSTEM_ACTOR,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId,
    before: a.before ?? null,
    after: a.after ?? null,
    reason: a.reason ?? null,
    createdAt: FieldValue.serverTimestamp(),
  };
}

async function step(report: MaintenanceReport, name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    report.errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Erases one account whose deletion was asked (step 4b) and returns the Cloudinary photos it used.
 * Same result as the super-admin's erase (src/lib/admin.ts `eraseAccount`), plus likes, reports
 * and payment locks of its listings.
 */
async function purgeAccount(db: Firestore, user: QueryDocumentSnapshot): Promise<string[]> {
  const uid = user.id;
  const [own, notes, profile] = await Promise.all([
    db.collection('listings').where('ownerUid', '==', uid).get(),
    db.collection('users').doc(uid).collection('notifications').select().get(),
    db.collection('publicProfiles').doc(uid).get(),
  ]);
  const photos: string[] = [];
  const refs: DocumentReference[] = notes.docs.map((n) => n.ref);
  for (const l of own.docs) {
    const [likes, reports] = await Promise.all([
      db.collection('likes').where('listingId', '==', l.id).select().get(),
      db.collection('reports').where('listingId', '==', l.id).select().get(),
    ]);
    const ps = l.get('photos');
    if (Array.isArray(ps)) photos.push(...ps.map((p) => photoId(String(p))).filter(Boolean));
    refs.push(
      ...likes.docs.map((d) => d.ref),
      ...reports.docs.map((d) => d.ref),
      l.ref.collection('private').doc('contact'),
      db.collection('pendingBoosts').doc(l.id),
      l.ref,
    );
  }
  const avatar = avatarId(profile.get('photoUrl'));
  if (avatar) photos.push(avatar);
  await deleteAll(db, refs);
  const sanctioned = Number(user.get('strikes') ?? 0) > 0 || user.get('publishBanned') === true;
  const batch = db.batch();
  batch.set(
    db.collection('auditLog').doc(),
    auditEntry({
      action: 'user.purge',
      targetType: 'user',
      targetId: uid,
      before: { listings: own.size, strikes: Number(user.get('strikes') ?? 0), keptRecord: sanctioned },
    }),
  );
  batch.delete(db.collection('verificationRequests').doc(uid));
  batch.delete(profile.ref);
  const pseudo = profile.get('pseudo');
  if (typeof pseudo === 'string') batch.delete(db.collection('usernames').doc(pseudo.toLowerCase()));
  // Until its sign-in account is removed (same night, or retried): no new sign-up with this uid.
  batch.set(db.collection('deletedAccounts').doc(uid), {
    erasedAt: FieldValue.serverTimestamp(),
    auditId: 'system',
  });
  if (sanctioned) {
    batch.update(user.ref, {
      erasedAt: FieldValue.serverTimestamp(),
      deletionRequestedAt: FieldValue.delete(),
    });
  } else {
    batch.delete(user.ref);
    batch.delete(db.collection('sanctions').doc(uid));
  }
  await batch.commit();
  return photos;
}

export async function runMaintenance(
  db: Firestore,
  cloudinary: CloudinaryApi | null,
  opts: MaintenanceOptions,
  auth: AuthApi | null = null,
): Promise<MaintenanceReport> {
  const { now, dryRun } = opts;
  const report = emptyReport(dryRun);
  const expiredIds = new Set<string>();
  const listings = db.collection('listings');

  // 1. Expired listings and everything attached to them.
  await step(report, 'expired', async () => {
    const cutoff = Timestamp.fromMillis(now.getTime() - LISTING_LIFETIME_DAYS * DAY_MS);
    const expired = await allDocs(listings.where('renewedAt', '<', cutoff), 'renewedAt');
    const limit = (opts.guard ?? MASS_GUARD).expiredListings;
    if (!dryRun && !opts.force && expired.length > limit) {
      report.expiredListings = expired.length;
      throw new Error(
        `E_MASS_GUARD: ${expired.length} annonces expirées d'un coup (> ${limit}) — rien effacé (vérifier, puis --force)`,
      );
    }
    for (const l of expired) {
      const d = l.data();
      expiredIds.add(l.id);
      const [likes, reports] = await Promise.all([
        db.collection('likes').where('listingId', '==', l.id).select().get(),
        db.collection('reports').where('listingId', '==', l.id).select().get(),
      ]);
      const ids = Array.isArray(d['photos']) ? (d['photos'] as unknown[]).map((p) => photoId(String(p))) : [];
      report.expiredListings++;
      report.expiredLikes += likes.size;
      report.expiredReports += reports.size;
      const photos = ids.filter(Boolean);
      report.expiredPhotos += photos.length;
      if (photos.length > 0 && !cloudinary && !report.skipped.includes('expired-photos')) {
        report.skipped.push('expired-photos');
      }
      if (dryRun) continue;
      await deleteAll(
        db,
        [...likes.docs, ...reports.docs].map((s) => s.ref),
      );
      const batch = db.batch();
      batch.set(
        db.collection('auditLog').doc(),
        auditEntry({
          action: 'listing.expire',
          targetType: 'listing',
          targetId: l.id,
          // No title nor owner: the journal is kept forever (personal data, audit of 3 Oct 2026).
          before: { renewedAt: d['renewedAt'] ?? null },
        }),
      );
      batch.delete(l.ref.collection('private').doc('contact'));
      // Lock of a payment still pending: the next listing in this slot could never be boosted.
      batch.delete(db.collection('pendingBoosts').doc(l.id));
      batch.delete(l.ref);
      await batch.commit();
      // Right after its listing: a later failure cannot leave these photos behind.
      if (cloudinary && photos.length > 0) await cloudinary.deleteImages(photos);
    }
  });

  // 2. Expired promotions (a promotion without end has boostUntil null: never matched).
  await step(report, 'boosts', async () => {
    const ended = await allDocs(listings.where('boostUntil', '<', Timestamp.fromDate(now)), 'boostUntil');
    for (const l of ended) {
      if (expiredIds.has(l.id)) continue;
      const d = l.data();
      report.boostsExpired++;
      if (dryRun) continue;
      const batch = db.batch();
      const audit = db.collection('auditLog').doc();
      batch.set(
        audit,
        auditEntry({
          action: 'listing.boost_expire',
          targetType: 'listing',
          targetId: l.id,
          before: { rank: d['rank'] ?? null, boostUntil: d['boostUntil'] ?? null },
          after: { rank: 0, boostUntil: null },
        }),
      );
      batch.update(l.ref, { rank: 0, boostUntil: null, auditId: audit.id });
      await batch.commit();
    }
  });

  // 4. Images of handled requests (projection: the images themselves are never downloaded).
  await step(report, 'images', async () => {
    const shotsBefore = now.getTime() - SCREENSHOT_KEEP_DAYS * DAY_MS;
    const shots = await db
      .collection('boostRequests')
      .where('screenshot', '!=', null)
      .select('status', 'handledAt')
      .get();
    for (const s of shots.docs) {
      const at = millis(s.get('handledAt'));
      if (s.get('status') === 'pending' || at === null || at >= shotsBefore) continue;
      report.screenshotsErased++;
      if (dryRun) continue;
      const batch = db.batch();
      batch.set(
        db.collection('auditLog').doc(),
        auditEntry({ action: 'boost.erase_screenshot', targetType: 'boostRequest', targetId: s.id }),
      );
      batch.update(s.ref, { screenshot: null });
      await batch.commit();
    }
    // An ID image is erased at the decision (ARCHITECTURE § 4): one still there is a leftover.
    const ids = await db
      .collection('verificationRequests')
      .where('idImage', '!=', null)
      .select('status')
      .get();
    for (const s of ids.docs) {
      if (s.get('status') === 'pending') continue;
      report.idImagesErased++;
      if (dryRun) continue;
      const batch = db.batch();
      batch.set(
        db.collection('auditLog').doc(),
        auditEntry({ action: 'badge.erase_image', targetType: 'verificationRequest', targetId: s.id }),
      );
      batch.update(s.ref, { idImage: null });
      await batch.commit();
    }
  });

  if (opts.orphans) {
    // 1b. Likes and reports whose listing is gone, or older than the listing in their slot.
    await step(report, 'orphan-social', async () => {
      for (const name of ['likes', 'reports'] as const) {
        const docs = await allDocs(db.collection(name).select('listingId', 'createdAt'), 'createdAt');
        const listingIds = [...new Set(docs.map((d) => String(d.get('listingId'))))];
        const created = new Map<string, number | null>();
        for (let i = 0; i < listingIds.length; i += 100) {
          const refs = listingIds.slice(i, i + 100).map((id) => listings.doc(id));
          const snaps: DocumentSnapshot[] = refs.length
            ? await db.getAll(...refs, { fieldMask: ['createdAt'] })
            : [];
          for (const s of snaps) created.set(s.id, s.exists ? millis(s.get('createdAt')) : null);
        }
        const orphans = docs.filter((d) => {
          const listingId = String(d.get('listingId'));
          if (expiredIds.has(listingId)) return false; // counted with its listing (step 1)
          const listingAt = created.get(listingId) ?? null;
          const at = millis(d.get('createdAt'));
          return listingAt === null || (at !== null && at < listingAt);
        });
        if (name === 'likes') report.orphanLikes = orphans.length;
        else report.orphanReports = orphans.length;
        if (!dryRun)
          await deleteAll(
            db,
            orphans.map((d) => d.ref),
          );
      }
    });

    // 3. Photos uploaded but no longer used (listing deleted, photo replaced, upload abandoned).
    await step(report, 'orphan-photos', async () => {
      if (!cloudinary) {
        report.skipped.push('orphan-photos');
        return;
      }
      const used = new Set<string>();
      for (const l of await allDocs(listings.select('photos', 'profilePhotoUrl'), FieldPath.documentId())) {
        const photos = l.get('photos');
        if (Array.isArray(photos)) for (const p of photos) used.add(photoId(String(p)));
        const a = avatarId(l.get('profilePhotoUrl'));
        if (a) used.add(a);
      }
      for (const p of await allDocs(
        db.collection('publicProfiles').select('photoUrl'),
        FieldPath.documentId(),
      )) {
        const a = avatarId(p.get('photoUrl'));
        if (a) used.add(a);
      }
      const oldBefore = now.getTime() - ORPHAN_PHOTO_HOURS * 3_600_000;
      const old: CloudinaryAsset[] = [];
      for (const folder of PHOTO_FOLDERS) old.push(...(await cloudinary.listFolder(folder)));
      const candidates = old.filter(
        (a) => a.createdAt.getTime() < oldBefore && !PROTECTED_ASSETS.has(a.publicId),
      );
      const orphans = candidates.filter((a) => !used.has(a.publicId)).map((a) => a.publicId);
      report.orphanPhotos = orphans.length;
      // Nothing referenced at all (wrong project, empty read): never delete, however few photos.
      const suspicious =
        (used.size === 0 && orphans.length > 0) ||
        (orphans.length > ORPHAN_GUARD.min && orphans.length > candidates.length * ORPHAN_GUARD.share);
      if (!opts.force && suspicious) {
        throw new Error(
          `E_ORPHAN_GUARD: ${orphans.length} photos sur ${candidates.length} sans annonce ni profil — rien effacé (vérifier le projet, puis --force)`,
        );
      }
      if (!dryRun && orphans.length > 0) await cloudinary.deleteImages(orphans);
    });
  } else {
    report.skipped.push('orphan-social', 'orphan-photos');
  }

  // 4b. Deletion requests older than 60 days, then the sign-in accounts of erased accounts.
  await step(report, 'accounts', async () => {
    const cutoff = Timestamp.fromMillis(now.getTime() - ACCOUNT_PURGE_DAYS * DAY_MS);
    const asked = await allDocs(
      db.collection('users').where('deletionRequestedAt', '<', cutoff),
      'deletionRequestedAt',
    );
    const due = asked.filter((u) => u.get('erasedAt') === undefined);
    const most = (opts.guard ?? MASS_GUARD).accountsPurged;
    if (!dryRun && !opts.force && due.length > most) {
      report.accountsPurged = due.length;
      throw new Error(
        `E_MASS_GUARD: ${due.length} comptes à effacer d'un coup (> ${most}) — rien effacé (vérifier, puis --force)`,
      );
    }
    const tombstones = await allDocs(db.collection('deletedAccounts'), FieldPath.documentId());
    const uids = [...new Set([...due.map((u) => u.id), ...tombstones.map((t) => t.id)])];
    report.accountsPurged = due.length;
    report.signInsDeleted = uids.length;
    if (dryRun) return;
    for (const u of due) {
      const photos = await purgeAccount(db, u);
      if (photos.length > 0 && !cloudinary && !report.skipped.includes('account-photos')) {
        report.skipped.push('account-photos');
      }
      if (cloudinary && photos.length > 0) await cloudinary.deleteImages(photos);
    }
    if (uids.length === 0) return;
    if (!auth) {
      report.skipped.push('sign-ins');
      return;
    }
    for (let i = 0; i < uids.length; i += 1000) {
      const result = await auth.deleteUsers(uids.slice(i, i + 1000));
      // Tombstones stay until their sign-in account is really gone (retried the next night).
      if (result.failureCount > 0) throw new Error(`E_AUTH_DELETE ${result.failureCount}`);
    }
    await deleteAll(
      db,
      uids.map((uid) => db.collection('deletedAccounts').doc(uid)),
    );
  });

  // 5. Summary in the admin journal.
  if (!dryRun) {
    await step(report, 'summary', async () => {
      const counts = Object.fromEntries(Object.entries(report).filter(([, v]) => typeof v === 'number'));
      const { skipped, errors } = report;
      await db
        .collection('auditLog')
        .doc()
        .set(
          auditEntry({
            action: 'maintenance.run',
            targetType: 'maintenance',
            targetId: now.toISOString().slice(0, 10),
            after: { ...counts, skipped: skipped.join(',') },
            reason: errors.length ? errors.join(' · ').slice(0, 500) : null,
          }),
        );
    });
  }
  return report;
}

// ── Command line ──────────────────────────────────────────────────────────

function appFromEnv(): App {
  const emulator = process.env['FIRESTORE_EMULATOR_HOST'];
  if (emulator) {
    const projectId = process.env['GCLOUD_PROJECT'] ?? 'demo-nioxxer';
    if (!projectId.startsWith('demo-')) throw new Error('E_NOT_EMULATOR');
    return initializeApp({ projectId }, 'maintenance');
  }
  const raw = process.env['FIREBASE_SERVICE_ACCOUNT'];
  if (!raw) throw new Error('E_NO_SERVICE_ACCOUNT: secret FIREBASE_SERVICE_ACCOUNT absent');
  return initializeApp({ credential: cert(JSON.parse(raw) as Record<string, string>) }, 'maintenance');
}

/** Sign-in accounts: the real project, or the Auth emulator when one is running (never a demo without it). */
function authFromEnv(app: App): AuthApi | null {
  if (process.env['FIRESTORE_EMULATOR_HOST'] && !process.env['FIREBASE_AUTH_EMULATOR_HOST']) return null;
  return getAuth(app);
}

function cloudinaryFromEnv(): CloudinaryApi | null {
  const cloud = process.env['CLOUDINARY_CLOUD_NAME'];
  const key = process.env['CLOUDINARY_API_KEY'];
  const secret = process.env['CLOUDINARY_API_SECRET'];
  return cloud && key && secret ? cloudinaryRest(cloud, key, secret) : null;
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const now = new Date();
  const app = appFromEnv();
  const db = getFirestore(app);
  const cloudinary = cloudinaryFromEnv();
  const report = await runMaintenance(
    db,
    cloudinary,
    {
      now,
      dryRun: args.has('--dry-run'),
      orphans: args.has('--orphans') || now.getUTCDay() === 0,
      force: args.has('--force'),
    },
    authFromEnv(app),
  );
  // Real run on a real project without the Cloudinary secrets: photos would pile up silently.
  if (!cloudinary && !report.dryRun && !process.env['FIRESTORE_EMULATOR_HOST']) {
    report.errors.push('cloudinary: secrets CLOUDINARY_* absents');
  }
  console.log(`[maintenance] ${JSON.stringify(report)}`);
  if (report.errors.length > 0) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`[maintenance] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
