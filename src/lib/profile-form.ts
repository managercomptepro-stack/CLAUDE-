/**
 * Validation of the sign-up form (SPEC § 4). Same thresholds and patterns as firestore.rules,
 * which remain the real barrier: this only gives clear messages before sending.
 */
import { cityBySlug } from '../data/cities';
import { isGenre, type Genre } from '../data/genres';
import { isReservedPseudo, PSEUDO_PATTERN, TEXT_MAX, TEXT_MIN } from '../data/limits';
import { findTextProblem } from '../data/moderation';
import { fr } from '../i18n/fr';
import { isAvatarUrl } from './cloudinary';
import { isAdult, normalizeWhatsApp } from './format';

export interface ProfileInput {
  pseudo: string;
  /** Value of <input type="date">: « YYYY-MM-DD ». */
  birthDate: string;
  genre: string;
  city: string;
  whatsapp: string;
  /** Optional profile photo: `secure_url` of the avatar upload, or null. */
  photoUrl: string | null;
  terms: boolean;
}

export interface ProfileValues {
  pseudo: string;
  pseudoLower: string;
  /** Midnight UTC of the birth day. */
  birthDate: Date;
  genre: Genre;
  city: string;
  whatsapp: string;
  photoUrl: string | null;
}

export type ProfileField = keyof ProfileInput;
export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export type Validation<V, F extends string> = { ok: true; value: V } | { ok: false; errors: FieldErrors<F> };

const PSEUDO_RE = new RegExp(PSEUDO_PATTERN);
export const PASSWORD_MIN = 8;

/** « YYYY-MM-DD » → midnight UTC, or null if it is not a real calendar date. */
export function parseBirthDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return y >= 1900 ? date : null;
}

export function pseudoError(raw: string): string | null {
  const pseudo = raw.trim();
  if (pseudo.length < TEXT_MIN.pseudo || pseudo.length > TEXT_MAX.pseudo) return fr.form.pseudoLength;
  if (!PSEUDO_RE.test(pseudo.toLowerCase())) return fr.form.pseudoChars;
  if (isReservedPseudo(pseudo)) return fr.form.pseudoReserved;
  const problem = findTextProblem(pseudo);
  return problem ? fr.textProblems[problem] : null;
}

export function validateProfile(
  input: ProfileInput,
  now: Date = new Date(),
): Validation<ProfileValues, ProfileField> {
  const errors: FieldErrors<ProfileField> = {};
  const pseudo = input.pseudo.trim();
  const pErr = pseudoError(pseudo);
  if (pErr) errors.pseudo = pErr;

  const birth = parseBirthDate(input.birthDate);
  if (!birth || birth.getTime() > now.getTime()) errors.birthDate = fr.form.birthInvalid;
  else if (!isAdult(birth, now)) errors.birthDate = fr.form.birthMinor;

  if (!isGenre(input.genre)) errors.genre = fr.form.genreRequired;
  if (!cityBySlug(input.city)) errors.city = fr.form.cityRequired;

  const whatsapp = normalizeWhatsApp(input.whatsapp);
  if (!whatsapp) errors.whatsapp = fr.form.whatsappInvalid;

  if (input.photoUrl !== null && !isAvatarUrl(input.photoUrl)) errors.photoUrl = fr.errors.uploadFailed;

  if (!input.terms) errors.terms = fr.form.termsRequired;

  if (Object.keys(errors).length || !birth || !whatsapp || !isGenre(input.genre))
    return { ok: false, errors };
  return {
    ok: true,
    value: {
      pseudo,
      pseudoLower: pseudo.toLowerCase(),
      birthDate: birth,
      genre: input.genre,
      city: input.city,
      whatsapp,
      photoUrl: input.photoUrl,
    },
  };
}

export interface ContactInput {
  city: string;
  whatsapp: string;
}

/** City + WhatsApp edited in « Mon compte ». */
export function validateContact(
  input: ContactInput,
): Validation<{ city: string; whatsapp: string }, keyof ContactInput> {
  const errors: FieldErrors<keyof ContactInput> = {};
  if (!cityBySlug(input.city)) errors.city = fr.form.cityRequired;
  const whatsapp = normalizeWhatsApp(input.whatsapp);
  if (!whatsapp) errors.whatsapp = fr.form.whatsappInvalid;
  if (!whatsapp || Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { city: input.city, whatsapp } };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailError(email: string): string | null {
  return EMAIL_RE.test(email.trim()) ? null : fr.errors.invalidEmail;
}

export function newPasswordError(password: string): string | null {
  return password.length >= PASSWORD_MIN ? null : fr.form.passwordShort(PASSWORD_MIN);
}
