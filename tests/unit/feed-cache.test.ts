import { beforeEach, describe, expect, it } from 'vitest';
import { readFeedCache, writeFeedCache } from '../../src/lib/feed-cache';
import type { PublicListing } from '../../src/lib/public-listing';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

const NOW = Date.UTC(2026, 9, 2, 12);
const DAY = 86_400_000;

function listing(id: string, renewedDaysAgo = 1): PublicListing {
  const d = new Date(NOW - renewedDaysAgo * DAY);
  return {
    id,
    ownerUid: 'u',
    pseudo: 'P',
    profilePhotoUrl: null,
    verified: false,
    memberSince: d,
    birthMonth: new Date(Date.UTC(2000, 0, 1)),
    genre: 'femme',
    citySlug: 'douala',
    district: 'Akwa',
    title: 'T',
    description: 'D',
    offer: '',
    photos: ['a:1x1'],
    callAllowed: false,
    rank: 2,
    boostUntil: null,
    views: 1,
    likes: 0,
    createdAt: d,
    renewedAt: d,
  };
}

describe('last first page seen (option B)', () => {
  beforeEach(() => store.clear());

  it('gives back the page with real Dates', () => {
    writeFeedCache('douala|', [listing('a'), listing('b')], NOW);
    const back = readFeedCache('douala|', NOW + 1000);
    expect(back?.map((l) => l.id)).toEqual(['a', 'b']);
    expect(back?.[0]?.createdAt).toBeInstanceOf(Date);
    expect(back?.[0]?.boostUntil).toBeNull();
    expect(readFeedCache('kribi|', NOW)).toBeNull();
  });

  it('forgets after 24 h and skips listings that expired meanwhile', () => {
    writeFeedCache('douala|', [listing('fresh'), listing('old', 179.9)], NOW);
    expect(readFeedCache('douala|', NOW + DAY + 1)).toBeNull();
    expect(readFeedCache('douala|', NOW + 0.5 * DAY)?.map((l) => l.id)).toEqual(['fresh']);
  });

  it('keeps the 4 most recent feeds and survives a corrupted value', () => {
    for (const c of ['a', 'b', 'c', 'd', 'e']) writeFeedCache(c, [listing(c)], NOW);
    expect(readFeedCache('a', NOW)).toBeNull();
    expect(readFeedCache('e', NOW)?.[0]?.id).toBe('e');
    store.set('nx-feed-cache', '{oops');
    expect(readFeedCache('e', NOW)).toBeNull();
  });
});
