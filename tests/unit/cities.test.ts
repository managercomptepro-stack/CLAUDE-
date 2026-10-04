import { describe, expect, it } from 'vitest';
import { CITIES, cityBySlug, DEFAULT_CITY_SLUG, distanceKm, nearestCity } from '../../src/data/cities';
import { slugify } from '../../src/lib/format';

const SPEC_ORDER = [
  'Douala',
  'Yaoundé',
  'Garoua',
  'Bamenda',
  'Maroua',
  'Bafoussam',
  'Ngaoundéré',
  'Bertoua',
  'Edéa',
  'Loum',
  'Kumba',
  'Nkongsamba',
  'Buea',
  'Kumbo',
  'Foumban',
  'Dschang',
  'Ebolowa',
  'Kousséri',
  'Guider',
  'Mbouda',
  'Limbé',
  'Kribi',
  'Bafang',
  'Tiko',
  'Mbalmayo',
  'Sangmélima',
  'Meiganga',
  'Bafia',
];

describe('cities', () => {
  it('lists the 28 cities of SPEC § 11 in display order', () => {
    expect(CITIES.map((c) => c.name)).toEqual(SPEC_ORDER);
  });

  it('has unique slugs equal to slugify(name)', () => {
    const slugs = CITIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(28);
    for (const c of CITIES) expect(c.slug).toBe(slugify(c.name));
  });

  it('has coordinates inside Cameroon (lat 1.6–13.1, lng 8.4–16.2)', () => {
    for (const c of CITIES) {
      expect(c.lat).toBeGreaterThan(1.6);
      expect(c.lat).toBeLessThan(13.1);
      expect(c.lng).toBeGreaterThan(8.4);
      expect(c.lng).toBeLessThan(16.2);
    }
  });

  it('defaults to Douala', () => {
    expect(cityBySlug(DEFAULT_CITY_SLUG)?.name).toBe('Douala');
    expect(cityBySlug('paris')).toBeUndefined();
  });

  it('computes plausible distances (Douala–Yaoundé ≈ 200 km by air)', () => {
    const d = cityBySlug('douala')!;
    const y = cityBySlug('yaounde')!;
    const km = distanceKm(d.lat, d.lng, y.lat, y.lng);
    expect(km).toBeGreaterThan(180);
    expect(km).toBeLessThan(220);
  });

  it('finds the nearest city', () => {
    expect(nearestCity(4.06, 9.71).slug).toBe('douala');
    expect(nearestCity(3.87, 11.5).slug).toBe('yaounde');
    expect(nearestCity(12.0, 15.0).slug).toBe('kousseri');
  });
});
