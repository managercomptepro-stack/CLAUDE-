/**
 * Admin reads and writes (Firestore lite: no realtime needed). Every admin write goes in one batch
 * with its `auditLog` entry — one entry per audited document, as the rules require (`audited`) —
 * and, when the member is concerned, their notification (rules: tests/rules/admin.test.ts).
 */
import {
  collection,
  deleteField,
  doc,
  getCount,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  type DocumentData,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase/firestore/lite';
import type { AuditTargetType } from '../data/audit';
import { LISTING_LIFETIME_DAYS, PSEUDO_PATTERN } from '../data/limits';
import type { NotificationType } from '../data/notifications';
import { REPORT_REASONS, type ReportReason } from '../data/reports';
import { normalizeSettings, SETTINGS_PATH, type PublicSettings } from '../data/settings';
import { db } from '../firebase/lite';
import { fr } from '../i18n/fr';
import {
  approvedBoost,
  asRole,
  proofReuse,
  reportQueue,
  searchKey,
  strikeAfterRemoval,
  type AdminRole,
  type Promotion,
  type QueueEntry,
  type QueueReport,
  type Sanction,
} from './admin-logic';
import type { BoostTier, Operator } from './boost-form';
import { AppError } from './errors';
import { formatDate } from './format';
import { toListing } from './listing';
import type { OwnListing } from './listing-status';

const DAY_MS = 86_400_000;
/** Rows per page in the admin lists. */
export const ADMIN_PAGE = 30;
/** Handled payment screenshots are erased this many days after the decision (ARCHITECTURE § 8). */
export const SCREENSHOT_KEEP_DAYS = 30;
/** Items handled per « Nettoyage » run (each one is its own small batch). */
const CLEANUP_MAX = 100;
/** Screenshots are heavy (≤ 300 Ko each): fewer per run. */
const SHOTS_MAX = 20;

export type AuditAction = keyof typeof fr.admin.journal.actions;

export interface AdminListing extends OwnListing {
  ownerUid: string;
  pseudo: string;
  reportsCount: number;
  reportsClearedAt: Date | null;
  verified: boolean;
}

export function toAdminListing(id: string, d: DocumentData): AdminListing {
  return {
    ...toListing(id, d),
    ownerUid: String(d['ownerUid'] ?? id.split('_')[0] ?? ''),
    pseudo: String(d['pseudo'] ?? ''),
    reportsCount: Number(d['reportsCount'] ?? 0),
    reportsClearedAt: dateOrNull(d['reportsClearedAt']),
    verified: d['verified'] === true,
  };
}

function dateOrNull(v: unknown): Date | null {
  return v instanceof Timestamp ? v.toDate() : null;
}

/** Firestore values as plain data (Timestamps → Dates), for the journal. */
function plain(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toDate();
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

const listings = () => collection(db(), 'listings');

export interface Page<T> {
  items: T[];
  /** Last document of a full page (null = nothing more). */
  cursor: QueryDocumentSnapshot | null;
}

async function page<T>(
  q: Query,
  constraints: QueryConstraint[],
  after: QueryDocumentSnapshot | null,
  map: (d: QueryDocumentSnapshot) => T,
): Promise<Page<T>> {
  const all = [...constraints, ...(after ? [startAfter(after)] : []), limit(ADMIN_PAGE)];
  const snap = await getDocs(query(q, ...all));
  return {
    items: snap.docs.map(map),
    cursor: snap.docs.length === ADMIN_PAGE ? (snap.docs[snap.docs.length - 1] ?? null) : null,
  };
}

// ── Role ───────────────────────────────────────────────────────────────────

export async function loadRole(uid: string): Promise<AdminRole | null> {
  const snap = await getDoc(doc(db(), 'admins', uid));
  return snap.exists() ? asRole(snap.data()['role']) : null;
}

// ── Audit + notification (inside a batch) ──────────────────────────────────

interface AuditInput {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

/** Adds the `auditLog` entry to the batch and returns its id (the `auditId` of the target). */
function audit(batch: WriteBatch, actor: string, a: AuditInput): string {
  const ref = doc(collection(db(), 'auditLog'));
  batch.set(ref, {
    actorUid: actor,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId,
    before: a.before ?? null,
    after: a.after ?? null,
    reason: a.reason ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Notification to a member; the rules require an audit entry of the same batch (`auditId`). */
function notify(
  batch: WriteBatch,
  uid: string,
  auditId: string,
  type: NotificationType,
  title: string,
  body: string,
): void {
  batch.set(doc(collection(db(), 'users', uid, 'notifications')), {
    type,
    title: title.slice(0, 120),
    body: body.slice(0, 1000),
    read: false,
    createdAt: serverTimestamp(),
    auditId,
  });
}

const tsOrNull = (d: Date | null) => (d ? Timestamp.fromDate(d) : null);

// ── Listings: recent, reports, moderation ─────────────────────────────────

export function loadRecent(after: QueryDocumentSnapshot | null): Promise<Page<AdminListing>> {
  return page(listings(), [orderBy('createdAt', 'desc')], after, (d) => toAdminListing(d.id, d.data()));
}

function toReport(d: DocumentData): QueueReport[] {
  const reason = d['reason'];
  if (!(REPORT_REASONS as readonly unknown[]).includes(reason)) return [];
  return [
    {
      listingId: String(d['listingId'] ?? ''),
      reason: reason as ReportReason,
      note: String(d['note'] ?? ''),
      createdAt: dateOrNull(d['createdAt']) ?? new Date(0),
      counted: d['verified'] !== false,
    },
  ];
}

export type QueueItem = QueueEntry<AdminListing>;

/** « Signalements »: hidden listings, plus the listings of the 100 latest reports. */
export async function loadReportQueue(): Promise<QueueItem[]> {
  const reportsCol = collection(db(), 'reports');
  const [hiddenSnap, reportSnap] = await Promise.all([
    getDocs(query(listings(), where('hidden', '==', true), limit(50))),
    getDocs(query(reportsCol, orderBy('createdAt', 'desc'), limit(100))),
  ]);
  const reports = reportSnap.docs.flatMap((d) => toReport(d.data()));
  const byId = new Map(hiddenSnap.docs.map((d) => [d.id, toAdminListing(d.id, d.data())]));
  const missing = [...new Set(reports.map((r) => r.listingId))].filter((id) => id && !byId.has(id));
  const fetched = await Promise.all(missing.map((id) => getDoc(doc(db(), 'listings', id))));
  for (const s of fetched) if (s.exists()) byId.set(s.id, toAdminListing(s.id, s.data()));
  // Hidden listings whose reports are older than the 100 loaded: fetch their own.
  const without = [...byId.values()].filter((l) => l.hidden && !reports.some((r) => r.listingId === l.id));
  const extra = await Promise.all(
    without.map((l) => getDocs(query(reportsCol, where('listingId', '==', l.id), limit(20)))),
  );
  for (const s of extra) reports.push(...s.docs.flatMap((d) => toReport(d.data())));
  return reportQueue([...byId.values()], reports);
}

/** Removal for an infringement: reason, strike +1 (ban at 5), notification, audit (SPEC § 10). */
export async function removeListing(
  actor: string,
  l: AdminListing,
  reason: string,
): Promise<Sanction | null> {
  const userRef = doc(db(), 'users', l.ownerUid);
  const sanctionsRef = doc(db(), 'sanctions', l.ownerUid);
  // Moderators read the sanctions mirror, never the private record (owner's decision of 3 Oct 2026).
  // No mirror yet = no strike yet. A member without private record (erased) gets no strike.
  const [listingSnap, sanctionsSnap, hasRecord] = await Promise.all([
    getDoc(doc(db(), 'listings', l.id)),
    getDoc(sanctionsRef),
    getDoc(doc(db(), 'publicProfiles', l.ownerUid)).then((p) => p.exists()),
  ]);
  // Already removed (double click, another moderator): no second strike.
  if (!listingSnap.exists() || listingSnap.data()['status'] !== 'active')
    throw new AppError('nioxxer/listing-gone');
  const batch = writeBatch(db());
  const listingAudit = audit(batch, actor, {
    action: 'listing.remove',
    targetType: 'listing',
    targetId: l.id,
    before: { status: l.status },
    after: { status: 'removed' },
    reason,
  });
  batch.update(doc(db(), 'listings', l.id), {
    status: 'removed',
    removedReason: reason,
    auditId: listingAudit,
  });
  let after: Sanction | null = null;
  if (hasRecord) {
    const u = sanctionsSnap.data() ?? {};
    const before: Sanction = {
      strikes: Number(u['strikes'] ?? 0),
      publishBanned: u['publishBanned'] === true,
    };
    after = strikeAfterRemoval(before);
    const userAudit = audit(batch, actor, {
      action: 'user.strike',
      targetType: 'user',
      targetId: l.ownerUid,
      before,
      // The rules check that this strike counts this very listing, removed in this batch.
      after: { ...after, listingId: l.id },
      reason,
    });
    batch.update(userRef, { ...after, auditId: userAudit });
    batch.set(sanctionsRef, after);
    const t = fr.admin.notify;
    notify(
      batch,
      l.ownerUid,
      userAudit,
      'listing_removed',
      t.removedTitle(l.title),
      t.removedBody(reason, after.publishBanned),
    );
  }
  await batch.commit();
  return after;
}

/** Warning without strike: a notification to the member, and its trace in the journal. */
export async function warnMember(actor: string, l: AdminListing, reason: string): Promise<void> {
  const batch = writeBatch(db());
  const auditId = audit(batch, actor, {
    action: 'user.warn',
    targetType: 'user',
    targetId: l.ownerUid,
    after: { listingId: l.id },
    reason,
  });
  notify(batch, l.ownerUid, auditId, 'warning', fr.admin.notify.warningTitle, `« ${l.title} » : ${reason}`);
  await batch.commit();
}

/** « Rétablir » (hidden listing) or « Classer sans suite »: visible again, report count reset. */
export async function clearReports(actor: string, l: AdminListing): Promise<void> {
  const batch = writeBatch(db());
  const auditId = audit(batch, actor, {
    action: l.hidden ? 'listing.restore' : 'listing.dismiss',
    targetType: 'listing',
    targetId: l.id,
    before: { hidden: l.hidden, reportsCount: l.reportsCount },
    after: { hidden: false, reportsCount: 0 },
  });
  batch.update(doc(db(), 'listings', l.id), {
    hidden: false,
    reportsCount: 0,
    reportsClearedAt: serverTimestamp(),
    auditId,
  });
  await batch.commit();
}

// ── Payments (super-admin) ─────────────────────────────────────────────────

export interface PaymentRequest {
  id: string;
  listingId: string;
  ownerUid: string;
  tier: BoostTier;
  operator: Operator;
  amount: number;
  txRef: string | null;
  screenshot: string | null;
  createdAt: Date | null;
  listing: AdminListing | null;
  /** Same proof used by another request (security audit of 3 Oct 2026). */
  reuse: { sameRef: number; sameShot: boolean };
}

export async function loadPendingPayments(): Promise<PaymentRequest[]> {
  const snap = await getDocs(
    query(
      collection(db(), 'boostRequests'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc'),
      limit(ADMIN_PAGE),
    ),
  );
  const requests = snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      listingId: String(v['listingId'] ?? ''),
      ownerUid: String(v['ownerUid'] ?? ''),
      tier: v['tier'] === 'sponsored' ? ('sponsored' as const) : ('premium' as const),
      operator: v['operator'] === 'orange' ? ('orange' as const) : ('mtn' as const),
      amount: Number(v['amount'] ?? 0),
      txRef: typeof v['txRef'] === 'string' ? v['txRef'] : null,
      screenshot: typeof v['screenshot'] === 'string' ? v['screenshot'] : null,
      createdAt: dateOrNull(v['createdAt']),
    };
  });
  const refs = [...new Set(requests.map((r) => r.txRef).filter((x): x is string => x !== null))];
  const [found, earlier] = await Promise.all([
    Promise.all(requests.map((r) => getDoc(doc(db(), 'listings', r.listingId)))),
    // Earlier requests (any status) with the same reference, as typed: one read per reference.
    Promise.all(
      refs.map((ref) =>
        getDocs(query(collection(db(), 'boostRequests'), where('txRef', '==', ref), limit(10))),
      ),
    ),
  ]);
  const others = earlier.flatMap((snap) =>
    snap.docs.map((d) => ({
      id: d.id,
      operator: String(d.data()['operator'] ?? ''),
      txRef: typeof d.data()['txRef'] === 'string' ? (d.data()['txRef'] as string) : null,
      screenshot: null,
    })),
  );
  const reuse = proofReuse(requests, others);
  return requests.map((r, i) => {
    const s = found[i];
    return {
      ...r,
      listing: s?.exists() ? toAdminListing(s.id, s.data()) : null,
      reuse: reuse.get(r.id) ?? { sameRef: 0, sameShot: false },
    };
  });
}

/**
 * Validation: the promotion starts now for `boostDays`, or extends the one running (decision 10);
 * listing + request + lock + notification + 2 audit entries in one batch.
 */
export async function approvePayment(
  actor: string,
  r: PaymentRequest,
  boostDays: number,
): Promise<Promotion> {
  const listingRef = doc(db(), 'listings', r.listingId);
  const snap = await getDoc(listingRef);
  if (!snap.exists()) throw new AppError('nioxxer/listing-gone');
  const l = toAdminListing(snap.id, snap.data());
  if (l.status !== 'active') throw new AppError('nioxxer/listing-gone');
  const before: Promotion = { rank: l.rank, boostUntil: l.boostUntil };
  const next = approvedBoost(before, r.tier, boostDays, new Date());
  const batch = writeBatch(db());
  const listingAudit = audit(batch, actor, {
    action: 'boost.approve',
    targetType: 'listing',
    targetId: l.id,
    before,
    after: next,
  });
  batch.update(listingRef, { rank: next.rank, boostUntil: tsOrNull(next.boostUntil), auditId: listingAudit });
  const requestAudit = audit(batch, actor, {
    action: 'boost.approve',
    targetType: 'boostRequest',
    targetId: r.id,
    before: { status: 'pending' },
    after: { status: 'approved', tier: r.tier, amount: r.amount },
  });
  batch.update(doc(db(), 'boostRequests', r.id), {
    status: 'approved',
    rejectReason: null,
    handledBy: actor,
    handledAt: serverTimestamp(),
    auditId: requestAudit,
  });
  batch.delete(doc(db(), 'pendingBoosts', r.listingId));
  const t = fr.admin.notify;
  notify(
    batch,
    r.ownerUid,
    requestAudit,
    'boost_approved',
    t.boostApprovedTitle(r.tier),
    t.boostApprovedBody(l.title, next.boostUntil ? formatDate(next.boostUntil) : null),
  );
  await batch.commit();
  return next;
}

export async function rejectPayment(actor: string, r: PaymentRequest, reason: string): Promise<void> {
  const batch = writeBatch(db());
  const auditId = audit(batch, actor, {
    action: 'boost.reject',
    targetType: 'boostRequest',
    targetId: r.id,
    before: { status: 'pending' },
    after: { status: 'rejected' },
    reason,
  });
  batch.update(doc(db(), 'boostRequests', r.id), {
    status: 'rejected',
    rejectReason: reason,
    handledBy: actor,
    handledAt: serverTimestamp(),
    auditId,
  });
  batch.delete(doc(db(), 'pendingBoosts', r.listingId));
  const t = fr.admin.notify;
  notify(
    batch,
    r.ownerUid,
    auditId,
    'boost_rejected',
    t.boostRejectedTitle,
    t.boostRejectedBody(r.listing?.title ?? '', reason),
  );
  await batch.commit();
}

// ── Verified badge ─────────────────────────────────────────────────────────

export interface BadgeRequest {
  uid: string;
  idImage: string | null;
  createdAt: Date | null;
  pseudo: string | null;
}

async function pseudoOf(uid: string): Promise<string | null> {
  const p = await getDoc(doc(db(), 'publicProfiles', uid));
  return p.exists() ? String(p.data()['pseudo'] ?? '') : null;
}

/** Display names of a few uids (journal, team). */
export async function pseudosOf(uids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(uids)];
  const names = await Promise.all(unique.map((u) => pseudoOf(u).catch(() => null)));
  return new Map(unique.flatMap((u, i) => (names[i] ? [[u, names[i]] as [string, string]] : [])));
}

export async function loadBadgeRequests(): Promise<BadgeRequest[]> {
  const snap = await getDocs(
    query(
      collection(db(), 'verificationRequests'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc'),
      limit(ADMIN_PAGE),
    ),
  );
  const names = await pseudosOf(snap.docs.map((d) => d.id));
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      uid: d.id,
      idImage: typeof v['idImage'] === 'string' ? v['idImage'] : null,
      createdAt: dateOrNull(v['createdAt']),
      pseudo: names.get(d.id) ?? null,
    };
  });
}

/**
 * The badge is copied on each listing (denormalised): one small batch per listing, each with its
 * own audit entry (a single batch would pile up the rules' document reads).
 */
async function copyBadgeToListings(actor: string, uid: string, verified: boolean): Promise<void> {
  const snap = await getDocs(query(listings(), where('ownerUid', '==', uid)));
  for (const d of snap.docs) {
    if (d.data()['verified'] === verified) continue;
    const batch = writeBatch(db());
    const auditId = audit(batch, actor, {
      action: 'listing.badge',
      targetType: 'listing',
      targetId: d.id,
      after: { verified },
    });
    batch.update(d.ref, { verified, auditId });
    await batch.commit();
  }
}

/** Decision on a request: the ID photo is erased in the same batch (ARCHITECTURE § 4). */
export async function decideBadge(
  actor: string,
  uid: string,
  approve: boolean,
  reason: string | null,
): Promise<void> {
  const batch = writeBatch(db());
  const requestAudit = audit(batch, actor, {
    action: approve ? 'badge.approve' : 'badge.refuse',
    targetType: 'verification',
    targetId: uid,
    after: { status: approve ? 'approved' : 'rejected' },
    reason,
  });
  batch.update(doc(db(), 'verificationRequests', uid), {
    status: approve ? 'approved' : 'rejected',
    idImage: null,
    handledBy: actor,
    handledAt: serverTimestamp(),
    auditId: requestAudit,
  });
  const t = fr.admin.notify;
  if (approve) {
    const profileAudit = audit(batch, actor, {
      action: 'profile.badge_on',
      targetType: 'profile',
      targetId: uid,
      after: { verified: true },
    });
    batch.update(doc(db(), 'publicProfiles', uid), { verified: true, auditId: profileAudit });
    notify(batch, uid, requestAudit, 'badge_granted', t.badgeGrantedTitle, t.badgeGrantedBody);
  } else {
    notify(batch, uid, requestAudit, 'badge_refused', t.badgeRefusedTitle, t.badgeRefusedBody(reason ?? ''));
  }
  await batch.commit();
  if (approve) await copyBadgeToListings(actor, uid, true);
}

/** Badge granted or withdrawn on the admin's own initiative (« Mises en avant »). */
export interface VerifiedMember {
  uid: string;
  pseudo: string;
  memberSince: Date | null;
}

/** Every member with the verified badge (public profiles, owner's request of 3 Oct 2026). */
export async function loadVerifiedMembers(): Promise<VerifiedMember[]> {
  const snap = await getDocs(
    query(collection(db(), 'publicProfiles'), where('verified', '==', true), limit(200)),
  );
  return snap.docs
    .map((d) => ({
      uid: d.id,
      pseudo: String(d.data()['pseudo'] ?? ''),
      memberSince: dateOrNull(d.data()['memberSince']),
    }))
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));
}

