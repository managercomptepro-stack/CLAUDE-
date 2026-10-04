import { Timestamp } from 'firebase/firestore/lite';
import { describe, expect, it } from 'vitest';
import { listingPhotoUrl } from '../../src/lib/photo-url';
import {
  ageFromBirthMonth,
  birthMonthBounds,
  compareFeed,
  dayKey,
  defaultFilters,
  filtersFromSearch,
  filtersToSearch,
  hasExpiredBoost,
  isExpired,
  markView,
  keepOrder,
  railOf,
  shuffled,
  RAIL_MAX,
  promotion,
  telUrl,
  toPublicListing,
  whatsappUrl,
  type PublicListing,
} from '../../src/lib/public-listing';

const NOW = new Date(Date.UTC(2026, 9, 2, 12)); // 2 Oct 2026
const DAY = 86_400_000;
const ts = (d: Date) => Timestamp.fromDate(d);

function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownerUid: 'alice',
    pseudo: 'Alice',
    profilePhotoUrl: null,
    verified: false,
    memberSince: ts(new Date(Date.UTC(2026, 0, 1))),
    birthMonth: ts(new Date(Date.UTC(2000, 4, 1))),
    genre: 'femme',
    citySlug: 'douala',
    district: 'Akwa',
    title: 'Bonjour',
    description: 'Une description assez longue.',
    offer: '',
    photos: ['abc:1600x1200'],
    contactMode: 'message',
    rank: 0,
    boostUntil: null,
    views: 3,
    likes: 1,
    createdAt: ts(NOW),
    renewedAt: ts(NOW),
    ...overrides,
  };
}

function listing(overrides: Record<string, unknown> = {}, id = 'alice_1'): PublicListing {
  const l = toPublicListing(id, raw(overrides));
  if (!l) throw new Error('fixture');
  return l;
}

describe('toPublicListing', () => {
  it('reads a stored listing with Timestamps', () => {
    const l = listing({ contactMode: 'call_message', verified: true });
    expect(l.birthMonth.toISOString()).toBe('2000-05-01T00:00:00.000Z');
    expect(l.callAllowed).toBe(true);
    expect(l.verified).toBe(true);
    expect(l.photos).toEqual(['abc:1600x1200']);
  });

  it('refuses a malformed document instead of showing it half-filled', () => {
    expect(toPublicListing('x', raw({ genre: 'robot' }))).toBeNull();
    expect(toPublicListing('x', raw({ photos: [] }))).toBeNull();
    expect(toPublicListing('x', raw({ createdAt: 'hier' }))).toBeNull();
    expect(toPublicListing('x', raw({ birthMonth: null }))).toBeNull();
  });
});

