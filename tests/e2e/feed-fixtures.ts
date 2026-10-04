/**
 * Listings written straight into the Firestore emulator for the phase 5 tests. Each test owns a
 * city per viewport project (both projects run in parallel against the same emulator), so its
 * feed only holds its own listings.
 */
import type { TestInfo } from '@playwright/test';
import {
  demoContact,
  demoListing,
  demoProfile,
  listingId,
  type DemoListingInput,
} from '../../scripts/demo-data.ts';
import { writeDoc } from '../../scripts/emulator.ts';

/** City slugs reserved per test (never Douala: the account and publish tests use it). */
const CITIES = {
  order: ['meiganga', 'guider'],
  pagination: ['bafia', 'kousseri'],
  filters: ['sangmelima', 'ebolowa'],
  contact: ['mbalmayo', 'dschang'],
  reports: ['tiko', 'foumban'],
  social: ['bafang', 'kumbo'],
  empty: ['kumba', 'loum'],
  cityPage: ['nkongsamba', 'edea'],
  member: ['bertoua', 'mbouda'],
  cache: ['bamenda', 'maroua'],
  admin: ['limbe', 'buea'],
  rail: ['ngaoundere', 'bafoussam'],
  links: ['kribi', 'kribi'], // legal.spec (mobile-375 only)
} as const;

export function cityFor(info: TestInfo, key: keyof typeof CITIES): string {
  return CITIES[key][info.project.name === 'mobile-360' ? 1 : 0];
}

export const HOUR = 3_600_000;

export interface Seeded {
  id: string;
  whatsapp: string;
}

let counter = 0;

/** One listing (+ private contact + public profile), all written with the rules bypassed. */
export async function seedListing(input: Omit<DemoListingInput, 'uid'> & { uid?: string }): Promise<Seeded> {
  counter += 1;
  const uid = input.uid ?? `e2e${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`;
  const id = listingId(uid, input.slot ?? 1);
  const data = demoListing({ pseudo: `P${counter}${uid.slice(-4)}`, ...input, uid });
  const whatsapp = `+2376${String(10_000_000 + Math.floor(Math.random() * 89_999_999))}`;
  await Promise.all([
    writeDoc(`listings/${id}`, data),
    writeDoc(`listings/${id}/private/contact`, demoContact(whatsapp, input.contactMode ?? 'message')),
    writeDoc(
      `publicProfiles/${uid}`,
      demoProfile(String(data['pseudo']), data['memberSince'] as Date, input.verified ?? false),
    ),
  ]);
  return { id, whatsapp };
}

export function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * HOUR);
}