export async function setBadge(actor: string, uid: string, verified: boolean): Promise<void> {
  const batch = writeBatch(db());
  const auditId = audit(batch, actor, {
    action: verified ? 'profile.badge_on' : 'profile.badge_off',
    targetType: 'profile',
    targetId: uid,
    after: { verified },
  });
  batch.update(doc(db(), 'publicProfiles', uid), { verified, auditId });
  if (verified)
    notify(
      batch,
      uid,
      auditId,
      'badge_granted',
      fr.admin.notify.badgeGrantedTitle,
      fr.admin.notify.badgeGrantedBody,
    );
  await batch.commit();
  await copyBadgeToListings(actor, uid, verified);
}

// ── Members (super-admin) ──────────────────────────────────────────────────

export interface MemberRecord {
  uid: string;
  pseudo: string | null;
  photoUrl: string | null;
  verified: boolean;
  email: string | null;
  city: string | null;
  birthDate: Date | null;
  createdAt: Date | null;
  strikes: number;
  publishBanned: boolean;
  /** null when the private record is gone (account deleted without strikes). */
  hasRecord: boolean;
  /** Deletion asked by the member (owner's decision of 3 Oct 2026), and its erase if done. */
  deletionRequestedAt: Date | null;
  erasedAt: Date | null;
  /** The account's own cap of active listings (null = the general setting). */
  maxListings: number | null;
  role: AdminRole | null;
  listings: AdminListing[];
}

