import { ADULT_MIN_DAYS } from '../data/limits';
import { fr } from '../i18n/fr';

const DAY_MS = 86_400_000;

/**
 * Normalises a Cameroonian mobile number to the format stored and checked by the rules:
 * « +2376XXXXXXXX ». Accepts « 6 78 80 24 47 », « 678802447 », « +237 678 80 24 47 »,
 * « 00237678802447 »… Returns null for an empty value, false for an invalid one.
 * (From v1 `normaliserWhatsApp`.)
 */
export function normalizeWhatsApp(raw: string | null | undefined): string | null | false {
  let d = String(raw ?? '').replace(/[\s.\-()]/g, '');
  if (!d) return null;
  d = d.replace(/^(\+|00)?237/, '');
  return /^6\d{8}$/.test(d) ? `+237${d}` : false;
}

/**
 * Support number (admin › Réglages, owner's request of 3 Oct 2026): a Cameroonian number in any
 * usual form, or an international one (« +7 900 326-94-15 », « 0079003269415 »).
 */
export function normalizeSupportNumber(raw: string): string | null {
  const cm = normalizeWhatsApp(raw);
  if (cm) return cm;
  const d = raw.replace(/[\s.\-()]/g, '').replace(/^00/, '+');
  return /^\+[1-9]\d{7,14}$/.test(d) ? d : null;
}

/** Readable form of a normalised number: « 6 78 80 24 47 ». */
export function formatWhatsApp(normalized: string): string {
  const d = normalized.replace(/^\+237/, '');
  return /^6\d{8}$/.test(d) ? d.replace(/^(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5') : normalized;
}

/**
 * Completed years between a birth date (stored at UTC midnight) and now, by the calendar: on the
 * birthday the new age shows (a mean-year division showed « 24 ans » on a 25th birthday).
 */
export function ageFrom(birth: Date, now: Date = new Date()): number {
  const years = now.getUTCFullYear() - birth.getUTCFullYear();
  const before =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  return before ? years - 1 : years;
}

/** Same test as the rules: birth date at least ADULT_MIN_DAYS days before now. */
export function isAdult(birth: Date, now: Date = new Date()): boolean {
  return birth.getTime() <= now.getTime() - ADULT_MIN_DAYS * DAY_MS;
}

/** « membre depuis 3 jours / 2 mois / 1 an » from the account creation date. */
export function memberSince(createdAt: Date, now: Date = new Date()): string {
  const days = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / DAY_MS));
  if (days < 1) return fr.memberSince.today;
  if (days < 30) return fr.memberSince.days(days);
  const months = Math.floor(days / 30.436875);
  if (months < 12) return fr.memberSince.months(Math.max(1, months));
  return fr.memberSince.years(Math.floor(days / 365.2425));
}

const DATE_FR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** « 2 avril 2027 ». */
export function formatDate(date: Date): string {
  return DATE_FR.format(date);
}

const TIME_FR = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** « 14:05 ». */
export function formatTime(date: Date): string {
  return TIME_FR.format(date);
}

/** ASCII slug: « Ngaoundéré » → « ngaoundere », « Kousséri » → « kousseri ». */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
