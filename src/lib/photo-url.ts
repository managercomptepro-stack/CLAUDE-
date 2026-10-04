/**
 * Listing photo references (`<publicId>:<width>x<height>`, ARCHITECTURE § 4) and their delivery
 * URLs. Kept apart from ./listing-form.ts so the public pages do not load the moderation lists.
 */
import { CLOUDINARY_CLOUD_NAME, PHOTO_REF } from '../data/limits';

export const PHOTO_REF_RE = new RegExp(`^${PHOTO_REF}$`);

export function photoRef(publicId: string, width: number, height: number): string {
  return `${publicId}:${width}x${height}`;
}

export function parsePhotoRef(ref: string): { publicId: string; width: number; height: number } | null {
  if (!PHOTO_REF_RE.test(ref)) return null;
  const [publicId = '', size = ''] = ref.split(':');
  const [w, h] = size.split('x').map(Number);
  return { publicId, width: w ?? 0, height: h ?? 0 };
}

/** Exactly two derived sizes (ARCHITECTURE § 6): feed 360 px, detail 960 px. */
export type PhotoSize = 360 | 960;

export function listingPhotoUrl(ref: string, size: PhotoSize): string | null {
  const p = parsePhotoRef(ref);
  if (!p) return null;
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_${size}/${p.publicId}`;
}