const PSEUDO_RE = new RegExp(PSEUDO_PATTERN);
const UID_RE = /^[A-Za-z0-9]{10,128}$/;

export async function loadMember(uid: string): Promise<MemberRecord | null> {
  const [u, p, a, ls] = await Promise.all([
    getDoc(doc(db(), 'users', uid)),
    getDoc(doc(db(), 'publicProfiles', uid)),
    getDoc(doc(db(), 'admins', uid)),
    getDocs(query(listings(), where('ownerUid', '==', uid))),
  ]);
  if (!u.exists() && !p.exists()) return null;
  const ud = u.data() ?? {};
  const pd = p.data() ?? {};
  return {
    uid,
    pseudo: p.exists() ? String(pd['pseudo'] ?? '') : null,
    photoUrl: typeof pd['photoUrl'] === 'string' ? pd['photoUrl'] : null,
    verified: pd['verified'] === true,
    email: typeof ud['email'] === 'string' ? ud['email'] : null,
    city: typeof ud['city'] === 'string' ? ud['city'] : null,
    birthDate: dateOrNull(ud['birthDate']),
    createdAt: dateOrNull(ud['createdAt']) ?? dateOrNull(pd['memberSince']),
    strikes: Number(ud['strikes'] ?? 0),
    publishBanned: ud['publishBanned'] === true,
    hasRecord: u.exists(),
    deletionRequestedAt: dateOrNull(ud['deletionRequestedAt']),
    erasedAt: dateOrNull(ud['erasedAt']),
    maxListings: typeof ud['maxListings'] === 'number' ? ud['maxListings'] : null,
    role: a.exists() ? asRole(a.data()['role']) : null,
    listings: ls.docs
      .map((d) => toAdminListing(d.id, d.data()))
      .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime()),
  };
}

