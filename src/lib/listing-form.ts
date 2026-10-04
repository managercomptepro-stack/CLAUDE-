/**
 * Listing form validation (SPEC § 5): same limits and patterns as firestore.rules, which remain
 * the real barrier. Also the photo reference helpers (`<publicId>:<width>x<height>`).
 */
import { cityBySlug } from '../data/cities';
import { isGenre, type Genre } from '../data/genres';
import { PHOTOS_MAX, PHOTOS_MIN, TEXT_MAX, TEXT_MIN } from '../data/limits';
import { findTextProblem } from '../data/moderation';
import { fr } from '../i18n/fr';
import { normalizeWhatsApp } from './format';
import { PHOTO_REF_RE } from './photo-url';
import type { FieldErrors, Validation } from './profile-form';

export { listingPhotoUrl, parsePhotoRef, photoRef, type PhotoSize } from './photo-url';

export const CONTACT_MODES = ['message', 'call_message'] as const;
export type ContactMode = (typeof CONTACT_MODES)[number];

export interface ListingInput {
  genre: string;
  citySlug: string;
  district: string;
  title: string;
  description: string;
  offer: string;
  /** Photo references, the first one is the main photo. */
  photos: string[];
  whatsapp: string;
  contactMode: string;
}

export interface ListingValues {
  genre: Genre;
  citySlug: string;
  district: string;
  title: string;
  description: string;
  offer: string;
  photos: string[];
  whatsapp: string;
  contactMode: ContactMode;
}

export type ListingField = keyof ListingInput;

/** Free texts checked by the rules (length + forbidden terms, prices, contact details). */
export const LISTING_TEXTS = ['district', 'title', 'description', 'offer'] as const;
export type ListingText = (typeof LISTING_TEXTS)[number];

export function textError(field: ListingText, raw: string): string | null {
  const text = raw.trim();
  const min = TEXT_MIN[field];
  const max = TEXT_MAX[field];
  if (text.length < min || text.length > max) {
    return min === 0 ? fr.listingForm.tooLong(max) : fr.listingForm.length(min, max);
  }
  const problem = text ? findTextProblem(text) : null;
  return problem ? fr.textProblems[problem] : null;
}

export function validateListing(input: ListingInput): Validation<ListingValues, ListingField> {
  const errors: FieldErrors<ListingField> = {};
  if (!isGenre(input.genre)) errors.genre = fr.form.genreRequired;
  if (!cityBySlug(input.citySlug)) errors.citySlug = fr.form.cityRequired;
  for (const field of LISTING_TEXTS) {
    const e = textError(field, input[field]);
    if (e) errors[field] = e;
  }
  if (input.photos.length < PHOTOS_MIN || input.photos.length > PHOTOS_MAX) {
    errors.photos = fr.listingForm.photosCount(PHOTOS_MIN, PHOTOS_MAX);
  } else if (!input.photos.every((p) => PHOTO_REF_RE.test(p))) {
    errors.photos = fr.errors.uploadFailed;
  }
  const whatsapp = normalizeWhatsApp(input.whatsapp);
  if (!whatsapp) errors.whatsapp = fr.form.whatsappInvalid;
  const contactMode = CONTACT_MODES.find((m) => m === input.contactMode);
  if (!contactMode) errors.contactMode = fr.listingForm.contactModeRequired;

  if (Object.keys(errors).length || !whatsapp || !contactMode || !isGenre(input.genre)) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      genre: input.genre,
      citySlug: input.citySlug,
      district: input.district.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
      offer: input.offer.trim(),
      photos: [...input.photos],
      whatsapp,
      contactMode,
    },
  };
}

/** Moves the photo at `from` to `to` (reordering; index 0 is the main photo). */
export function movePhoto(photos: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= photos.length || to >= photos.length) return [...photos];
  const next = [...photos];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}
