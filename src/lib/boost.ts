/**
 * Boost requests in Firestore (ARCHITECTURE § 4): `boostRequests/{auto}` and its lock
 * `pendingBoosts/{listingId}`, written in one batch (rules: tests/rules/admin.test.ts).
 */
import { collection, doc, getDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore/lite';
import type { PublicSettings } from '../data/settings';
import { db } from '../firebase/lite';
import { loadSettings } from './account';
import type { BoostTier, Operator } from './boost-form';
import { AppError } from './errors';
import { toListing } from './listing';
import type { OwnListing } from './listing-status';

/** Same shape as the rules' `isOwnListingId`: `{uid}_{n}`. */
const OWN_ID = /^[A-Za-z0-9]+_[1-9][0-9]?$/;

function isOwnId(uid: string, listingId: string): boolean {
  return OWN_ID.test(listingId) && listingId.startsWith(`${uid}_`);
}

/** Date of the pending request of this listing, or null when there is none. */
async function pendingSince(listingId: string): Promise<Date | null> {
  const snap = await getDoc(doc(db(), 'pendingBoosts', listingId));
  if (!snap.exists()) return null;
  const at = snap.data()['createdAt'];
  return at instanceof Timestamp ? at.toDate() : new Date();
}

export interface BoostContext {
  listing: OwnListing | null;
  settings: PublicSettings;
  pendingSince: Date | null;
}

export async function loadBoostContext(uid: string, listingId: string): Promise<BoostContext> {
  if (!isOwnId(uid, listingId)) return { listing: null, settings: await loadSettings(), pendingSince: null };
  const [snap, settings, since] = await Promise.all([
    getDoc(doc(db(), 'listings', listingId)),
    loadSettings(),
    pendingSince(listingId),
  ]);
  return { listing: snap.exists() ? toListing(snap.id, snap.data()) : null, settings, pendingSince: since };
}

/** Ids among `listingIds` that have a request waiting for the admin (« Mes annonces »). */
export async function pendingListingIds(uid: string, listingIds: readonly string[]): Promise<Set<string>> {
  const own = listingIds.filter((id) => isOwnId(uid, id));
  const dates = await Promise.all(own.map((id) => pendingSince(id)));
  return new Set(own.filter((_, i) => dates[i] !== null));
}

export interface BoostRequestValues {
  tier: BoostTier;
  operator: Operator;
  amount: number;
  txRef: string | null;
  screenshot: string;
}

export async function submitBoostRequest(
  uid: string,
  listingId: string,
  v: BoostRequestValues,
): Promise<void> {
  if (!isOwnId(uid, listingId)) throw new AppError('nioxxer/no-user');
  if (await pendingSince(listingId)) throw new AppError('nioxxer/boost-pending');
  const request = doc(collection(db(), 'boostRequests'));
  const batch = writeBatch(db());
  batch.set(request, {
    listingId,
    ownerUid: uid,
    tier: v.tier,
    operator: v.operator,
    amount: v.amount,
    txRef: v.txRef,
    screenshot: v.screenshot,
    status: 'pending',
    rejectReason: null,
    createdAt: serverTimestamp(),
    handledBy: null,
    handledAt: null,
  });
  batch.set(doc(db(), 'pendingBoosts', listingId), { requestId: request.id, createdAt: serverTimestamp() });
  await batch.commit();
}