/** Member by pseudo (`usernames/{pseudoLower}`) or by uid. */
export async function findMember(raw: string): Promise<MemberRecord | null> {
  const key = searchKey(raw);
  if (!key) return null;
  const lower = key.toLowerCase();
  if (PSEUDO_RE.test(lower)) {
    const u = await getDoc(doc(db(), 'usernames', lower));
    if (u.exists()) return loadMember(String(u.data()['uid'] ?? ''));
  }
  return UID_RE.test(key) ? loadMember(key) : null;
}

/** Cap of active listings for one account (null = back to the general setting), audited. */
export async function setListingCap(actor: string, m: MemberRecord, cap: number | null): Promise<void> {
  const batch = writeBatch(db());
  const auditId = audit(batch, actor, {
    action: 'user.listing_cap',
    targetType: 'user',
    targetId: m.uid,
    before: { maxListings: m.maxListings },
    after: { maxListings: cap },
  });
  batch.update(doc(db(), 'users', m.uid), { maxListings: cap, auditId });
  await batch.commit();
}

/** Publication ban set or lifted by the super-admin (strikes unchanged). */
export async function setPublishBan(actor: string, m: MemberRecord, banned: boolean): Promise<void> {
  const batch = writeBatch(db());
  const auditId = audit(batch, actor, {
    action: banned ? 'user.ban' : 'user.unban',
    targetType: 'user',
    targetId: m.uid,
    before: { publishBanned: m.publishBanned, strikes: m.strikes },
    after: { publishBanned: banned, strikes: m.strikes },
  });
  batch.update(doc(db(), 'users', m.uid), { publishBanned: banned, auditId });
  batch.set(doc(db(), 'sanctions', m.uid), { strikes: m.strikes, publishBanned: banned });
  await batch.commit();
}

