import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { findTextProblem } from '../../src/data/moderation';
import { PHOTO_REF_RE } from '../../src/lib/photo-url';
import { promotion, toPublicListing } from '../../src/lib/public-listing';
import { seedDocs } from '../../scripts/demo-data';
import { Timestamp } from 'firebase/firestore/lite';

const NOW = new Date(Date.UTC(2026, 9, 2, 12));

/** Dates → Timestamps, as Firestore returns them. */
function asStored(d: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(d).map(([k, v]) => [k, v instanceof Date ? Timestamp.fromDate(v) : v]),
  );
}

describe('npm run seed — demo data', () => {
  const docs = seedDocs(NOW);
  const listings = docs.filter((d) => /^listings\/[^/]+$/.test(d.path));

  it('has about 60 listings, each with its private contact and its public profile', () => {
    expect(listings.length).toBeGreaterThanOrEqual(55);
    for (const l of listings) {
      expect(docs.some((d) => d.path === `${l.path}/private/contact`)).toBe(true);
      expect(docs.some((d) => d.path === `publicProfiles/${String(l.data['ownerUid'])}`)).toBe(true);
    }
  });

  it('only holds texts the rules accept, valid photos and adult ages', () => {
    for (const { data } of listings) {
      for (const f of ['district', 'title', 'description', 'offer'] as const) {
        expect(findTextProblem(String(data[f])), String(data[f])).toBeNull();
      }
      expect((data['photos'] as string[]).every((p) => PHOTO_REF_RE.test(p))).toBe(true);
      const l = toPublicListing('x', asStored(data));
      expect(l).not.toBeNull();
    }
  });

  it('has Premium, Sponsored, free and one ended boost in Douala', () => {
    const douala = listings
      .map((d) => toPublicListing(d.path.split('/')[1] ?? '', asStored(d.data)))
      .filter((l) => l?.citySlug === 'douala');
    const tiers = douala.map((l) => (l ? promotion(l, NOW) : null));
    expect(tiers.filter((t) => t === 'premium').length).toBeGreaterThanOrEqual(3);
    expect(tiers.filter((t) => t === 'sponsored').length).toBeGreaterThanOrEqual(3);
    expect(tiers.filter((t) => t === null).length).toBeGreaterThan(20);
    expect(douala.some((l) => l && l.rank > 0 && promotion(l, NOW) === null)).toBe(true);
    expect(douala.length).toBeGreaterThan(20); // more than one page of 20
  });

  it('refuses to run without a local FIRESTORE_EMULATOR_HOST', () => {
    const env = { ...process.env };
    delete env['FIRESTORE_EMULATOR_HOST'];
    const run = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-emulator.ts'], {
      env,
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('E_NOT_EMULATOR');
    const remote = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-emulator.ts'], {
      env: { ...env, FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' },
      encoding: 'utf8',
    });
    expect(remote.status).toBe(1);
  });
});
