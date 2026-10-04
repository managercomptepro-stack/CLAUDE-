/**
 * The 28 cities offered on NIOXXER, in display order (SPEC § 11, list taken from
 * archives/v1/js/config.js).
 *
 * GPS coordinates are approximate city centres, used only by « Autour de moi » to pick the
 * nearest city. Source: Wikidata, property P625 (coordinate location), queried on 2026-10-02;
 * the item id of each city is given next to it so the value can be re-checked at
 * https://www.wikidata.org/wiki/<id>. Rounded to 3 decimals (~100 m), more than enough here.
 */
export interface City {
  readonly name: string;
  readonly slug: string;
  readonly lat: number;
  readonly lng: number;
}

export const CITIES: readonly City[] = [
  { name: 'Douala', slug: 'douala', lat: 4.05, lng: 9.7 }, // Q132830
  { name: 'Yaoundé', slug: 'yaounde', lat: 3.858, lng: 11.518 }, // Q3808
  { name: 'Garoua', slug: 'garoua', lat: 9.3, lng: 13.4 }, // Q157915
  { name: 'Bamenda', slug: 'bamenda', lat: 5.961, lng: 10.152 }, // Q528432
  { name: 'Maroua', slug: 'maroua', lat: 10.591, lng: 14.316 }, // Q818824
  { name: 'Bafoussam', slug: 'bafoussam', lat: 5.467, lng: 10.417 }, // Q799808
  { name: 'Ngaoundéré', slug: 'ngaoundere', lat: 7.321, lng: 13.584 }, // Q745906
  { name: 'Bertoua', slug: 'bertoua', lat: 4.583, lng: 13.683 }, // Q657734
  { name: 'Edéa', slug: 'edea', lat: 3.8, lng: 10.133 }, // Q1002900
  { name: 'Loum', slug: 'loum', lat: 4.7, lng: 9.73 }, // Q1828275
  { name: 'Kumba', slug: 'kumba', lat: 4.633, lng: 9.45 }, // Q997047
  { name: 'Nkongsamba', slug: 'nkongsamba', lat: 4.95, lng: 9.917 }, // Q999070
  { name: 'Buea', slug: 'buea', lat: 4.167, lng: 9.233 }, // Q312209
  { name: 'Kumbo', slug: 'kumbo', lat: 6.2, lng: 10.66 }, // Q2533580
  { name: 'Foumban', slug: 'foumban', lat: 5.717, lng: 10.917 }, // Q1439847
  { name: 'Dschang', slug: 'dschang', lat: 5.45, lng: 10.05 }, // Q289267
  { name: 'Ebolowa', slug: 'ebolowa', lat: 2.917, lng: 11.15 }, // Q910616
  { name: 'Kousséri', slug: 'kousseri', lat: 12.083, lng: 15.033 }, // Q697662
  { name: 'Guider', slug: 'guider', lat: 9.934, lng: 13.949 }, // Q2708439
  { name: 'Mbouda', slug: 'mbouda', lat: 5.62, lng: 10.25 }, // Q2709339
  { name: 'Limbé', slug: 'limbe', lat: 4.017, lng: 9.217 }, // Q819314
  { name: 'Kribi', slug: 'kribi', lat: 2.95, lng: 9.917 }, // Q997121
  { name: 'Bafang', slug: 'bafang', lat: 5.15, lng: 10.183 }, // Q667828
  { name: 'Tiko', slug: 'tiko', lat: 4.079, lng: 9.368 }, // Q2228759
  { name: 'Mbalmayo', slug: 'mbalmayo', lat: 3.52, lng: 11.512 }, // Q2702755
  { name: 'Sangmélima', slug: 'sangmelima', lat: 2.93, lng: 11.98 }, // Q2708780
  { name: 'Meiganga', slug: 'meiganga', lat: 6.517, lng: 14.295 }, // Q2629052
  { name: 'Bafia', slug: 'bafia', lat: 4.743, lng: 11.225 }, // Q799790
];

export const DEFAULT_CITY_SLUG = 'douala';

export function cityBySlug(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function nearestCity(lat: number, lng: number): City {
  return CITIES.reduce((best, c) =>
    distanceKm(lat, lng, c.lat, c.lng) < distanceKm(lat, lng, best.lat, best.lng) ? c : best,
  );
}