/** One line of the member list (super-admin). */
export interface MemberRow {
  uid: string;
  pseudo: string | null;
  email: string | null;
  city: string | null;
  createdAt: Date | null;
  strikes: number;
  publishBanned: boolean;
  deletionRequestedAt: Date | null;
  erasedAt: Date | null;
}

function toMemberRow(d: QueryDocumentSnapshot, pseudos: Map<string, string>): MemberRow {
  const x = d.data();
  return {
    uid: d.id,
    pseudo: pseudos.get(d.id) ?? null,
    email: typeof x['email'] === 'string' ? x['email'] : null,
    city: typeof x['city'] === 'string' ? x['city'] : null,
    createdAt: dateOrNull(x['createdAt']),
    strikes: Number(x['strikes'] ?? 0),
    publishBanned: x['publishBanned'] === true,
    deletionRequestedAt: dateOrNull(x['deletionRequestedAt']),
    erasedAt: dateOrNull(x['erasedAt']),
  };
}

async function memberRows(docs: readonly QueryDocumentSnapshot[]): Promise<MemberRow[]> {
  const pseudos = await pseudosOf(docs.map((d) => d.id));
  return docs.map((d) => toMemberRow(d, pseudos));
}

/** Every member, newest first, 30 per page (owner's request of 3 Oct 2026). */
export async function loadMembers(after: QueryDocumentSnapshot | null): Promise<Page<MemberRow>> {
  const all = [orderBy('createdAt', 'desc'), ...(after ? [startAfter(after)] : []), limit(ADMIN_PAGE)];
  const snap = await getDocs(query(collection(db(), 'users'), ...all));
  return {
    items: await memberRows(snap.docs),
    cursor: snap.docs.length === ADMIN_PAGE ? (snap.docs[snap.docs.length - 1] ?? null) : null,
  };
}

