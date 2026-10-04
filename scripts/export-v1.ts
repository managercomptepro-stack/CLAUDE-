/**
 * One-off export of the v1 data of a Firebase project before the v2 switch-over.
 * Writes archives/v1-export/ (git-ignored: personal data) with every Auth account and every
 * Firestore document (all collections, recursively), plus a count-only summary.md safe to commit.
 * Usage (CI): FIREBASE_SERVICE_ACCOUNT='<json>' tsx scripts/export-v1.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type CollectionReference } from 'firebase-admin/firestore';

const raw = process.env['FIREBASE_SERVICE_ACCOUNT'];
if (!raw) throw new Error('E_NO_SERVICE_ACCOUNT: FIREBASE_SERVICE_ACCOUNT absent');
const app = initializeApp({ credential: cert(JSON.parse(raw) as Record<string, string>) }, 'export');
const out = join('archives', 'v1-export');
mkdirSync(out, { recursive: true });

const users: unknown[] = [];
let pageToken: string | undefined;
do {
  const page = await getAuth(app).listUsers(1000, pageToken);
  for (const u of page.users) {
    users.push({
      uid: u.uid,
      email: u.email ?? null,
      emailVerified: u.emailVerified,
      displayName: u.displayName ?? null,
      providers: u.providerData.map((p) => p.providerId),
      created: u.metadata.creationTime,
      lastSignIn: u.metadata.lastSignInTime,
      disabled: u.disabled,
    });
  }
  pageToken = page.pageToken;
} while (pageToken);
writeFileSync(join(out, 'auth-users.json'), JSON.stringify(users, null, 2));

const counts: Record<string, number> = {};
const docs: Record<string, unknown> = {};
async function dump(col: CollectionReference): Promise<void> {
  const snap = await col.get();
  counts[col.path.replace(/\/[^/]+\//g, '/*/')] =
    (counts[col.path.replace(/\/[^/]+\//g, '/*/')] ?? 0) + snap.size;
  for (const d of snap.docs) {
    docs[d.ref.path] = d.data();
    for (const sub of await d.ref.listCollections()) await dump(sub);
  }
}
for (const col of await getFirestore(app).listCollections()) await dump(col);
writeFileSync(join(out, 'firestore.json'), JSON.stringify(docs, null, 2));

const lines = [
  `# Export v1 — ${new Date().toISOString()}`,
  '',
  `- Comptes Auth : ${users.length}`,
  ...Object.entries(counts).map(([k, v]) => `- ${k} : ${v} documents`),
  '',
  'Données complètes : artefact GitHub Actions « v1-export » (non versionné, données personnelles).',
];
writeFileSync(join(out, 'summary.md'), lines.join('\n') + '\n');
process.stdout.write(lines.join('\n') + '\n');
