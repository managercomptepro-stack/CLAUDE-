/**
 * Shared fixtures for the security-rules tests. Runs against the Firestore emulator only
 * (project id « demo-… »): never against production.
 */
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

export const PROJECT_ID = 'demo-nioxxer-rules';
const DAY_MS = 86_400_000;

export async function createEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
}

/** Signed-in user with a verified e-mail (default) or not. */
export function userCtx(env: RulesTestEnvironment, uid: string, verified = true): RulesTestContext {
  return env.authenticatedContext(uid, {
    email: `${uid}@example.cm`,
    email_verified: verified,
    firebase: { sign_in_provider: 'password', identities: {} },
  });
}

export function anonCtx(env: RulesTestEnvironment, uid: string): RulesTestContext {
  return env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous', identities: {} } });
}

export function daysAgo(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - days * DAY_MS);
}

export function daysFromNow(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + days * DAY_MS);
}

/** UTC birth date `years` years ago (minus/plus some days). */
export function birthDate(years: number, extraDays = 0): Timestamp {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCHours(0, 0, 0, 0);
  return Timestamp.fromMillis(d.getTime() - extraDays * DAY_MS);
}

export function firstOfMonthUtc(t: Timestamp): Timestamp {
  const d = t.toDate();
  return Timestamp.fromMillis(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export const SETTINGS: DocumentData = {
  prices: { premium: 2000, sponsored: 500 },
  boostDays: { premium: 7, sponsored: 7 },
  payment: { mtn: { number: '', name: '' }, orange: { number: '', name: '' } },
  maxActiveListings: 7,
  reportsHideThreshold: 10,
  supportWhatsApp: '+237678802447',
  termsVersion: '2026-10-1',
};

export const DEFAULT_BIRTH = birthDate(30, 40);
export const MEMBER_SINCE = daysAgo(60);

/** Writes documents with the rules disabled (test fixtures). */
export async function seed(env: RulesTestEnvironment, docs: Record<string, DocumentData>): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(db, path), data);
  });
}

/** A registered user (users + publicProfiles + usernames) and the public settings. */
export function memberDocs(
  uid: string,
  extra: { banned?: boolean; strikes?: number } = {},
): Record<string, DocumentData> {
  return {
    [`users/${uid}`]: {
      email: `${uid}@example.cm`,
      birthDate: DEFAULT_BIRTH,
      genre: 'femme',
      city: 'douala',
      whatsapp: '+237678802447',
      termsVersion: '2026-10-1',
      termsAcceptedAt: MEMBER_SINCE,
      createdAt: MEMBER_SINCE,
      strikes: extra.strikes ?? 0,
      publishBanned: extra.banned ?? false,
    },
    [`publicProfiles/${uid}`]: {
      pseudo: `Membre${uid}`,
      photoUrl: null,
      memberSince: MEMBER_SINCE,
      verified: false,
    },
    [`usernames/membre${uid}`]: { uid },
  };
}

export function adminDocs(uid: string, role: 'super' | 'moderator'): Record<string, DocumentData> {
  return { [`admins/${uid}`]: { role, addedBy: 'console', addedAt: MEMBER_SINCE } };
}

export const PHOTO = 'abc123:1200x1600';

/** Listing data as the client sends it at creation (server timestamps resolved by the rules). */
export function newListing(uid: string, overrides: DocumentData = {}): DocumentData {
  return {
    ownerUid: uid,
    pseudo: `Membre${uid}`,
    profilePhotoUrl: null,
    verified: false,
    memberSince: MEMBER_SINCE,
    birthMonth: firstOfMonthUtc(DEFAULT_BIRTH),
    genre: 'femme',
    citySlug: 'douala',
    district: 'Bonamoussadi',
    title: 'Femme douce cherche homme sérieux',
    description: 'Je cherche une rencontre sincère avec un homme respectueux.',
    offer: 'Un verre en terrasse pour commencer',
    photos: [PHOTO],
    contactMode: 'message',
    rank: 0,
    boostUntil: null,
    views: 0,
    likes: 0,
    reportsCount: 0,
    hidden: false,
    status: 'active',
    removedReason: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    renewedAt: serverTimestamp(),
    ...overrides,
  };
}

/** Same listing as stored after creation (fixture written with rules disabled). */
export function storedListing(uid: string, overrides: DocumentData = {}): DocumentData {
  const now = Timestamp.now();
  return newListing(uid, { createdAt: now, updatedAt: now, renewedAt: now, ...overrides });
}

export function contactDoc(callAllowed = false): DocumentData {
  return { whatsapp: '+237678802447', callAllowed };
}

/** Creates a listing + its private contact in one batch, as the publish page will. */
export async function publish(
  ctx: RulesTestContext,
  listingId: string,
  data: DocumentData,
  contact: DocumentData = contactDoc(data['contactMode'] === 'call_message'),
): Promise<void> {
  const db = ctx.firestore() as unknown as Firestore;
  const batch = writeBatch(db);
  batch.set(doc(db, `listings/${listingId}`), data);
  batch.set(doc(db, `listings/${listingId}/private/contact`), contact);
  await batch.commit();
}

export function fs(ctx: RulesTestContext): Firestore {
  return ctx.firestore() as unknown as Firestore;
}