describe('promotion', () => {
  it('premium / sponsored while in force, none after the end', () => {
    const future = ts(new Date(NOW.getTime() + DAY));
    const past = ts(new Date(NOW.getTime() - 1));
    expect(promotion(listing({ rank: 2, boostUntil: future }), NOW)).toBe('premium');
    expect(promotion(listing({ rank: 1, boostUntil: future }), NOW)).toBe('sponsored');
    expect(promotion(listing({ rank: 2, boostUntil: null }), NOW)).toBe('premium'); // unlimited (admin)
    expect(promotion(listing({ rank: 2, boostUntil: past }), NOW)).toBeNull();
    expect(promotion(listing({ rank: 0 }), NOW)).toBeNull();
    expect(hasExpiredBoost(listing({ rank: 1, boostUntil: past }), NOW)).toBe(true);
    expect(hasExpiredBoost(listing({ rank: 1, boostUntil: null }), NOW)).toBe(false);
    expect(hasExpiredBoost(listing({ rank: 0, boostUntil: past }), NOW)).toBe(false);
  });

  it('expires 180 days after renewedAt', () => {
    expect(isExpired(listing({ renewedAt: ts(new Date(NOW.getTime() - 179 * DAY)) }), NOW)).toBe(false);
    expect(isExpired(listing({ renewedAt: ts(new Date(NOW.getTime() - 181 * DAY)) }), NOW)).toBe(true);
  });

  it('orders Premium > Sponsored > free, newest first in each group', () => {
    const future = ts(new Date(NOW.getTime() + DAY));
    const at = (h: number) => ts(new Date(NOW.getTime() - h * 3_600_000));
    const items = [
      listing({ rank: 0, createdAt: at(1) }, 'free-new'),
      listing({ rank: 1, boostUntil: future, createdAt: at(5) }, 'spon-old'),
      listing({ rank: 2, boostUntil: future, createdAt: at(9) }, 'prem-old'),
      listing({ rank: 0, createdAt: at(8) }, 'free-old'),
      listing({ rank: 2, boostUntil: future, createdAt: at(2) }, 'prem-new'),
      listing({ rank: 1, boostUntil: future, createdAt: at(3) }, 'spon-new'),
      listing({ rank: 2, boostUntil: ts(NOW), createdAt: at(0) }, 'prem-ended'),
    ];
    expect(items.sort((a, b) => compareFeed(a, b, NOW)).map((l) => l.id)).toEqual([
      'prem-new',
      'prem-old',
      'spon-new',
      'spon-old',
      'prem-ended',
      'free-new',
      'free-old',
    ]);
  });
});

