/**
 * Bootstrap of the first super-admin (HUMAN-TODO « admins/{uid} ») without the console:
 * checks the Auth account exists, writes admins/{uid} { role: 'super' } and one auditLog entry.
 * Usage: GOOGLE_APPLICATION_CREDENTIALS=<key> npx tsx scripts/grant-super-admin.ts <uid>
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const uid = process.argv[2] ?? '';
if (!/^[A-Za-z0-9]{20,128}$/.test(uid)) throw new Error('E_BAD_UID');

const app = initializeApp({ credential: applicationDefault() }, 'grant-super-admin');
const user = await getAuth(app).getUser(uid);
const db = getFirestore(app);
const batch = db.batch();
const audit = db.collection('auditLog').doc();
batch.set(audit, {
  actorUid: 'system',
  action: 'admin.add',
  targetType: 'admin',
  targetId: uid,
  before: null,
  after: { role: 'super' },
  reason: 'Premier super-admin (propriétaire, 4 oct. 2026)',
  createdAt: FieldValue.serverTimestamp(),
});
batch.set(db.collection('admins').doc(uid), {
  role: 'super',
  addedBy: 'system',
  addedAt: FieldValue.serverTimestamp(),
  auditId: audit.id,
});
await batch.commit();
console.error(`[grant-super-admin] ${uid} (${user.providerData.map((p) => p.providerId).join(',')}) → super`);
