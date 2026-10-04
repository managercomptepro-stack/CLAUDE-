import { describe, expect, it } from 'vitest';
import { DATA_URL_MAX_CHARS, TEXT_MAX } from '../../src/data/limits';
import { DEMO_SETTINGS, normalizeSettings, type PublicSettings } from '../../src/data/settings';
import { fr } from '../../src/i18n/fr';
import {
  availableOperators,
  boostBlock,
  displayNumber,
  formatAmount,
  localNumber,
  normalizeTxRef,
  payeeReady,
  tierOffers,
} from '../../src/lib/boost-form';
import { DATA_URL_STEPS } from '../../src/lib/image-compress';
import {
  boostEndingSoon,
  dayWord,
  listingReminders,
  listingState,
  type OwnListing,
} from '../../src/lib/listing-status';
import { bellText } from '../../src/shell/bell';
import { renderHeader, THEME_BOOT_SCRIPT } from '../../src/shell/render';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = new Date(2026, 9, 2, 10, 0, 0);

const base: OwnListing = {
  id: 'alice_1',
  genre: 'femme',
  citySlug: 'douala',
  district: 'Akwa',
  title: 'Soirée à Akwa',
  description: 'Une description assez longue.',
  offer: '',
  photos: ['mpb0pn6ouv10s41qzqdk:1600x1200'],
  contactMode: 'message',
  rank: 0,
  boostUntil: null,
  views: 0,
  likes: 0,
  hidden: false,
  status: 'active',
  removedReason: null,
  createdAt: new Date(NOW.getTime() - 10 * DAY),
  renewedAt: new Date(NOW.getTime() - 10 * DAY),
};

const empty = { number: '', name: '' };
const closed: PublicSettings = { ...DEMO_SETTINGS, payment: { mtn: empty, orange: empty } };

describe('boost offers (prices and duration from settings, SPEC § 7)', () => {
  it('reads both tiers from settings, Premium first', () => {
    const s: PublicSettings = {
      ...DEMO_SETTINGS,
      prices: { premium: 2500, sponsored: 700 },
      boostDays: { premium: 10, sponsored: 5 },
    };
    expect(tierOffers(s)).toEqual([
      { tier: 'premium', price: 2500, days: 10 },
      { tier: 'sponsored', price: 700, days: 5 },
    ]);
  });

  it('reads the former single duration (before 3 Oct 2026) as the same days for both', () => {
    const rest: Record<string, unknown> = { ...DEMO_SETTINGS };
    expect(normalizeSettings({ ...rest, boostDays: 7 }).boostDays).toEqual({ premium: 7, sponsored: 7 });
    expect(normalizeSettings({ ...rest, boostDays: { premium: 9, sponsored: 3 } }).boostDays).toEqual({
      premium: 9,
      sponsored: 3,
    });
  });

  it('offers only the operators whose number AND name are set', () => {
    expect(availableOperators(closed)).toEqual([]);
    const mtnOnly = {
      ...closed,
      payment: { ...closed.payment, mtn: { number: '+237677000000', name: 'X' } },
    };
    expect(availableOperators(mtnOnly)).toEqual(['mtn']);
    expect(payeeReady({ number: '+237677000000', name: '  ' })).toBe(false);
    expect(availableOperators(DEMO_SETTINGS)).toEqual(['mtn', 'orange']);
  });

  it('formats the exact amount in F CFA', () => {
    expect(formatAmount(2000)).toBe('2\u00a0000\u00a0F\u00a0CFA');
    expect(formatAmount(500)).toBe('500\u00a0F\u00a0CFA');
  });
});

describe('payee number', () => {
  it('copies the 9 local digits', () => {
    expect(localNumber('+237677123456')).toBe('677123456');
    expect(localNumber('+237 6 77 12 34 56')).toBe('677123456');
    expect(localNumber('677123456')).toBe('677123456');
    expect(localNumber('237677123456')).toBe('677123456');
  });

  it('displays it in pairs, or as entered when it is not a Cameroonian mobile number', () => {
    expect(displayNumber('+237677123456')).toBe('677 12 34 56');
    expect(displayNumber('12345')).toBe('12345');
  });
});

describe('transaction reference (optional)', () => {
  it('is null when empty, trimmed otherwise, refused above the rules limit', () => {
    expect(normalizeTxRef('   ')).toEqual({ value: null });
    expect(normalizeTxRef('  MP2610.1234.A  ')).toEqual({ value: 'MP2610.1234.A' });
    expect(normalizeTxRef('x'.repeat(TEXT_MAX.txRef))).toEqual({ value: 'x'.repeat(TEXT_MAX.txRef) });
    expect(normalizeTxRef('x'.repeat(TEXT_MAX.txRef + 1))).toEqual({ error: 'tooLong' });
  });
});

