/**
 * REST helpers for the LOCAL Firebase emulators only (seed, end-to-end tests). Every function
 * refuses a project id that does not start with « demo- »: a demo project can never reach a
 * real Firebase project, so nothing here can touch production.
 */
export const EMULATOR_PROJECT = 'demo-nioxxer';
const FIRESTORE = `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}`;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`;
const API_KEY = 'demo-api-key';

function assertDemo(project: string): void {
  if (!project.startsWith('demo-')) throw new Error(`E_NOT_EMULATOR: refusing project « ${project} »`);
}

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

/** Plain JSON → Firestore REST value (integers stay integers, as the rules expect). */
export function toValue(v: unknown): FirestoreValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
}

export function toFields(o: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)]));
}

function docsUrl(project: string, path = ''): string {
  return `${FIRESTORE}/v1/projects/${project}/databases/(default)/documents${path ? `/${path}` : ''}`;
}

async function ok(res: Response, what: string): Promise<Response> {
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${await res.text()}`);
  return res;
}

/** Writes a document with the rules bypassed (« Bearer owner » is accepted by the emulator only). */
export async function writeDoc(
  path: string,
  data: Record<string, unknown>,
  project = EMULATOR_PROJECT,
): Promise<void> {
  assertDemo(project);
  await ok(
    await fetch(docsUrl(project, path), {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFields(data) }),
    }),
    `write ${path}`,
  );
}

function fromValue(v: Record<string, unknown>): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v['booleanValue'];
  if ('integerValue' in v) return Number(v['integerValue']);
  if ('doubleValue' in v) return v['doubleValue'];
  if ('stringValue' in v) return v['stringValue'];
  if ('timestampValue' in v) return new Date(String(v['timestampValue']));
  if ('arrayValue' in v) {
    const values = (v['arrayValue'] as { values?: Record<string, unknown>[] }).values ?? [];
    return values.map(fromValue);
  }
  if ('mapValue' in v) {
    const fields = (v['mapValue'] as { fields?: Record<string, Record<string, unknown>> }).fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([k, x]) => [k, fromValue(x)]));
  }
  return undefined;
}

/** A document as plain values (rules bypassed), or null when it does not exist. */
export async function readDoc(
  path: string,
  project = EMULATOR_PROJECT,
): Promise<Record<string, unknown> | null> {
  assertDemo(project);
  const res = await fetch(docsUrl(project, path), { headers: { Authorization: 'Bearer owner' } });
  if (res.status === 404) return null;
  await ok(res, `read ${path}`);
  const { fields = {} } = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)]));
}

export async function deleteDocument(path: string, project = EMULATOR_PROJECT): Promise<void> {
  assertDemo(project);
  await ok(
    await fetch(docsUrl(project, path), { method: 'DELETE', headers: { Authorization: 'Bearer owner' } }),
    `delete ${path}`,
  );
}

/** True when the document exists (read with the rules bypassed). */
export async function docExists(path: string, project = EMULATOR_PROJECT): Promise<boolean> {
  assertDemo(project);
  const res = await fetch(docsUrl(project, path), { headers: { Authorization: 'Bearer owner' } });
  if (res.status === 404) return false;
  await ok(res, `read ${path}`);
  return true;
}

export async function clearFirestore(project = EMULATOR_PROJECT): Promise<void> {
  assertDemo(project);
  await ok(
    await fetch(docsUrl(project).replace('/v1/', '/emulator/v1/'), { method: 'DELETE' }),
    'clear firestore',
  );
}

export async function clearAuth(project = EMULATOR_PROJECT): Promise<void> {
  assertDemo(project);
  await ok(
    await fetch(`${AUTH}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' }),
    'clear auth',
  );
}

interface OobCode {
  email: string;
  requestType: string;
  oobCode: string;
}

/** Last e-mail action code (VERIFY_EMAIL, PASSWORD_RESET) sent by the Auth emulator to `email`. */
export async function lastOobCode(
  email: string,
  requestType: string,
  project = EMULATOR_PROJECT,
): Promise<string> {
  assertDemo(project);
  const res = await ok(await fetch(`${AUTH}/emulator/v1/projects/${project}/oobCodes`), 'oobCodes');
  const { oobCodes } = (await res.json()) as { oobCodes: OobCode[] };
  const match = oobCodes
    .filter((c) => c.email === email.toLowerCase() && c.requestType === requestType)
    .pop();
  if (!match) throw new Error(`no ${requestType} code for ${email}`);
  return match.oobCode;
}

async function identityToolkit(
  method: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await ok(
    await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    `accounts:${method}`,
  );
  return (await res.json()) as Record<string, unknown>;
}

/** Same as opening the verification link of the e-mail. */
export async function applyVerification(email: string): Promise<void> {
  await identityToolkit('update', { oobCode: await lastOobCode(email, 'VERIFY_EMAIL') });
}

/** Same as choosing a new password from the reset e-mail. */
export async function applyPasswordReset(email: string, newPassword: string): Promise<void> {
  await identityToolkit('resetPassword', {
    oobCode: await lastOobCode(email, 'PASSWORD_RESET'),
    newPassword,
  });
}

/** Auth account without any Firestore profile (to reach the profile step). */
export async function createAuthUser(email: string, password: string): Promise<void> {
  await identityToolkit('signUp', { email, password, returnSecureToken: true });
}

/** uid of an e-mail/password account (signs in through the Auth emulator REST API). */
export async function uidOf(email: string, password: string): Promise<string> {
  const res = await identityToolkit('signInWithPassword', { email, password, returnSecureToken: true });
  return String(res['localId']);
}
