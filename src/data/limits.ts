/**
 * Shared limits. The values used by firestore.rules are injected into it by
 * `npm run rules:sync` (scripts/rules-shared.ts); tests/unit/rules-sync.test.ts checks they match.
 */

/**
 * Majority threshold in days. 18 years are 6574 or 6575 days depending on leap years crossed;
 * the upper bound is kept so a minor is never accepted (v1, archives/v1/js/config.js).
 */
export const ADULT_MIN_DAYS = 6575;

export const TEXT_MIN = {
  pseudo: 3,
  title: 3,
  description: 10,
  offer: 0,
  district: 2,
} as const;

export const TEXT_MAX = {
  pseudo: 20,
  title: 60,
  description: 1000,
  offer: 300,
  district: 40,
  reportNote: 300,
  reason: 300,
  txRef: 60,
} as const;

/** Lower-cased pseudo, also used as the `usernames/{pseudoLower}` document id. */
export const PSEUDO_PATTERN = '^[a-z0-9][a-z0-9_.-]{2,19}$';
/** Pseudos containing these fragments are refused (impersonation of the site or its team). */
export const RESERVED_PSEUDO_FRAGMENTS = [
  'nioxxer',
  'admin',
  'moderat',
  'support',
  'officiel',
  'staff',
  'equipe',
] as const;

export function isReservedPseudo(pseudo: string): boolean {
  const p = pseudo.toLowerCase();
  return RESERVED_PSEUDO_FRAGMENTS.some((f) => p.includes(f));
}

/** Cloudinary cloud of NIOXXER (owner, 2 Oct 2026): only its images are accepted. */
export const CLOUDINARY_CLOUD_NAME = 'bcxiwwkh';

/**
 * Cloudinary public id. The account uses dynamic folders: the preset files the image in
 * `listings` / `avatars` (asset folder) but the public id itself is random, without a folder
 * prefix (proved by a real upload, 2 Oct 2026).
 */
export const CLOUDINARY_PUBLIC_ID = '[A-Za-z0-9_-]{1,100}';

/**
 * Profile photo URL = the `secure_url` returned by the upload (version + public id, no
 * transformation). Transformations are added at display time only: an URL carrying its own
 * transformations could, for instance, overlay any text on the photo.
 */
export const AVATAR_URL_PATTERN = `^https://res[.]cloudinary[.]com/${CLOUDINARY_CLOUD_NAME}/image/upload/v[0-9]{1,12}/${CLOUDINARY_PUBLIC_ID}[.](jpg|jpeg|png|webp|heic)$`;

/** Normalised Cameroonian mobile number (see normalizeWhatsApp). */
export const WHATSAPP_PATTERN = '^[+]2376[0-9]{8}$';

/** Listings a single account may be allowed by the super-admin (admin › Utilisateurs). */
export const ACCOUNT_CAP_MAX = 50;

/** Support number (admin › Réglages): any international number, e.g. « +79003269415 ». */
export const SUPPORT_WHATSAPP_PATTERN = '^[+][1-9][0-9]{7,14}$';

/** Listings removed for an infraction before publishing is blocked (SPEC § 10). */
export const STRIKES_BAN_THRESHOLD = 5;

/**
 * A listing photo is stored as one compact string « <publicId>:<width>x<height> » (Cloudinary
 * public id + intrinsic size), so the rules can check the whole list with a single regex (they
 * stop after 1000 evaluated expressions).
 */
export const PHOTO_REF = `${CLOUDINARY_PUBLIC_ID}:[1-9][0-9]{0,3}x[1-9][0-9]{0,3}`;

export const PHOTOS_MIN = 1;
export const PHOTOS_MAX = 5;
/** A listing expires LISTING_LIFETIME_DAYS after `renewedAt` (creation or last republication). */
export const LISTING_LIFETIME_DAYS = 180;

/** A deletion request is carried out by the nightly job at the latest this long after it was made. */
export const ACCOUNT_PURGE_DAYS = 60;
export const FEED_PAGE_SIZE = 20;
export const AGE_FILTER_MIN = 18;
export const AGE_FILTER_MAX = 70;

/**
 * Payment screenshots and ID photos are stored as JPEG data URLs in Firestore (≤ 300 KB of JPEG,
 * i.e. ≤ 400 000 base64 characters, plus the « data:image/jpeg;base64, » prefix).
 */
export const DATA_URL_MAX_CHARS = 410_000;
