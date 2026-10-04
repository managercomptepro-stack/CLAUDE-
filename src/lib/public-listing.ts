/**
 * Public side of a listing, without Firestore (unit-tested): document → card data, age to the
 * month (decision 7), paid promotion in force, expiry, age filter bounds on `birthMonth`, search
 * filters ⇄ address, WhatsApp link, « one view per day » marker.
 */
import { cityBySlug, DEFAULT_CITY_SLUG } from '../data/cities';
import { GENRES, isGenre, type Genre } from '../data/genres';
import { AGE_FILTER_MAX, AGE_FILTER_MIN } from '../data/limits';
import { fr } from '../i18n/fr';
import { expiresAt } from './listing-status';

export type Promotion = 'premium' | 'sponsored';

export interface PublicListing {
  id: string;
  ownerUid: string;
  pseudo: string;
  profilePhotoUrl: string | null;
  verified: boolean;
  memberSince: Date;
  birthMonth: Date;
  genre: Genre;
  citySlug: string;
  district: string;
  title: string;
  description: string;
  offer: string;
  photos: string[];
  callAllowed: boolean;
  rank: number;
  boostUntil: Date | null;
  views: number;
  likes: number;
  createdAt: Date;
  renewedAt: Date;
}

/** Firestore Timestamp (or anything with toDate()) → Date. */
function asDate(v: unknown): Date | null {
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof v.toDate === 'function') {
    const d: unknown = v.toDate();
    return d instanceof Date ? d : null;
  }
  return null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** A public listing document, or null when it is malformed (never shown half-filled). */
export function toPublicListing(id: string, d: Record<string, unknown>): PublicListing | null {
  const birthMonth = asDate(d['birthMonth']);
  const createdAt = asDate(d['createdAt']);
  const renewedAt = asDate(d['renewedAt']);
  const genre = str(d['genre']);
  const photos = Array.isArray(d['photos']) ? d['photos'].filter((p) => typeof p === 'string') : [];
  if (!birthMonth || !createdAt || !renewedAt || !isGenre(genre) || !photos.length) return null;
  return {
    id,
    ownerUid: str(d['ownerUid']),
    pseudo: str(d['pseudo']),
    profilePhotoUrl: typeof d['profilePhotoUrl'] === 'string' ? d['profilePhotoUrl'] : null,
    verified: d['verified'] === true,
    memberSince: asDate(d['memberSince']) ?? createdAt,
    birthMonth,
    genre,
    citySlug: str(d['citySlug']),
    district: str(d['district']),
    title: str(d['title']),
    description: str(d['description']),
    offer: str(d['offer']),
    photos,
    callAllowed: d['contactMode'] === 'call_message',
    rank: num(d['rank']),
    boostUntil: asDate(d['boostUntil']),
    views: num(d['views']),
    likes: num(d['likes']),
    createdAt,
    renewedAt,
  };
}

/** Paid promotion in force (null boostUntil with rank > 0 = unlimited, granted by an admin). */
export function promotion(l: Pick<PublicListing, 'rank' | 'boostUntil'>, now = new Date()): Promotion | null {
  if (l.rank <= 0) return null;
  if (l.boostUntil && l.boostUntil.getTime() <= now.getTime()) return null;
  return l.rank >= 2 ? 'premium' : 'sponsored';
}

/** A boost whose end has passed but is still stored: anyone may reset it (owner's decision 2). */
export function hasExpiredBoost(l: Pick<PublicListing, 'rank' | 'boostUntil'>, now = new Date()): boolean {
  return l.rank > 0 && l.boostUntil !== null && l.boostUntil.getTime() <= now.getTime();
}

/** Older than 6 months and not yet removed by the maintenance job: never shown. */
export function isExpired(l: Pick<PublicListing, 'renewedAt'>, now = new Date()): boolean {
  return expiresAt(l.renewedAt).getTime() < now.getTime();
}

/** Age shown, counted from the 1st of the birth month (UTC), the only date made public. */
export function ageFromBirthMonth(birthMonth: Date, now = new Date()): number {
  const before = now.getUTCMonth() < birthMonth.getUTCMonth() ? 1 : 0;
  return now.getUTCFullYear() - birthMonth.getUTCFullYear() - before;
}

/**
 * `birthMonth` range matching ages min…max with the formula above. 18 (everyone) and 70 (« 70
 * et + ») at the ends of the slider mean « no bound ».
 */
export function birthMonthBounds(
  min: number,
  max: number,
  now = new Date(),
): { latest: Date | null; earliest: Date | null } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    latest: min > AGE_FILTER_MIN ? new Date(Date.UTC(y - min, m, 1)) : null,
    earliest: max < AGE_FILTER_MAX ? new Date(Date.UTC(y - max - 1, m + 1, 1)) : null,
  };
}

