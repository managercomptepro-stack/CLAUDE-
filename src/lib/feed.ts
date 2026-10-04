/**
 * Public reads and visitor writes that need no account (ARCHITECTURE § 9): feed pages, Premium
 * banner (all cities), one listing, a member and their listings, the WhatsApp contact (read on click only),
 * the daily view, the reset of an expired boost (owner's decision 2), per-city counts.
 */
import {
  collection,
  doc,
  getCount,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore/lite';
import { CITIES } from '../data/cities';
import type { Genre } from '../data/genres';
import { FEED_PAGE_SIZE } from '../data/limits';
import { db } from '../firebase/lite';
import { errorCode } from './errors';
import {
  birthMonthBounds,
  hasExpiredBoost,
  isExpired,
  RAIL_MAX,
  railOf,
  toPublicListing,
  type PublicListing,
} from './public-listing';

export type FeedCursor = QueryDocumentSnapshot<DocumentData>;

export interface FeedQuery {
  citySlug: string;
  genres: Genre[];
  ageMin: number;
  ageMax: number;
}

export interface FeedPage {
  items: PublicListing[];
  cursor: FeedCursor | null;
  done: boolean;
}

const listings = () => collection(db(), 'listings');
/** The only listings anyone may list (rules: `isPublic`). */
const PUBLIC = [where('status', '==', 'active'), where('hidden', '==', false)];

/** Shown listings: expired ones are skipped (the maintenance job removes them later). */
function visible(docs: readonly FeedCursor[], now = new Date()): PublicListing[] {
  return docs
    .map((d) => toPublicListing(d.id, d.data()))
    .filter((l): l is PublicListing => l !== null && !isExpired(l, now));
}

/** Resets the boosts that have ended (owner's decision 2); true when there was one. */
async function healBoosts(items: readonly PublicListing[], wait: boolean): Promise<boolean> {
  const stale = items.filter((l) => hasExpiredBoost(l));
  const resets = Promise.all(stale.map((l) => resetExpiredBoost(l.id)));
  if (wait) await resets;
  return stale.length > 0;
}

/**
 * One page of 20: Premium, Sponsored, free, newest first in each group (rank, createdAt). A boost
 * that has ended still sorts with its old rank: it is reset first, then the page is read again,
 * so the order shown is always exact (one extra read, once per ended boost ever).
 */
export async function loadFeedPage(
  q: FeedQuery,
  cursor: FeedCursor | null,
  healed = false,
): Promise<FeedPage> {
  const constraints: QueryConstraint[] = [...PUBLIC, where('citySlug', '==', q.citySlug)];
  if (q.genres.length) constraints.push(where('genre', 'in', q.genres));
  const { latest, earliest } = birthMonthBounds(q.ageMin, q.ageMax);
  if (latest) constraints.push(where('birthMonth', '<=', Timestamp.fromDate(latest)));
  if (earliest) constraints.push(where('birthMonth', '>=', Timestamp.fromDate(earliest)));
  constraints.push(orderBy('rank', 'desc'), orderBy('createdAt', 'desc'));
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(FEED_PAGE_SIZE));
  const snap = await getDocs(query(listings(), ...constraints));
  const docs = snap.docs;
  const items = visible(docs);
  if (!healed && (await healBoosts(items, true))) return loadFeedPage(q, cursor, true);
  return {
    items,
    cursor: docs[docs.length - 1] ?? cursor,
    done: docs.length < FEED_PAGE_SIZE,
  };
}

/**
 * Premium rail (owner's decisions of 3 Oct 2026): every promotion of every city, Premium then
 * Sponsored, each group drawn at random. Ended boosts are left out (the feed of their city and the
 * nightly job reset them: resetting here too made both writers collide on the same document).
 * One query (index status, hidden, rank, createdAt), RAIL_MAX documents at most.
 */