/** Deletion requests not erased yet, oldest first (the nightly job erases them after 60 days). */
export async function loadDeletionRequests(): Promise<MemberRow[]> {
  const snap = await getDocs(
    query(
      collection(db(), 'users'),
      where('deletionRequestedAt', '>', Timestamp.fromMillis(0)),
      orderBy('deletionRequestedAt', 'asc'),
      limit(100),
    ),
  );
  return (await memberRows(snap.docs)).filter((m) => !m.erasedAt);
}

const ERASE_BATCH = 400;

/**
 * Erase of an account whose deletion was asked (super-admin, owner's decision of 3 Oct 2026):
 * listings and their WhatsApp numbers, notifications, then — last batch, audited — the badge
 * request, the public profile, the pseudo, a tombstone (the nightly job removes the sign-in account
 * and the photos left on Cloudinary) and the private record, kept but marked when the account was
 * sanctioned (decision 13).
 */
export async function eraseAccount(actor: string, m: MemberRecord, reason: string): Promise<void> {
  if (!m.deletionRequestedAt) throw new AppError('nioxxer/no-deletion-request');
  const [own, notes] = await Promise.all([
    getDocs(query(listings(), where('ownerUid', '==', m.uid))),
    getDocs(collection(db(), 'users', m.uid, 'notifications')),
  ]);
  const deletes = [
    ...own.docs.flatMap((l) => [l.ref, doc(db(), 'listings', l.id, 'private', 'contact')]),
    ...notes.docs.map((n) => n.ref),
  ];
  // A listing and its contact stay in the same batch (the contact rule checks the listing is gone).
  for (let i = 0; i < deletes.length; i += ERASE_BATCH) {
    const batch = writeBatch(db());
    for (const ref of deletes.slice(i, i + ERASE_BATCH)) batch.delete(ref);
    await batch.commit();
  }
  const batch = writeBatch(db());
  const sanctioned = m.strikes > 0 || m.publishBanned;
  const auditId = audit(batch, actor, {
    action: 'user.erase',
    targetType: 'user',
    targetId: m.uid,
    before: { pseudo: m.pseudo, listings: own.size, strikes: m.strikes, keptRecord: sanctioned },
    reason,
  });
  batch.delete(doc(db(), 'verificationRequests', m.uid));
  if (m.pseudo !== null) {
    batch.delete(doc(db(), 'publicProfiles', m.uid));
    batch.delete(doc(db(), 'usernames', m.pseudo.toLowerCase()));
  }
  batch.set(doc(db(), 'deletedAccounts', m.uid), { erasedAt: serverTimestamp(), auditId });
  if (sanctioned) {
    batch.update(doc(db(), 'users', m.uid), {
      erasedAt: serverTimestamp(),
      deletionRequestedAt: deleteField(),
      auditId,
    });
  } else {
    batch.delete(doc(db(), 'users', m.uid));
    batch.delete(doc(db(), 'sanctions', m.uid));
  }
  await batch.commit();
}

// ── Promotions granted by hand (super-admin) ───────────────────────────────

