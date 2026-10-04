/**
 * Member side of the verified badge (SPEC § 8): `verificationRequests/{uid}` holds the ID photo
 * (compressed JPEG data URL) until an admin decides; the image is then erased by the admin batch.
 */
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore/lite';
import { db } from '../firebase/lite';

export type BadgeRequestStatus = 'pending' | 'approved' | 'rejected';

export async function loadBadgeStatus(uid: string): Promise<BadgeRequestStatus | null> {
  const snap = await getDoc(doc(db(), 'verificationRequests', uid));
  if (!snap.exists()) return null;
  const s = snap.data()['status'];
  return s === 'pending' || s === 'approved' || s === 'rejected' ? s : null;
}

/**
 * First request (create), a new one after a refusal (update), or after a badge withdrawn by an
 * admin (the old approved request is erased first: the rules only update a refused one).
 */
export async function submitBadgeRequest(
  uid: string,
  idImage: string,
  previous: BadgeRequestStatus | null,
): Promise<void> {
  const ref = doc(db(), 'verificationRequests', uid);
  const fields = {
    idImage,
    status: 'pending',
    createdAt: serverTimestamp(),
    handledBy: null,
    handledAt: null,
  };
  if (previous === 'rejected') return updateDoc(ref, fields);
  if (previous === 'approved') await deleteDoc(ref);
  await setDoc(ref, fields);
}