export async function loadBanner(now = new Date()): Promise<PublicListing[]> {
  const snap = await getDocs(
    query(
      listings(),
      ...PUBLIC,
      where('rank', '>', 0),
      orderBy('rank', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(RAIL_MAX),
    ),
  );
  return railOf(visible(snap.docs, now), now);
}

/** A shown listing, or null (unknown id, removed, hidden by reports, expired). */
export async function loadListing(id: string): Promise<PublicListing | null> {
  try {
    const snap = await getDoc(doc(db(), 'listings', id));
    const data = snap.data();
    if (!data || data['status'] !== 'active' || data['hidden'] !== false) return null;
    const l = toPublicListing(snap.id, data);
    return l && !isExpired(l) ? l : null;
  } catch (e) {
    // A hidden or removed listing is not readable by visitors: same as « not found ».
    if (errorCode(e) === 'permission-denied') return null;
    throw e;
  }
}

export interface PublicMember {
  uid: string;
  pseudo: string;
  photoUrl: string | null;
  verified: boolean;
  memberSince: Date;
}

/** Public profile and shown listings of a member (null when the profile does not exist). */
export async function loadMember(
  uid: string,
): Promise<{ member: PublicMember; listings: PublicListing[] } | null> {
  const [profile, own] = await Promise.all([
    getDoc(doc(db(), 'publicProfiles', uid)),
    getDocs(query(listings(), ...PUBLIC, where('ownerUid', '==', uid))),
  ]);
  const p = profile.data();
  if (!p) return null;
  const shown = visible(own.docs);
  void healBoosts(shown, false);
  const since = p['memberSince'];
  return {
    member: {
      uid,
      pseudo: typeof p['pseudo'] === 'string' ? p['pseudo'] : '',
      photoUrl: typeof p['photoUrl'] === 'string' ? p['photoUrl'] : null,
      verified: p['verified'] === true,
      memberSince: since instanceof Timestamp ? since.toDate() : new Date(0),
    },
    listings: shown,
  };
}

/** WhatsApp number of a listing: read only when the visitor taps WhatsApp or Appeler. */
export async function loadContact(id: string): Promise<{ whatsapp: string; callAllowed: boolean } | null> {
  const snap = await getDoc(doc(db(), 'listings', id, 'private', 'contact'));
  const d = snap.data();
  if (!d || typeof d['whatsapp'] !== 'string') return null;
  return { whatsapp: d['whatsapp'], callAllowed: d['callAllowed'] === true };
}

/** +1 view (the caller limits it to once per browser and per day). */
export async function countView(id: string): Promise<void> {
  await updateDoc(doc(db(), 'listings', id), { views: increment(1) });
}

/** Demotes a boost whose end has passed (allowed to anyone by the rules). Best effort. */
export async function resetExpiredBoost(id: string): Promise<void> {
  try {
    await updateDoc(doc(db(), 'listings', id), { rank: 0, boostUntil: null });
  } catch {
    // Someone else already did it, or the listing changed: nothing to do.
  }
}

const COUNTS_KEY = 'nx-city-counts';
const COUNTS_TTL_MS = 10 * 60_000;

function cachedCounts(): Record<string, number> | null {
  try {
    const cached = JSON.parse(sessionStorage.getItem(COUNTS_KEY) ?? 'null') as {
      at: number;
      counts: Record<string, number>;
    } | null;
    return cached && Date.now() - cached.at < COUNTS_TTL_MS ? cached.counts : null;
  } catch {
    // No storage or corrupted value: count again.
    return null;
  }
}

/** Shown listings per city, counted when the city picker opens; cached 10 min (ARCHITECTURE § 9). */
export async function loadCityCounts(): Promise<Record<string, number>> {
  const cached = cachedCounts();
  if (cached) return cached;
  const entries = await Promise.all(
    CITIES.map(async (c) => {
      const snap = await getCount(query(listings(), ...PUBLIC, where('citySlug', '==', c.slug)));
      return [c.slug, snap.data().count] as const;
    }),
  );
  const counts = Object.fromEntries(entries);
  try {
    sessionStorage.setItem(COUNTS_KEY, JSON.stringify({ at: Date.now(), counts }));
  } catch {
    // Storage blocked: the counts simply are not cached.
  }
  return counts;
}

/** Listings of one city (« Annonces récentes · N à Douala »): the picker's cached count, or one count. */
export async function loadCityCount(slug: string): Promise<number> {
  const cached = cachedCounts()?.[slug];
  if (cached !== undefined) return cached;
  const snap = await getCount(query(listings(), ...PUBLIC, where('citySlug', '==', slug)));
  return snap.data().count;
}