describe('Premium rail', () => {
  const future = ts(new Date(NOW.getTime() + DAY));
  it('takes the promotions in force: Premium first, then Sponsored, 100 at most', () => {
    const page = [
      listing({ rank: 1, boostUntil: future }, 's1'),
      listing({ rank: 2, boostUntil: future }, 'p1'),
      listing({ rank: 2, boostUntil: ts(new Date(NOW.getTime() - 1)) }, 'ended'),
      listing({}, 'free'),
      listing({ rank: 2, boostUntil: null }, 'p2'),
      listing({ rank: 1, boostUntil: future }, 's2'),
    ];
    const ids = railOf(page, NOW).map((l) => l.id);
    expect(ids.slice(0, 2).sort()).toEqual(['p1', 'p2']);
    expect(ids.slice(2).sort()).toEqual(['s1', 's2']);
    expect(railOf([listing({}, 'free')], NOW)).toEqual([]);
    const many = Array.from({ length: 140 }, (_, i) => listing({ rank: 1, boostUntil: future }, `s${i}`));
    expect(railOf(many, NOW)).toHaveLength(RAIL_MAX);
    expect(RAIL_MAX).toBe(100);
  });

  it('draws each group at random: every listing can come first', () => {
    const page = ['a', 'b', 'c', 'd'].map((id) => listing({ rank: 2, boostUntil: future }, id));
    const firsts = new Set<string>();
    for (let i = 0; i < 200; i++) firsts.add(railOf(page, NOW)[0]?.id ?? '');
    expect([...firsts].sort()).toEqual(['a', 'b', 'c', 'd']);
    // Deterministic with a fixed draw: 0 always swaps with the first slot.
    expect(shuffled([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
    expect(shuffled([1, 2, 3], () => 0.99)).toEqual([1, 2, 3]);
  });

  it('keeps the order on screen when the fresh rail holds the same listings', () => {
    const [a, b, c] = ['a', 'b', 'c'].map((id) => listing({ rank: 2, boostUntil: future }, id)) as [
      PublicListing,
      PublicListing,
      PublicListing,
    ];
    expect(keepOrder([b, a], [a, b]).map((l) => l.id)).toEqual(['b', 'a']);
    expect(keepOrder([b, a], [a, c]).map((l) => l.id)).toEqual(['a', 'c']);
    expect(keepOrder([], [a]).map((l) => l.id)).toEqual(['a']);
  });
});

describe('age to the month', () => {
  it('counts the birthday from the 1st of the birth month', () => {
    expect(ageFromBirthMonth(new Date(Date.UTC(2000, 9, 1)), NOW)).toBe(26); // October: birthday reached
    expect(ageFromBirthMonth(new Date(Date.UTC(2000, 10, 1)), NOW)).toBe(25); // November: not yet
    expect(ageFromBirthMonth(new Date(Date.UTC(2008, 9, 1)), NOW)).toBe(18);
  });

  it('birthMonth bounds give exactly the ages of the range', () => {
    const { latest, earliest } = birthMonthBounds(25, 30, NOW);
    expect(latest?.toISOString()).toBe('2001-10-01T00:00:00.000Z');
    expect(earliest?.toISOString()).toBe('1995-11-01T00:00:00.000Z');
    // Every month from 1990 to 2008: inside the bounds ⇔ age in 25…30.
    for (let y = 1990; y <= 2008; y++) {
      for (let m = 0; m < 12; m++) {
        const b = new Date(Date.UTC(y, m, 1));
        const inside = b.getTime() <= (latest?.getTime() ?? 0) && b.getTime() >= (earliest?.getTime() ?? 0);
        const age = ageFromBirthMonth(b, NOW);
        expect(inside, `${y}-${m + 1}`).toBe(age >= 25 && age <= 30);
      }
    }
  });

  it('18 and 70 at the ends of the slider mean no bound', () => {
    expect(birthMonthBounds(18, 70, NOW)).toEqual({ latest: null, earliest: null });
    expect(birthMonthBounds(18, 40, NOW).latest).toBeNull();
    expect(birthMonthBounds(30, 70, NOW).earliest).toBeNull();
  });

  it('bounds survive a December « now » (month 12 rolls over)', () => {
    const dec = new Date(Date.UTC(2026, 11, 15));
    expect(birthMonthBounds(20, 30, dec).earliest?.toISOString()).toBe('1996-01-01T00:00:00.000Z');
  });
});

describe('search filters ⇄ address', () => {
  it('round-trips and keeps the closed list order', () => {
    const f = filtersFromSearch(
      new URLSearchParams('ville=yaounde&profil=couple,femme,robot,femme&age=35-22'),
      'douala',
    );
    expect(f).toEqual({ citySlug: 'yaounde', genres: ['femme', 'couple'], ageMin: 22, ageMax: 35 });
    expect(filtersToSearch(f)).toBe('?ville=yaounde&profil=femme,couple&age=22-35');
  });

  it('falls back on the remembered city and the full age range', () => {
    expect(filtersFromSearch(new URLSearchParams('ville=paris&age=5-99'), 'kribi')).toEqual({
      ...defaultFilters('kribi'),
      ageMin: 18,
      ageMax: 70,
    });
    expect(filtersToSearch(defaultFilters('douala'))).toBe('?ville=douala');
  });
});

describe('contact links', () => {
  it('wa.me link with the prefilled message, encoded', () => {
    const url = whatsappUrl('+237678802447', 'Belle & douce ?');
    expect(url.startsWith('https://wa.me/237678802447?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1] ?? '')).toBe(
      'Bonjour, je vous contacte depuis NIOXXER au sujet de votre annonce « Belle & douce ? ».',
    );
    expect(telUrl('+237678802447')).toBe('tel:+237678802447');
  });
});

describe('one view per day', () => {
  it('counts once a day and forgets older days', () => {
    const first = markView({ old: '2026-09-30' }, 'a_1', '2026-10-02');
    expect(first).toEqual({ a_1: '2026-10-02' });
    expect(markView(first ?? {}, 'a_1', '2026-10-02')).toBeNull();
    expect(markView(first ?? {}, 'a_1', '2026-10-03')).toEqual({ a_1: '2026-10-03' });
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('photos', () => {
  it('feed photos use the 360 px variant', () => {
    expect(listingPhotoUrl('abc:1600x1200', 360)).toBe(
      'https://res.cloudinary.com/bcxiwwkh/image/upload/f_auto,q_auto,w_360/abc',
    );
  });
});
