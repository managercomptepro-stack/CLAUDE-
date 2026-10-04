import { describe, expect, it } from 'vitest';
import { ADULT_MIN_DAYS, SUPPORT_WHATSAPP_PATTERN } from '../../src/data/limits';
import {
  normalizeSupportNumber,
  ageFrom,
  formatWhatsApp,
  isAdult,
  memberSince,
  normalizeWhatsApp,
  slugify,
} from '../../src/lib/format';

const DAY = 86_400_000;

describe('normalizeWhatsApp', () => {
  it.each([
    ['6 78 80 24 47', '+237678802447'],
    ['678802447', '+237678802447'],
    ['+237 678 80 24 47', '+237678802447'],
    ['00237678802447', '+237678802447'],
    ['237-678-80-24-47', '+237678802447'],
    ['(+237) 6.78.80.24.47', '+237678802447'],
  ])('normalises %s', (raw, expected) => {
    expect(normalizeWhatsApp(raw)).toBe(expected);
  });

  it.each(['', '   ', null, undefined])('returns null for empty value %s', (raw) => {
    expect(normalizeWhatsApp(raw)).toBeNull();
  });

  it.each(['278802447', '67880244', '6788024477', '+33612345678', 'abc'])('rejects %s', (raw) => {
    expect(normalizeWhatsApp(raw)).toBe(false);
  });
});

describe('formatWhatsApp', () => {
  it('formats a normalised number', () => {
    expect(formatWhatsApp('+237678802447')).toBe('6 78 80 24 47');
  });
});

describe('age', () => {
  const now = new Date('2026-10-02T12:00:00Z');

  it('computes completed years', () => {
    expect(ageFrom(new Date('1995-06-15T00:00:00Z'), now)).toBe(31);
    expect(ageFrom(new Date('2008-10-03T00:00:00Z'), now)).toBe(17);
  });

  it('shows the new age on the birthday itself, also just after midnight UTC', () => {
    const birthday = new Date('2026-10-03T00:30:00Z');
    expect(ageFrom(new Date('2001-10-03T00:00:00Z'), birthday)).toBe(25);
    expect(ageFrom(new Date('2001-10-04T00:00:00Z'), birthday)).toBe(24);
    expect(ageFrom(new Date('2000-02-29T00:00:00Z'), new Date('2026-03-01T00:00:00Z'))).toBe(26);
  });

  it('uses the same majority threshold as the rules (6575 days)', () => {
    expect(ADULT_MIN_DAYS).toBe(6575);
    expect(isAdult(new Date(now.getTime() - ADULT_MIN_DAYS * DAY), now)).toBe(true);
    expect(isAdult(new Date(now.getTime() - (ADULT_MIN_DAYS - 1) * DAY), now)).toBe(false);
  });

  it('refuses someone who is 17 years and 364 days old', () => {
    expect(isAdult(new Date('2008-10-03T12:00:00Z'), now)).toBe(false);
  });
});

describe('memberSince', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const ago = (days: number) => new Date(now.getTime() - days * DAY);

  it.each([
    [0, 'membre depuis aujourd’hui'],
    [1, 'membre depuis 1 jour'],
    [3, 'membre depuis 3 jours'],
    [29, 'membre depuis 29 jours'],
    [30, 'membre depuis 1 mois'],
    [65, 'membre depuis 2 mois'],
    [364, 'membre depuis 11 mois'],
    [366, 'membre depuis 1 an'],
    [800, 'membre depuis 2 ans'],
  ])('%i days → %s', (days, expected) => {
    expect(memberSince(ago(days), now)).toBe(expected);
  });
});

describe('slugify', () => {
  it.each([
    ['Ngaoundéré', 'ngaoundere'],
    ['Kousséri', 'kousseri'],
    ['Yaoundé', 'yaounde'],
    ['Mentions légales', 'mentions-legales'],
  ])('%s → %s', (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });
});

describe('support number (admin › Réglages, owner 3 Oct 2026)', () => {
  it('accepts Cameroonian and international numbers, refuses the rest', () => {
    expect(normalizeSupportNumber('6 78 80 24 47')).toBe('+237678802447');
    expect(normalizeSupportNumber('+7 900 326-94-15')).toBe('+79003269415');
    expect(normalizeSupportNumber('0079003269415')).toBe('+79003269415');
    expect(normalizeSupportNumber('12345')).toBeNull();
    expect(normalizeSupportNumber('+0123456789')).toBeNull();
    expect(new RegExp(SUPPORT_WHATSAPP_PATTERN).test('+79003269415')).toBe(true);
  });
});