/** Order of the feed: Premium, Sponsored, free; newest first in each group. */
export function compareFeed(a: PublicListing, b: PublicListing, now = new Date()): number {
  const weight = (l: PublicListing) => {
    const p = promotion(l, now);
    return p === 'premium' ? 2 : p === 'sponsored' ? 1 : 0;
  };
  return weight(b) - weight(a) || b.createdAt.getTime() - a.createdAt.getTime();
}

/**
 * Premium rail (SPEC § 6, owner's decisions of 3 Oct 2026): every promotion in force in every city
 * (read at most RAIL_MAX, a quota guard), Premium first, then Sponsored, each group drawn at random
 * on every page load (« tombola ») so that no paid listing is always first.
 */
export const RAIL_MAX = 100;

/** Fisher–Yates on a copy; `random` returns [0, 1) like Math.random. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function railOf(
  items: readonly PublicListing[],
  now = new Date(),
  random: () => number = Math.random,
): PublicListing[] {
  const premium = items.filter((l) => promotion(l, now) === 'premium');
  const sponsored = items.filter((l) => promotion(l, now) === 'sponsored');
  return [...shuffled(premium, random), ...shuffled(sponsored, random)].slice(0, RAIL_MAX);
}

/**
 * Keeps the order already on screen when a fresh answer holds the same listings (cached rail →
 * fresh rail): the plates do not jump. Otherwise the fresh order.
 */
export function keepOrder(shown: readonly PublicListing[], fresh: readonly PublicListing[]): PublicListing[] {
  const byId = new Map(fresh.map((l) => [l.id, l]));
  if (shown.length !== fresh.length || shown.some((l) => !byId.has(l.id))) return [...fresh];
  return shown.map((l) => byId.get(l.id) as PublicListing);
}

// ── Search filters ⇄ address (/recherche?ville=douala&profil=femme,couple&age=20-35) ──

export interface FeedFilters {
  citySlug: string;
  genres: Genre[];
  ageMin: number;
  ageMax: number;
}

export function defaultFilters(citySlug = DEFAULT_CITY_SLUG): FeedFilters {
  return { citySlug, genres: [], ageMin: AGE_FILTER_MIN, ageMax: AGE_FILTER_MAX };
}

function clampAge(n: number): number {
  return Math.min(AGE_FILTER_MAX, Math.max(AGE_FILTER_MIN, Math.round(n)));
}

export function filtersFromSearch(params: URLSearchParams, fallbackCity: string): FeedFilters {
  const city = params.get('ville') ?? '';
  const genres = (params.get('profil') ?? '').split(',').filter(isGenre);
  const [a, b] = (params.get('age') ?? '').split('-').map(Number);
  let ageMin = Number.isFinite(a) && a ? clampAge(a) : AGE_FILTER_MIN;
  let ageMax = Number.isFinite(b) && b ? clampAge(b) : AGE_FILTER_MAX;
  if (ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
  return {
    citySlug: cityBySlug(city) ? city : fallbackCity,
    // Closed list order, without duplicates.
    genres: GENRES.filter((g) => genres.includes(g)),
    ageMin,
    ageMax,
  };
}

export function filtersToSearch(f: FeedFilters): string {
  const p = new URLSearchParams({ ville: f.citySlug });
  if (f.genres.length) p.set('profil', f.genres.join(','));
  if (f.ageMin > AGE_FILTER_MIN || f.ageMax < AGE_FILTER_MAX) p.set('age', `${f.ageMin}-${f.ageMax}`);
  return `?${p.toString().replace(/%2C/g, ',')}`;
}

// ── Contact ──

/** wa.me link with the message of SPEC § 5 (number « +2376XXXXXXXX » → digits only). */
export function whatsappUrl(whatsapp: string, title: string): string {
  return `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(fr.listing.whatsappMessage(title))}`;
}

export function telUrl(whatsapp: string): string {
  return `tel:${whatsapp.replace(/[^\d+]/g, '')}`;
}

// ── One view per listing, per browser and per day (ARCHITECTURE § 9) ──

export type ViewMarks = Record<string, string>;

/** Local calendar day « YYYY-MM-DD ». */
export function dayKey(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Marks of today only (older days are dropped) with `id` added, or null if already counted today. */
export function markView(marks: ViewMarks, id: string, today: string): ViewMarks | null {
  if (marks[id] === today) return null;
  const kept = Object.fromEntries(Object.entries(marks).filter(([, day]) => day === today));
  return { ...kept, [id]: today };
}
