/**
 * Last first page seen, per feed (city + filters), kept in this browser (owner's decision of
 * 2 Oct 2026, option B): a returning visitor sees it at once while the fresh page loads, then it
 * is replaced. Public listing data only (never a WhatsApp number). Display convenience: any
 * storage problem simply means no cache.
 */
import { isExpired, type PublicListing } from './public-listing';

const KEY = 'nx-feed-cache';
const MAX_AGE_MS = 24 * 3_600_000;
/** Feeds remembered (the most recent ones). */
const MAX_FEEDS = 4;

interface Entry {
  key: string;
  at: number;
  items: PublicListing[];
}

const DATE_FIELDS = ['memberSince', 'birthMonth', 'boostUntil', 'createdAt', 'renewedAt'] as const;

function revive(raw: Record<string, unknown>): PublicListing {
  const out: Record<string, unknown> = { ...raw };
  for (const f of DATE_FIELDS) out[f] = typeof raw[f] === 'string' ? new Date(raw[f]) : null;
  return out as unknown as PublicListing;
}

function readAll(): Entry[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? (v as Entry[]) : [];
  } catch {
    return [];
  }
}

/** Cached first page of this feed (expired listings left out), or null. */
export function readFeedCache(feedKey: string, now = Date.now()): PublicListing[] | null {
  const entry = readAll().find((e) => e.key === feedKey);
  if (!entry || now - entry.at > MAX_AGE_MS || !Array.isArray(entry.items)) return null;
  const items = entry.items
    .map((i) => revive(i as unknown as Record<string, unknown>))
    .filter((l) => !isExpired(l, new Date(now)));
  return items.length ? items : null;
}

export function writeFeedCache(feedKey: string, items: readonly PublicListing[], now = Date.now()): void {
  try {
    const others = readAll().filter((e) => e.key !== feedKey);
    const next = items.length ? [{ key: feedKey, at: now, items }, ...others] : others;
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX_FEEDS)));
  } catch {
    // Storage full or blocked: no cache.
  }
}
