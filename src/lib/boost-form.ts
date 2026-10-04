/**
 * Pure helpers of /booster (SPEC § 7, PLAN phase 6), without Firestore: what can be chosen, what
 * is shown, what is sent. Prices, duration and payees come from `settings/public`, never the code.
 */
import { TEXT_MAX } from '../data/limits';
import type { PayeeSettings, PublicSettings } from '../data/settings';
import { daysLeft, type OwnListing } from './listing-status';

export type BoostTier = 'premium' | 'sponsored';
export type Operator = 'mtn' | 'orange';

export const BOOST_TIERS: readonly BoostTier[] = ['premium', 'sponsored'];
export const OPERATORS: readonly Operator[] = ['mtn', 'orange'];

export interface TierOffer {
  tier: BoostTier;
  price: number;
  days: number;
}

export function tierOffers(settings: PublicSettings): TierOffer[] {
  return BOOST_TIERS.map((tier) => ({ tier, price: settings.prices[tier], days: settings.boostDays[tier] }));
}

/** A payee is usable once the super-admin has entered both its number and its name. */
export function payeeReady(p: PayeeSettings | undefined): p is PayeeSettings {
  return !!p && p.number.trim() !== '' && p.name.trim() !== '';
}

export function availableOperators(settings: PublicSettings): Operator[] {
  return OPERATORS.filter((o) => payeeReady(settings.payment[o]));
}

/**
 * Number to type in the Mobile Money menu: the 9 local digits (« +237 6 77 … » → « 677… »).
 * Anything else is returned as entered, spaces removed.
 */
export function localNumber(number: string): string {
  const digits = number.replace(/[^\d+]/g, '');
  const m = /^(?:\+?237)?(6\d{8})$/.exec(digits);
  return m?.[1] ?? digits;
}

/** « 677 12 34 56 » for reading; the raw entry when it is not a Cameroonian mobile number. */
export function displayNumber(number: string): string {
  const local = localNumber(number);
  return /^6\d{8}$/.test(local)
    ? `${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7)}`
    : number;
}

/** « 2 000 F CFA » (narrow no-break spaces from Intl replaced by plain no-break spaces). */
export function formatAmount(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(amount).replace(/\u202f/g, '\u00a0')}\u00a0F\u00a0CFA`;
}

/** Optional transaction reference: trimmed, empty → null, too long → error. */
export function normalizeTxRef(raw: string): { value: string | null } | { error: 'tooLong' } {
  const v = raw.trim();
  if (v === '') return { value: null };
  if (v.length > TEXT_MAX.txRef) return { error: 'tooLong' };
  return { value: v };
}

export type BoostBlock = 'removed' | 'hidden' | 'expired' | 'unlimited';

/**
 * Why a listing cannot be boosted, or null when it can. Mirrors the rules (active listing) and
 * avoids useless payments (expired, hidden, or already promoted without end date).
 */
export function boostBlock(l: OwnListing, now: Date = new Date()): BoostBlock | null {
  if (l.status === 'removed') return 'removed';
  if (l.hidden) return 'hidden';
  if (daysLeft(l.renewedAt, now) === 0) return 'expired';
  if (l.rank > 0 && l.boostUntil === null) return 'unlimited';
  return null;
}
