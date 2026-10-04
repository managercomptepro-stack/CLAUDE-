/**
 * The author's listings in Firestore (ARCHITECTURE § 4–5): `listings/{uid}_{n}` (public) and
 * `listings/{id}/private/contact` (WhatsApp, read one at a time on click). Every write mirrors
 * a rule of firestore.rules (see tests/rules/listings.test.ts).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore/lite';
import { db } from '../firebase/lite';
import { loadSettings } from './account';
import { AppError } from './errors';
import type { ListingValues } from './listing-form';
import { capOf, freeSlot, type OwnListing } from './listing-status';

export type { OwnListing };

function date(v: unknown): Date {
  return v instanceof Timestamp ? v.toDate() : new Date(0);
}

export function toListing(id: string, d: Record<string, unknown>): OwnListing {
  return {
    id,
    genre: String(d['genre'] ?? ''),
    citySlug: String(d['citySlug'] ?? ''),
    district: String(d['district'] ?? ''),
    title: String(d['title'] ?? ''),
    description: String(d['description'] ?? ''),
    offer: String(d['offer'] ?? ''),
    photos: Array.isArray(d['photos']) ? d['photos'].map(String) : [],
    contactMode: d['contactMode'] === 'call_message' ? 'call_message' : 'message',
    rank: Number(d['rank'] ?? 0),
    boostUntil: d['boostUntil'] instanceof Timestamp ? d['boostUntil'].toDate() : null,
    views: Number(d['views'] ?? 0),
    likes: Number(d['likes'] ?? 0),
    hidden: d['hidden'] === true,
    status: d['status'] === 'removed' || d['status'] === 'closed' ? d['status'] : 'active',
    removedReason: typeof d['removedReason'] === 'string' ? d['removedReason'] : null,
    createdAt: date(d['createdAt']),
    renewedAt: date(d['renewedAt']),
  };
}

/** All the author's listings (active, hidden by reports, removed by moderation), newest first. */
export async function loadOwnListings(uid: string): Promise<OwnListing[]> {
  const snap = await getDocs(query(collection(db(), 'listings'), where('ownerUid', '==', uid)));
  return snap.docs
    .map((d) => toListing(d.id, d.data()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export interface EditableListing {
  listing: OwnListing;
  whatsapp: string;
}

/** A listing of the author with its private contact, or null if it is not theirs / gone. */
export async function loadOwnListing(uid: string, id: string): Promise<EditableListing | null> {
  if (!id.startsWith(`${uid}_`)) return null;
  const [l, c] = await Promise.all([
    getDoc(doc(db(), 'listings', id)),
    getDoc(doc(db(), 'listings', id, 'private', 'contact')),
  ]);
  if (!l.exists()) return null;
  return { listing: toListing(l.id, l.data()), whatsapp: String(c.data()?.['whatsapp'] ?? '') };
}

function content(v: ListingValues) {
  return {
    genre: v.genre,
    citySlug: v.citySlug,
    district: v.district,
    title: v.title,
    description: v.description,
    offer: v.offer,
    photos: v.photos,
    contactMode: v.contactMode,
  };
}

function contactDoc(v: ListingValues) {
  return { whatsapp: v.whatsapp, callAllowed: v.contactMode === 'call_message' };
}

/**
 * Publishes a new listing in the first free slot. The denormalised profile fields are copied
 * from the raw documents (a Timestamp read back as a Date would lose its microseconds and no
 * longer equal the profile, which the rules check).
 */
/** Active listings this account may have (« Mes annonces », /publier). */
export async function loadListingCap(uid: string): Promise<number> {
  const [settings, user] = await Promise.all([loadSettings(), getDoc(doc(db(), 'users', uid))]);
  return capOf(settings.maxActiveListings, user.data()?.['maxListings']);
}

export async function createListing(uid: string, values: ListingValues): Promise<string> {
  const [settings, own, profileSnap, userSnap] = await Promise.all([
    loadSettings(),
    getDocs(query(collection(db(), 'listings'), where('ownerUid', '==', uid))),
    getDoc(doc(db(), 'publicProfiles', uid)),
    getDoc(doc(db(), 'users', uid)),
  ]);
  const id = freeSlot(
    uid,
    own.docs.map((d) => d.id),
    capOf(settings.maxActiveListings, userSnap.data()?.['maxListings']),
  );
  if (!id) throw new AppError('nioxxer/listing-limit');
  const profile = profileSnap.data();
  const birth = userSnap.data()?.['birthDate'];
  if (!profile || !(birth instanceof Timestamp)) throw new AppError('nioxxer/no-user');
  const b = birth.toDate();
  const now = serverTimestamp();
  const batch = writeBatch(db());
  batch.set(doc(db(), 'listings', id), {
    ownerUid: uid,
    pseudo: profile['pseudo'],
    profilePhotoUrl: profile['photoUrl'] ?? null,
    verified: profile['verified'] === true,
    memberSince: profile['memberSince'],
    birthMonth: Timestamp.fromMillis(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1)),
    ...content(values),
    rank: 0,
    boostUntil: null,
    views: 0,
    likes: 0,
    reportsCount: 0,
    hidden: false,
    status: 'active',
    removedReason: null,
    createdAt: now,
    updatedAt: now,
    renewedAt: now,
  });
  batch.set(doc(db(), 'listings', id, 'private', 'contact'), contactDoc(values));
  await batch.commit();
  return id;
}

/** Saves the author's changes (content, photos, WhatsApp, contact mode). */
export async function updateListing(id: string, values: ListingValues): Promise<void> {
  const batch = writeBatch(db());
  batch.update(doc(db(), 'listings', id), { ...content(values), updatedAt: serverTimestamp() });
  batch.set(doc(db(), 'listings', id, 'private', 'contact'), contactDoc(values));
  await batch.commit();
}

/** « Republier »: 6 more months from now (renewedAt = server time). */
export async function republishListing(id: string): Promise<void> {
  const batch = writeBatch(db());
  const now = serverTimestamp();
  batch.update(doc(db(), 'listings', id), { renewedAt: now, updatedAt: now });
  await batch.commit();
}

/** Deletes the listing and its private contact (frees the slot). */
export async function deleteListing(id: string): Promise<void> {
  const batch = writeBatch(db());
  batch.delete(doc(db(), 'listings', id, 'private', 'contact'));
  batch.delete(doc(db(), 'listings', id));
  await batch.commit();
}

/**
 * Copies a new profile photo onto the author's active listings (the rules accept it only when it
 * equals the profile's photo). Best effort: a failure leaves the old photo on the listings.
 */
export async function syncProfilePhoto(uid: string, photoUrl: string | null): Promise<void> {
  const own = await getDocs(query(collection(db(), 'listings'), where('ownerUid', '==', uid)));
  const active = own.docs.filter((d) => d.data()['status'] === 'active');
  if (!active.length) return;
  const batch = writeBatch(db());
  for (const d of active) batch.update(d.ref, { profilePhotoUrl: photoUrl, updatedAt: serverTimestamp() });
  await batch.commit();
}
