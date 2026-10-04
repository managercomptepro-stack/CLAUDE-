import { describe, expect, it } from 'vitest';
import { fr } from '../../src/i18n/fr';
import {
  listingPhotoUrl,
  movePhoto,
  parsePhotoRef,
  photoRef,
  textError,
  validateListing,
  type ListingInput,
} from '../../src/lib/listing-form';
import {
  capOf,
  daysLeft,
  expiresAt,
  freeSlot,
  listingState,
  type OwnListing,
} from '../../src/lib/listing-status';

const PHOTO = 'mpb0pn6ouv10s41qzqdk:1600x1200';
const VALID: ListingInput = {
  genre: 'femme',
  citySlug: 'douala',
  district: 'Bonapriso',
  title: 'Belle rencontre à Douala',
  description: 'Je cherche une rencontre sympathique et discrète.',
  offer: '',
  photos: [PHOTO],
  whatsapp: '6 99 00 11 22',
  contactMode: 'message',
};

describe('validateListing', () => {
  it('accepts a complete listing, trims and normalises', () => {
    const r = validateListing({
      ...VALID,
      title: '  Belle rencontre à Douala  ',
      contactMode: 'call_message',
    });
    expect(r.ok && r.value).toEqual({
      ...VALID,
      genre: 'femme',
      whatsapp: '+237699001122',
      contactMode: 'call_message',
    });
  });

  it('refuses prices, minor terms and contact details with the owner’s wording', () => {
    const price = validateListing({ ...VALID, offer: 'Massage 20000 fcfa la nuit' });
    expect(price.ok ? null : price.errors.offer).toBe(
      'Les prix ne sont pas autorisés dans l’annonce : vous en parlerez sur WhatsApp.',
    );
    const minor = validateListing({ ...VALID, title: 'Lycéenne cherche' });
    expect(minor.ok ? null : minor.errors.title).toBe(fr.textProblems.minor);
    const contact = validateListing({ ...VALID, description: 'Écrivez-moi au 6 99 00 11 22 merci' });
    expect(contact.ok ? null : contact.errors.description).toBe(fr.textProblems.contact);
  });

  it('accepts the legitimate phrases of the owner list', () => {
    for (const text of ['J’ai 25 ans, 1m75, 2 enfants, né en 1995.', 'Couple de Kribi, 27 ans']) {
      expect(validateListing({ ...VALID, description: text }).ok).toBe(true);
    }
  });

  it('checks lengths like the rules', () => {
    expect(textError('title', 'ab')).toBe(fr.listingForm.length(3, 60));
    expect(textError('title', 'a'.repeat(61))).toBe(fr.listingForm.length(3, 60));
    expect(textError('district', 'B')).toBe(fr.listingForm.length(2, 40));
    expect(textError('offer', '')).toBeNull();
    expect(textError('offer', 'a'.repeat(301))).toBe(fr.listingForm.tooLong(300));
    expect(textError('description', 'court')).toBe(fr.listingForm.length(10, 1000));
  });

  it('needs 1 to 5 valid photos, a mode and a WhatsApp number', () => {
    const none = validateListing({ ...VALID, photos: [] });
    expect(none.ok ? null : none.errors.photos).toBe(fr.listingForm.photosCount(1, 5));
    expect(validateListing({ ...VALID, photos: Array(6).fill(PHOTO) }).ok).toBe(false);
    expect(validateListing({ ...VALID, photos: Array(5).fill(PHOTO) }).ok).toBe(true);
    expect(validateListing({ ...VALID, photos: ['listings/x:1x1'] }).ok).toBe(false);
    const r = validateListing({
      ...VALID,
      contactMode: 'call',
      whatsapp: '12',
      genre: 'x',
      citySlug: 'paris',
    });
    expect(r.ok ? [] : Object.keys(r.errors).sort()).toEqual([
      'citySlug',
      'contactMode',
      'genre',
      'whatsapp',
    ]);
  });
});

