/**
 * Read-only export of the v1 production data (project nioxxer-cda95) before the v2 switch.
 * Writes every Firestore collection (with sub-collections) and the Auth user list as JSON to
 * archives/v1-export/<date>/ — git-ignored: it holds personal data.
 *
 * Usage (Windows PowerShell, service account key kept OUTSIDE the repository):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\cles\nioxxer-cda95.json"; npm run export:v1
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type CollectionReference } from 'firebase-admin/firestore';

const PROJECT_ID = 'nioxxer-cda95';
const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID }, 'export-v1');
const db = getFirestore(app);
const outDir = join('archives', 'v1-export', new Date().toISOString().slice(0, 10));
mkdirSync(outDir, { recursive: true });

interface ExportedDoc {
  id: string;
  path: string;
  data: Record<string, unknown>;
  sub: Record<string, ExportedDoc[]>;
}

async function dumpCollection(col: CollectionReference): Promise<ExportedDoc[]> {
  const snap = await col.get();
  const docs: ExportedDoc[] = [];
  for (const d of snap.docs) {
    const sub: Record<string, ExportedDoc[]> = {};
    for (const child of await d.ref.listCollections()) sub[child.id] = await dumpCollection(child);
    docs.push({ id: d.id, path: d.ref.path, data: d.data(), sub });
  }
  return docs;
}

const summary: Record<string, number> = {};
for (const col of await db.listCollections()) {
  const docs = await dumpCollection(col);
  writeFileSync(join(outDir, `${col.id}.json`), JSON.stringify(docs, null, 2));
  summary[col.id] = docs.length;
}

const users: Record<string, unknown>[] = [];
let pageToken: string | undefined;
do {
  const page = await getAuth(app).listUsers(1000, pageToken);
  for (const u of page.users) {
    users.push({
      uid: u.uid,
      email: u.email ?? null,
      emailVerified: u.emailVerified,
      providers: u.providerData.map((p) => p.providerId),
      created: u.metadata.creationTime,
      lastSignIn: u.metadata.lastSignInTime,
      disabled: u.disabled,
    });
  }
  pageToken = page.pageToken;
} while (pageToken);
writeFileSync(join(outDir, 'auth-users.json'), JSON.stringify(users, null, 2));
summary['auth-users'] = users.length;

writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.error(`[export-v1] ${outDir} → ${JSON.stringify(summary)}`);
