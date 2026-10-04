/**
 * « J'aime » and « Signaler » (ARCHITECTURE § 4, likes/reports): one document per (listing,
 * visitor), guaranteed by the rules. A visitor without an account gets an anonymous Firebase
 * session at the first tap. Loaded on demand (import()) so Auth never weighs on the first paint.
 */
import { signInAnonymously } from 'firebase/auth';
import {
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore/lite';
import type { ReportReason } from '../data/reports';
import { SETTINGS_PATH } from '../data/settings';
import { auth, currentUser } from '../firebase/auth';
import { db } from '../firebase/lite';

/**
 * uid of the member signed in, or of a new anonymous session. Also required before reading a
 * WhatsApp number (rules: no contact read without a session, security audit of 3 Oct 2026).
 */
export async function visitorUid(): Promise<string> {
  const user = await currentUser();
  if (user) return user.uid;
  return (await signInAnonymously(auth())).user.uid;
}

/** Likes or unlikes, from what is stored (not what the page believed). Returns the new state. */
export async function toggleLike(listingId: string): Promise<boolean> {
  const uid = await visitorUid();
  const likeRef = doc(db(), 'likes', `${listingId}_${uid}`);
  const listingRef = doc(db(), 'listings', listingId);
  const liked = (await getDoc(likeRef)).exists();
  const batch = writeBatch(db());
  if (liked) {
    batch.delete(likeRef);
    batch.update(listingRef, { likes: increment(-1) });
  } else {
    batch.set(likeRef, { listingId, uid, createdAt: serverTimestamp() });
    batch.update(listingRef, { likes: increment(1) });
  }
  await batch.commit();
  return !liked;
}

/**
 * Sends a report; the report that reaches the threshold of settings (10) also hides the listing
 * until a moderator decides (SPEC § 10). The rules refuse a second report by the same visitor.
 */
/**
 * One report per visitor. Only a verified account counts towards the automatic hiding (owner's
 * decision of 3 Oct 2026): an anonymous or unverified report is stored for the moderation, the
 * listing is left as it is. « Verified » is read from the token, as the rules see it.
 */
export async function reportListing(listingId: string, reason: ReportReason, note: string): Promise<void> {
  const uid = await visitorUid();
  const user = await currentUser();
  const verified =
    !!user && !user.isAnonymous && (await user.getIdTokenResult()).claims['email_verified'] === true;
  const reportRef = doc(db(), 'reports', `${listingId}_${uid}`);
  const report = { listingId, uid, reason, note: note.trim(), verified, createdAt: serverTimestamp() };
  if (!verified) {
    await setDoc(reportRef, report);
    return;
  }
  const listingRef = doc(db(), 'listings', listingId);
  await runTransaction(db(), async (tx) => {
    const [listing, settings] = await Promise.all([tx.get(listingRef), tx.get(doc(db(), SETTINGS_PATH))]);
    const count = Number(listing.data()?.['reportsCount'] ?? 0) + 1;
    const threshold = Number(settings.data()?.['reportsHideThreshold'] ?? Infinity);
    tx.set(reportRef, report);
    tx.update(
      listingRef,
      count >= threshold ? { reportsCount: count, hidden: true } : { reportsCount: count },
    );
  });
}
