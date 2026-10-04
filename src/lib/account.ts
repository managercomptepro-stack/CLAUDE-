/**
 * Account documents in Firestore (ARCHITECTURE § 4): users (private), publicProfiles (public),
 * usernames (pseudo uniqueness). Created together and erased together, as the rules require.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore/lite';
import { normalizeSettings, SETTINGS_PATH, type PublicSettings } from '../data/settings';
import { db } from '../firebase/lite';
import { AppError, errorCode } from './errors';
import type { ProfileValues } from './profile-form';

export interface UserRecord {
  email: string;
  birthDate: Date;
  genre: string;
  city: string;
  whatsapp: string;
  termsVersion: string;
  createdAt: Date;
  strikes: number;
  publishBanned: boolean;
  /** Set when the member asked for the deletion of the account (frozen until erased). */
  deletionRequestedAt: Date | null;
}

export interface PublicProfile {
  pseudo: string;
  photoUrl: string | null;
  memberSince: Date;
  verified: boolean;
}

export interface Account {
  user: UserRecord;
  profile: PublicProfile;
}

function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date(0);
}

export async function loadSettings(): Promise<PublicSettings> {
  const snap = await getDoc(doc(db(), SETTINGS_PATH));
  if (!snap.exists()) throw new AppError('nioxxer/settings-missing');
  return normalizeSettings(snap.data());
}

/** The account of `uid`, or null while its profile has not been filled in. */
export async function loadAccount(uid: string): Promise<Account | null> {
  const [u, p] = await Promise.all([
    getDoc(doc(db(), 'users', uid)),
    getDoc(doc(db(), 'publicProfiles', uid)),
  ]);
  if (!u.exists() || !p.exists()) return null;
  const ud = u.data();
  const pd = p.data();
  return {
    user: {
      email: String(ud['email'] ?? ''),
      birthDate: toDate(ud['birthDate']),
      genre: String(ud['genre'] ?? ''),
      city: String(ud['city'] ?? ''),
      whatsapp: String(ud['whatsapp'] ?? ''),
      termsVersion: String(ud['termsVersion'] ?? ''),
      createdAt: toDate(ud['createdAt']),
      strikes: Number(ud['strikes'] ?? 0),
      publishBanned: ud['publishBanned'] === true,
      deletionRequestedAt:
        ud['deletionRequestedAt'] instanceof Timestamp ? ud['deletionRequestedAt'].toDate() : null,
    },
    profile: {
      pseudo: String(pd['pseudo'] ?? ''),
      photoUrl: typeof pd['photoUrl'] === 'string' ? pd['photoUrl'] : null,
      memberSince: toDate(pd['memberSince']),
      verified: pd['verified'] === true,
    },
  };
}

/** True when the pseudo already belongs to someone (`usernames` is readable one by one). */
export async function isPseudoTaken(pseudoLower: string): Promise<boolean> {
  return (await getDoc(doc(db(), 'usernames', pseudoLower))).exists();
}

/**
 * Creates users + publicProfiles + usernames in one batch. If the pseudo was taken meanwhile,
 * the batch turns into an update of `usernames`, which the rules refuse: reported as
 * « pseudo pris ».
 */
export async function createAccount(uid: string, email: string, values: ProfileValues): Promise<void> {
  const settings = await loadSettings();
  if (await isPseudoTaken(values.pseudoLower)) throw new AppError('nioxxer/pseudo-taken');
  const now = serverTimestamp();
  const batch = writeBatch(db());
  batch.set(doc(db(), 'users', uid), {
    email,
    birthDate: Timestamp.fromDate(values.birthDate),
    genre: values.genre,
    city: values.city,
    whatsapp: values.whatsapp,
    termsVersion: settings.termsVersion,
    termsAcceptedAt: now,
    createdAt: now,
    strikes: 0,
    publishBanned: false,
  });
  batch.set(doc(db(), 'publicProfiles', uid), {
    pseudo: values.pseudo,
    photoUrl: values.photoUrl,
    memberSince: now,
    verified: false,
  });
  batch.set(doc(db(), 'usernames', values.pseudoLower), { uid });
  try {
    await batch.commit();
  } catch (error) {
    if (errorCode(error) === 'permission-denied' && (await isPseudoTaken(values.pseudoLower))) {
      throw new AppError('nioxxer/pseudo-taken');
    }
    throw error;
  }
}

/** Records the acceptance of the current terms (the rules check the version and the server time). */
export async function acceptTerms(uid: string, version: string): Promise<void> {
  await updateDoc(doc(db(), 'users', uid), { termsVersion: version, termsAcceptedAt: serverTimestamp() });
}

export async function updateProfilePhoto(uid: string, photoUrl: string | null): Promise<void> {
  await updateDoc(doc(db(), 'publicProfiles', uid), { photoUrl });
}

export async function updateContact(uid: string, values: { city: string; whatsapp: string }): Promise<void> {
  await updateDoc(doc(db(), 'users', uid), { city: values.city, whatsapp: values.whatsapp });
}

/**
 * True when the account was erased but its sign-in account is still there: the super-admin erased
 * it (tombstone `deletedAccounts/{uid}`, or a sanctioned record kept without its public profile)
 * and the nightly job has not removed the sign-in account yet. It must finish its deletion, not
 * fill the profile step again (the rules refuse a new `users` doc).
 */
export async function hasLeftoverRecord(uid: string): Promise<boolean> {
  const [u, p, t] = await Promise.all([
    getDoc(doc(db(), 'users', uid)),
    getDoc(doc(db(), 'publicProfiles', uid)),
    getDoc(doc(db(), 'deletedAccounts', uid)),
  ]);
  return t.exists() || (u.exists() && !p.exists());
}

/**
 * Deletion request (owner's decision of 3 Oct 2026): one batch sets `deletionRequestedAt` (server
 * time) and closes the active listings, which leave the site at once. The super-admin erases the
 * account, or the nightly job does it after ACCOUNT_PURGE_DAYS; until then the admins can read it.
 */
export async function requestAccountDeletion(uid: string): Promise<void> {
  const own = await getDocs(query(collection(db(), 'listings'), where('ownerUid', '==', uid)));
  const batch = writeBatch(db());
  batch.update(doc(db(), 'users', uid), { deletionRequestedAt: serverTimestamp() });
  for (const l of own.docs) {
    if (l.data()['status'] === 'active')
      batch.update(l.ref, { status: 'closed', updatedAt: serverTimestamp() });
  }
  await batch.commit();
}