export async function loadPromoted(): Promise<AdminListing[]> {
  const snap = await getDocs(query(listings(), where('rank', '>', 0), limit(50)));
  return snap.docs.map((d) => toAdminListing(d.id, d.data())).sort((a, b) => b.rank - a.rank);
}

export async function setPromotion(actor: string, l: AdminListing, next: Promotion): Promise<void> {
  const batch = writeBatch(db());
  const auditId = audit(batch, actor, {
    action: next.rank > 0 ? 'listing.promote' : 'listing.unpromote',
    targetType: 'listing',
    targetId: l.id,
    before: { rank: l.rank, boostUntil: l.boostUntil },
    after: next,
  });
  batch.update(doc(db(), 'listings', l.id), {
    rank: next.rank,
    boostUntil: next.rank > 0 ? tsOrNull(next.boostUntil) : null,
    auditId,
  });
  await batch.commit();
}

// ── Settings (super-admin) ─────────────────────────────────────────────────

function toSettings(d: DocumentData): PublicSettings {
  const payee = (p: unknown) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return { number: String(o['number'] ?? ''), name: String(o['name'] ?? '') };
  };
  const prices = (d['prices'] ?? {}) as Record<string, unknown>;
  const payment = (d['payment'] ?? {}) as Record<string, unknown>;
  return {
    prices: { premium: Number(prices['premium'] ?? 0), sponsored: Number(prices['sponsored'] ?? 0) },
    boostDays: normalizeSettings(d).boostDays,
    payment: { mtn: payee(payment['mtn']), orange: payee(payment['orange']) },
    maxActiveListings: Number(d['maxActiveListings'] ?? 0),
    reportsHideThreshold: Number(d['reportsHideThreshold'] ?? 0),
    supportWhatsApp: String(d['supportWhatsApp'] ?? ''),
    termsVersion: String(d['termsVersion'] ?? ''),
  };
}

/** `settings/public`, or null while it does not exist (fresh project). */
export async function loadSettingsDoc(): Promise<PublicSettings | null> {
  const snap = await getDoc(doc(db(), SETTINGS_PATH));
  return snap.exists() ? toSettings(snap.data()) : null;
}

export async function saveSettings(
  actor: string,
  before: PublicSettings | null,
  next: PublicSettings,
): Promise<void> {
  const batch = writeBatch(db());
  const auditId = audit(batch, actor, {
    action: 'settings.update',
    targetType: 'settings',
    targetId: 'public',
    before,
    after: next,
  });
  batch.set(doc(db(), SETTINGS_PATH), { ...next, auditId });
  await batch.commit();
}

// ── Team (super-admin) ─────────────────────────────────────────────────────

export interface TeamMember {
  uid: string;
  role: AdminRole;
  addedAt: Date | null;
  pseudo: string | null;
}

export async function loadTeam(): Promise<TeamMember[]> {
  const snap = await getDocs(collection(db(), 'admins'));
  const members = snap.docs.flatMap((d) => {
    const role = asRole(d.data()['role']);
    return role ? [{ uid: d.id, role, addedAt: dateOrNull(d.data()['addedAt']) }] : [];
  });
  const names = await pseudosOf(members.map((m) => m.uid));
  return members
    .map((m) => ({ ...m, pseudo: names.get(m.uid) ?? null }))
    .sort((a, b) => Number(b.role === 'super') - Number(a.role === 'super'));
}

/** uid of an existing account, found by e-mail or uid. */
export async function resolveAccount(raw: string): Promise<string | null> {
  const key = raw.trim();
  if (key.includes('@')) {
    const snap = await getDocs(
      query(collection(db(), 'users'), where('email', '==', key.toLowerCase()), limit(1)),
    );
    return snap.docs[0]?.id ?? null;
  }
  if (!UID_RE.test(key)) return null;
  return (await getDoc(doc(db(), 'users', key))).exists() ? key : null;
}

/** Adds a moderator, or removes one (role « none »: the rules never delete an admin entry). */
export async function setModerator(actor: string, uid: string, on: boolean): Promise<void> {
  const role = on ? 'moderator' : 'none';
  const batch = writeBatch(db());
  const auditId = audit(batch, actor, {
    action: on ? 'admin.add' : 'admin.remove',
    targetType: 'admin',
    targetId: uid,
    after: { role },
  });
  batch.set(doc(db(), 'admins', uid), { role, addedBy: actor, addedAt: serverTimestamp(), auditId });
  await batch.commit();
}

// ── Journal (super-admin) ──────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  actorUid: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  createdAt: Date | null;
}

export function loadAudit(after: QueryDocumentSnapshot | null): Promise<Page<AuditEntry>> {
  return page(collection(db(), 'auditLog'), [orderBy('createdAt', 'desc')], after, (d) => {
    const v = d.data();
    return {
      id: d.id,
      actorUid: String(v['actorUid'] ?? ''),
      action: String(v['action'] ?? ''),
      targetType: String(v['targetType'] ?? ''),
      targetId: String(v['targetId'] ?? ''),
      before: plain(v['before']),
      after: plain(v['after']),
      reason: typeof v['reason'] === 'string' ? v['reason'] : null,
      createdAt: dateOrNull(v['createdAt']),
    };
  });
}