describe('boostBlock', () => {
  it('allows an active listing, also when a dated boost is running (it is extended)', () => {
    expect(boostBlock(base, NOW)).toBeNull();
    expect(boostBlock({ ...base, rank: 2, boostUntil: new Date(NOW.getTime() + 3 * DAY) }, NOW)).toBeNull();
  });

  it('refuses removed, hidden, expired and unlimited listings', () => {
    expect(boostBlock({ ...base, status: 'removed' }, NOW)).toBe('removed');
    expect(boostBlock({ ...base, hidden: true }, NOW)).toBe('hidden');
    expect(boostBlock({ ...base, renewedAt: new Date(NOW.getTime() - 181 * DAY) }, NOW)).toBe('expired');
    expect(boostBlock({ ...base, rank: 1, boostUntil: null }, NOW)).toBe('unlimited');
  });

  it('has a French message for every block', () => {
    for (const b of ['removed', 'hidden', 'expired', 'unlimited'] as const) {
      expect(fr.boost.blocked[b].length).toBeGreaterThan(10);
    }
  });
});

describe('computed reminders (SPEC § 9, never stored)', () => {
  it('reminds of a listing expiring within 7 days', () => {
    const l = { ...base, renewedAt: new Date(NOW.getTime() - 175 * DAY) };
    expect(listingReminders([l], NOW)).toEqual([
      { kind: 'expiry', listingId: 'alice_1', title: base.title, daysLeft: 5 },
    ]);
    expect(listingReminders([base], NOW)).toEqual([]);
  });

  it('reminds of a boost ending within 24 hours, not before nor after', () => {
    const until = new Date(NOW.getTime() + 20 * HOUR);
    const soon = { ...base, rank: 2, boostUntil: until };
    expect(listingReminders([soon], NOW)).toEqual([
      { kind: 'boostEnding', listingId: 'alice_1', title: base.title, tier: 'premium', until },
    ]);
    expect(listingReminders([{ ...soon, boostUntil: new Date(NOW.getTime() + 25 * HOUR) }], NOW)).toEqual([]);
    expect(listingReminders([{ ...soon, boostUntil: new Date(NOW.getTime() - HOUR) }], NOW)).toEqual([]);
    expect(listingReminders([{ ...soon, boostUntil: null }], NOW)).toEqual([]);
  });

  it('ignores removed and hidden listings, sorts soonest first', () => {
    const expiring = { ...base, id: 'alice_2', renewedAt: new Date(NOW.getTime() - 175 * DAY) };
    const ending = { ...base, id: 'alice_3', rank: 1, boostUntil: new Date(NOW.getTime() + 2 * HOUR) };
    const removed = { ...expiring, id: 'alice_4', status: 'removed' as const };
    const hidden = { ...ending, id: 'alice_5', hidden: true };
    expect(listingReminders([expiring, removed, hidden, ending], NOW).map((r) => r.listingId)).toEqual([
      'alice_3',
      'alice_2',
    ]);
  });

  it('says « aujourd’hui » or « demain » from the calendar day', () => {
    expect(dayWord(new Date(2026, 9, 2, 23, 0), NOW)).toBe('today');
    expect(dayWord(new Date(2026, 9, 3, 1, 0), NOW)).toBe('tomorrow');
    expect(dayWord(new Date(2026, 9, 5, 1, 0), NOW)).toBe('later');
    const s = listingState({ ...base, rank: 2, boostUntil: new Date(NOW.getTime() + 2 * HOUR) }, NOW);
    expect(boostEndingSoon(s, NOW)).toBe(true);
  });
});

describe('screenshot compression steps', () => {
  it('go down in size and quality, starting at 1600 px', () => {
    expect(DATA_URL_STEPS[0]?.maxSide).toBe(1600);
    for (let i = 1; i < DATA_URL_STEPS.length; i++) {
      expect(DATA_URL_STEPS[i]!.maxSide).toBeLessThan(DATA_URL_STEPS[i - 1]!.maxSide);
      expect(DATA_URL_STEPS[i]!.quality).toBeLessThan(DATA_URL_STEPS[i - 1]!.quality);
    }
    // ≤ 300 KB of JPEG (ARCHITECTURE § 6).
    expect(DATA_URL_MAX_CHARS).toBeLessThanOrEqual(410_000);
  });
});

describe('header bell (SPEC § 9)', () => {
  it('shows no number at 0, caps at 99+', () => {
    expect(bellText(0)).toBe('');
    expect(bellText(3)).toBe('3');
    expect(bellText(120)).toBe('99+');
  });

  it('is a link to the notifications of /compte, its badge empty in the static HTML', () => {
    const html = renderHeader();
    expect(html).toContain('href="/compte#notifications"');
    expect(html).toMatch(/data-bell-count hidden><\/span>/);
  });

  it('is shown before first paint only when an unread count is stored', () => {
    const run = (stored: Record<string, string>) => {
      const attrs: Record<string, string> = {};
      const fakeDocument = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
      const fakeStorage = { getItem: (k: string) => stored[k] ?? null };
      new Function('document', 'localStorage', THEME_BOOT_SCRIPT)(fakeDocument, fakeStorage);
      return attrs;
    };
    // Dark by default (owner's decision of 3 Oct 2026, back to the original); light when chosen.
    expect(run({})).toEqual({ 'data-theme': 'dark', 'data-js': '' });
    expect(run({ 'nx-unread': '2', 'nx-theme': 'light' })).toEqual({
      'data-member': '',
      'data-theme': 'light',
      'data-js': '',
    });
  });
});
