/**
 * Faster opening of a listing from the rail or the feed (owner's request of 4 Oct 2026): on the
 * first touch, the public data already on screen is kept for the listing page (sessionStorage),
 * the page and its main photo are prefetched. The listing page shows this copy at once, then the
 * fresh document replaces it. Public data only (never a WhatsApp number). Display convenience:
 * any storage problem simply means no head start.
 */
import { listingPhotoUrl } from './photo-url';
import type { PublicListing } from './public-listing';

const KEY = 'nx-listing-handoff';
const DATE_FIELDS = ['memberSince', 'birthMonth', 'boostUntil', 'createdAt', 'renewedAt'] as const;
const prefetched = new Set<string>();

function prefetch(href: string, image = false): void {
  if (prefetched.has(href)) return;
  prefetched.add(href);
  // An image warms the HTTP cache through img-src (a <link rel=prefetch> to Cloudinary would be
  // blocked by the CSP's default-src).
  if (image) {
    new Image().src = href;
    return;
  }
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

/** Called on pointerdown / focus of a link to a listing. */
export function prepareListing(l: PublicListing): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    // Storage blocked: the page simply loads normally.
  }
  prefetch('/annonce');
  const photo = l.photos[0] ? listingPhotoUrl(l.photos[0], 960) : null;
  if (photo) prefetch(photo, true);
}

/** The copy kept for this listing id, if any (dates revived). */
export function takeListing(id: string): PublicListing | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Record<string, unknown> | null;
    if (!raw || raw['id'] !== id) return null;
    const out: Record<string, unknown> = { ...raw };
    for (const f of DATE_FIELDS) out[f] = typeof raw[f] === 'string' ? new Date(raw[f]) : null;
    return out as unknown as PublicListing;
  } catch {
    return null;
  }
}