// ── Health ─────────────────────────────────────────────────────────────────

export interface Health {
  active: number;
  hidden: number;
  removed: number;
  promoted: number;
  /** Super-admin only (listing private records is). */
  members: number | null;
  /** Super-admin only (ID photos, owner's decision of 3 Oct 2026). */
  pendingBadges: number | null;
  /** Super-admin only (moderators cannot read payments). */
  pendingPayments: number | null;
}

async function count(q: Query): Promise<number> {
  return (await getCount(q)).data().count;
}

export async function loadHealth(role: AdminRole): Promise<Health> {
  const [active, hidden, removed, promoted, members, pendingBadges, pendingPayments] = await Promise.all([
    count(query(listings(), where('status', '==', 'active'))),
    count(query(listings(), where('hidden', '==', true))),
    count(query(listings(), where('status', '==', 'removed'))),
    count(query(listings(), where('rank', '>', 0))),
    role === 'super' ? count(collection(db(), 'users')) : Promise.resolve(null),
    role === 'super'
      ? count(query(collection(db(), 'verificationRequests'), where('status', '==', 'pending')))
      : Promise.resolve(null),
    role === 'super'
      ? count(query(collection(db(), 'boostRequests'), where('status', '==', 'pending')))
      : Promise.resolve(null),
  ]);
  return { active, hidden, removed, promoted, members, pendingBadges, pendingPayments };
}

// ── « Nettoyage » (super-admin): fallback of the scheduled job ─────────────

export interface CleanupPlan {
  expired: AdminListing[];
  boosts: AdminListing[];
  shots: string[];
  /** A query came back full: run again afterwards. */
  more: boolean;
}

export async function planCleanup(now: Date = new Date()): Promise<CleanupPlan> {
  const expiredBefore = Timestamp.fromMillis(now.getTime() - LISTING_LIFETIME_DAYS * DAY_MS);
  const shotsBefore = new Date(now.getTime() - SCREENSHOT_KEEP_DAYS * DAY_MS);
  const [e, b, s] = await Promise.all([
    getDocs(query(listings(), where('renewedAt', '<', expiredBefore), limit(CLEANUP_MAX))),
    getDocs(query(listings(), where('boostUntil', '<', Timestamp.fromDate(now)), limit(CLEANUP_MAX))),
    getDocs(
      query(
        collection(db(), 'boostRequests'),
        where('status', 'in', ['approved', 'rejected']),
        where('createdAt', '<', Timestamp.fromDate(shotsBefore)),
        limit(SHOTS_MAX),
      ),
    ),
  ]);
  const expired = e.docs.map((d) => toAdminListing(d.id, d.data()));
  const gone = new Set(expired.map((l) => l.id));
  return {
    expired,
    boosts: b.docs.map((d) => toAdminListing(d.id, d.data())).filter((l) => !gone.has(l.id)),
    shots: s.docs
      .filter((d) => {
        const v = d.data();
        const at = dateOrNull(v['handledAt']);
        return v['screenshot'] != null && at !== null && at < shotsBefore;
      })
      .map((d) => d.id),
    more: e.size === CLEANUP_MAX || b.size === CLEANUP_MAX || s.size === SHOTS_MAX,
  };
}

/** One small batch per item (rules reads stay low); `onStep` reports the progress. */
export async function runCleanup(
  actor: string,
  plan: CleanupPlan,
  onStep: (done: number) => void,
): Promise<number> {
  let done = 0;
  const step = () => onStep(++done);
  for (const l of plan.expired) {
    const batch = writeBatch(db());
    audit(batch, actor, {
      action: 'listing.expire',
      targetType: 'listing',
      targetId: l.id,
      before: { renewedAt: l.renewedAt, title: l.title, ownerUid: l.ownerUid },
    });
    batch.delete(doc(db(), 'listings', l.id, 'private', 'contact'));
    batch.delete(doc(db(), 'listings', l.id));
    await batch.commit();
    step();
  }
  for (const l of plan.boosts) {
    await setPromotionExpired(actor, l);
    step();
  }
  for (const id of plan.shots) {
    const batch = writeBatch(db());
    audit(batch, actor, { action: 'boost.erase_screenshot', targetType: 'boostRequest', targetId: id });
    batch.update(doc(db(), 'boostRequests', id), { screenshot: null });
    await batch.commit();
    step();
  }
  return done;
}

async function setPromotionExpired(actor: string, l: AdminListing): Promise<void> {
  const batch = writeBatch(db());
  const auditId = audit(batch, actor, {
    action: 'listing.boost_expire',
    targetType: 'listing',
    targetId: l.id,
    before: { rank: l.rank, boostUntil: l.boostUntil },
    after: { rank: 0, boostUntil: null },
  });
  batch.update(doc(db(), 'listings', l.id), { rank: 0, boostUntil: null, auditId });
  await batch.commit();
}