describe('photo references', () => {
  it('round-trips and builds the two delivery sizes', () => {
    const ref = photoRef('mpb0pn6ouv10s41qzqdk', 1600, 1200);
    expect(ref).toBe(PHOTO);
    expect(parsePhotoRef(ref)).toEqual({ publicId: 'mpb0pn6ouv10s41qzqdk', width: 1600, height: 1200 });
    expect(listingPhotoUrl(ref, 360)).toBe(
      'https://res.cloudinary.com/bcxiwwkh/image/upload/f_auto,q_auto,w_360/mpb0pn6ouv10s41qzqdk',
    );
    expect(listingPhotoUrl(ref, 960)).toContain('/f_auto,q_auto,w_960/');
    expect(parsePhotoRef('bad')).toBeNull();
    expect(listingPhotoUrl('bad', 360)).toBeNull();
  });

  it('reorders (the first photo is the main one)', () => {
    expect(movePhoto(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(movePhoto(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(movePhoto(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});

describe('listing state in « Mes annonces »', () => {
  const NOW = new Date(Date.UTC(2026, 9, 2, 12));
  const DAY = 86_400_000;
  const base: OwnListing = {
    id: 'alice_1',
    genre: 'femme',
    citySlug: 'douala',
    district: 'Akwa',
    title: 'Titre',
    description: 'Description assez longue',
    offer: '',
    photos: [PHOTO],
    contactMode: 'message',
    rank: 0,
    boostUntil: null,
    views: 3,
    likes: 1,
    hidden: false,
    status: 'active',
    removedReason: null,
    createdAt: new Date(NOW.getTime() - 10 * DAY),
    renewedAt: new Date(NOW.getTime() - 10 * DAY),
  };

  it('expires 180 days after the last (re)publication', () => {
    expect(expiresAt(base.renewedAt).getTime() - base.renewedAt.getTime()).toBe(180 * DAY);
    expect(daysLeft(base.renewedAt, NOW)).toBe(170);
    expect(daysLeft(new Date(NOW.getTime() - 200 * DAY), NOW)).toBe(0);
  });

  it('active, expiring within 7 days, expired', () => {
    expect(listingState(base, NOW)).toMatchObject({
      status: 'active',
      tone: 'ok',
      canEdit: true,
      canRepublish: true,
    });
    const soon = listingState({ ...base, renewedAt: new Date(NOW.getTime() - 175 * DAY) }, NOW);
    expect(soon).toMatchObject({ status: 'expiring', daysLeft: 5, tone: 'warn' });
    expect(listingState({ ...base, renewedAt: new Date(NOW.getTime() - 181 * DAY) }, NOW).status).toBe(
      'expired',
    );
  });

  it('hidden by reports: no action (the rules forbid deleting it); removed: erase only', () => {
    expect(listingState({ ...base, hidden: true }, NOW)).toMatchObject({
      status: 'hidden',
      canEdit: false,
      canRepublish: false,
      canDelete: false,
    });
    expect(listingState({ ...base, status: 'removed', removedReason: 'Photos volées' }, NOW)).toMatchObject({
      status: 'removed',
      canEdit: false,
      canRepublish: false,
      canDelete: true,
    });
  });

  it('shows a promotion only while it lasts', () => {
    const until = new Date(NOW.getTime() + 3 * DAY);
    expect(listingState({ ...base, rank: 2, boostUntil: until }, NOW).boost).toEqual({
      tier: 'premium',
      until,
    });
    expect(listingState({ ...base, rank: 1, boostUntil: null }, NOW).boost).toEqual({
      tier: 'sponsored',
      until: null,
    });
    expect(
      listingState({ ...base, rank: 2, boostUntil: new Date(NOW.getTime() - DAY) }, NOW).boost,
    ).toBeNull();
  });

  it('takes the first free slot up to the cap', () => {
    expect(freeSlot('alice', [], 7)).toBe('alice_1');
    expect(freeSlot('alice', ['alice_1', 'alice_3'], 7)).toBe('alice_2');
    expect(freeSlot('alice', ['alice_1', 'alice_2'], 2)).toBeNull();
  });
});

describe('cap of active listings per account (owner, 3 Oct 2026)', () => {
  it('uses the account cap when the super-admin set one, else the general setting', () => {
    expect(capOf(7, undefined)).toBe(7);
    expect(capOf(7, null)).toBe(7);
    expect(capOf(7, 12)).toBe(12);
    expect(capOf(7, 0)).toBe(0);
  });
});
