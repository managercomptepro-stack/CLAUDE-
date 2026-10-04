/**
 * Pure listing helpers (no Firestore): expiry, state shown in « Mes annonces », free slot.
 * Kept apart from ./listing.ts so pages can use them without loading Firestore.
 */
import { LISTING_LIFETIME_DAYS } from '../data/limits';
import type { ContactMode } from './listing-form';

const DAY_MS = 86_400_000;

/** `closed`: the owner asked for the deletion of the account (frozen until erased). */
export type ListingStatus = 'active' | 'removed' | 'closed';

export interface OwnListing {
  id: string;
  genre: string;
  citySlug: string;
  district: string;
  title: string;
  description: string;
  offer: string;
  photos: string[];
  contactMode: ContactMode;
  rank: number;
  boostUntil: Date | null;
  views: number;
  likes: number;
  hidden: boolean;
  status: ListingStatus;
  removedReason: string | null;
  createdAt: Date;
  renewedAt: Date;
}

/** Expiry = renewedAt + 180 days (ARCHITECTURE § 4, `renewedAt`). */
export function expiresAt(renewedAt: Date): Date {
  return new Date(renewedAt.getTime() + LISTING_LIFETIME_DAYS * DAY_MS);
}

/** Whole days left before expiry (0 when expired). */
export function daysLeft(renewedAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((expiresAt(renewedAt).getTime() - now.getTime()) / DAY_MS));
}

/** Expiry reminder shown in « Mes annonces » this many days before (SPEC § 5). */
export const EXPIRY_REMINDER_DAYS = 7;

export type ListingTone = 'ok' | 'warn' | 'muted' | 'danger';

export interface ListingState {
  /** Main status line. */
  status: 'active' | 'expiring' | 'expired' | 'hidden' | 'removed';
  tone: ListingTone;
  daysLeft: number;
  /** Paid promotion in force, with its end (null = unlimited, granted by an admin). */
  boost: { tier: 'premium' | 'sponsored'; until: Date | null } | null;
  canEdit: boolean;
  canRepublish: boolean;
  /** « Supprimer » (active) or « Effacer » (removed by moderation). */
  canDelete: boolean;
}

/** What « Mes annonces » shows and allows for one listing (mirrors the rules). */
export function listingState(l: OwnListing, now: Date = new Date()): ListingState {
  const left = daysLeft(l.renewedAt, now);
  const boosted = l.rank > 0 && (l.boostUntil === null || l.boostUntil.getTime() > now.getTime());
  const boost = boosted
    ? { tier: l.rank >= 2 ? ('premium' as const) : ('sponsored' as const), until: l.boostUntil }
    : null;
  if (l.status === 'removed') {
    return {
      status: 'removed',
      tone: 'danger',
      daysLeft: left,
      boost: null,
      canEdit: false,
      canRepublish: false,
      canDelete: true,
    };
  }
  if (l.hidden) {
    // Hidden by reports, awaiting a moderator: the rules forbid deleting it meanwhile.
    return {
      status: 'hidden',
      tone: 'muted',
      daysLeft: left,
      boost,
      canEdit: false,
      canRepublish: false,
      canDelete: false,
    };
  }
  const status = left === 0 ? 'expired' : left <= EXPIRY_REMINDER_DAYS ? 'expiring' : 'active';
  return {
    status,
    tone: status === 'active' ? 'ok' : 'warn',
    daysLeft: left,
    boost,
    canEdit: true,
    canRepublish: true,
    canDelete: true,
  };
}

/** First free slot n in 1…max for the id `{uid}_{n}`, or null when every slot is taken. */
export function freeSlot(uid: string, usedIds: readonly string[], max: number): string | null {
  const used = new Set(usedIds);
  for (let n = 1; n <= max; n++) {
    const id = `${uid}_${n}`;
    if (!used.has(id)) return id;
  }
  return null;
}

/** « Votre Premium se termine demain » (SPEC § 7, § 9): shown during the last 24 hours. */
export const BOOST_REMINDER_MS = DAY_MS;

/** Calendar day of `date` relative to `now` (local time), for « aujourd'hui » / « demain ». */
export function dayWord(date: Date, now: Date = new Date()): 'today' | 'tomorrow' | 'later' {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.floor((date.getTime() - start) / DAY_MS);
  return diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : 'later';
}

/** True while a dated boost is in its last 24 hours. */
export function boostEndingSoon(s: ListingState, now: Date = new Date()): boolean {
  if (!s.boost?.until) return false;
  const left = s.boost.until.getTime() - now.getTime();
  return left > 0 && left <= BOOST_REMINDER_MS;
}

export type Reminder =
  | { kind: 'expiry'; listingId: string; title: string; daysLeft: number }
  | { kind: 'boostEnding'; listingId: string; title: string; tier: 'premium' | 'sponsored'; until: Date };

/**
 * Computed reminders (SPEC § 9, never stored): listings expiring within 7 days, boosts ending
 * within 24 hours. Soonest first.
 */
export function listingReminders(listings: readonly OwnListing[], now: Date = new Date()): Reminder[] {
  const out: { at: number; r: Reminder }[] = [];
  for (const l of listings) {
    const s = listingState(l, now);
    // A removed or hidden listing is not shown: nothing to remind.
    if (s.status === 'removed' || s.status === 'hidden') continue;
    if (s.status === 'expiring') {
      out.push({
        at: expiresAt(l.renewedAt).getTime(),
        r: { kind: 'expiry', listingId: l.id, title: l.title, daysLeft: s.daysLeft },
      });
    }
    if (s.boost?.until && boostEndingSoon(s, now)) {
      out.push({
        at: s.boost.until.getTime(),
        r: { kind: 'boostEnding', listingId: l.id, title: l.title, tier: s.boost.tier, until: s.boost.until },
      });
    }
  }
  return out.sort((a, b) => a.at - b.at).map((x) => x.r);
}

/** The account's own cap of active listings (admin › Utilisateurs) when set, else the general one. */
export function capOf(general: number, own: unknown): number {
  return typeof own === 'number' ? own : general;
}
