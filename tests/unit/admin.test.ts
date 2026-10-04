import { describe, expect, it } from 'vitest';
import { STRIKES_BAN_THRESHOLD } from '../../src/data/limits';
import { DEFAULT_SETTINGS, DEMO_SETTINGS } from '../../src/data/settings';
import { fr } from '../../src/i18n/fr';
import {
  actionLabel,
  ADMIN_TABS,
  approvedBoost,
  asRole,
  changeSummary,
  homeLoadsPerDay,
  normalizeTxRef,
  proofReuse,
  promotionUntil,
  reasonError,
  reportQueue,
  searchKey,
  settingsToInput,
  strikeAfterRemoval,
  tabFromHash,
  tabsFor,
  validateSettings,
  type QueueListing,
  type QueueReport,
} from '../../src/lib/admin-logic';

const DAY = 86_400_000;
const NOW = new Date('2026-10-02T10:00:00Z');
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

describe('tabs per role', () => {
  it('shows moderators only Signalements, Récentes, Santé (badges: super-admin, 3 Oct 2026)', () => {
    expect(tabsFor('moderator')).toEqual(['signalements', 'recentes', 'sante']);
  });
  it('shows the super-admin all 11 tabs, each with a French label', () => {
    expect(tabsFor('super')).toHaveLength(11);
    for (const t of ADMIN_TABS) expect(fr.admin.tabs[t.id]).toBeTruthy();
  });
  it('never opens a super-admin tab for a moderator from the address', () => {
    expect(tabFromHash('#paiements', 'moderator')).toBe('signalements');
    expect(tabFromHash('#reglages', 'moderator')).toBe('signalements');
    expect(tabFromHash('#paiements', 'super')).toBe('paiements');
    expect(tabFromHash('#badges', 'moderator')).toBe('signalements');
    expect(tabFromHash('', 'super')).toBe('signalements');
  });
  it('accepts only the two stored roles', () => {
    expect(asRole('super')).toBe('super');
    expect(asRole('moderator')).toBe('moderator');
    expect(asRole('none')).toBeNull();
    expect(asRole(undefined)).toBeNull();
  });
});

describe('boost validation (SPEC § 7, decision 10)', () => {
  it('starts boostDays from now on a free listing', () => {
    expect(approvedBoost({ rank: 0, boostUntil: null }, 'premium', 7, NOW)).toEqual({
      rank: 2,
      boostUntil: at(7),
    });
    expect(approvedBoost({ rank: 0, boostUntil: null }, 'sponsored', 7, NOW)).toEqual({
      rank: 1,
      boostUntil: at(7),
    });
  });
  it('adds the days to the end of a promotion still running', () => {
    expect(approvedBoost({ rank: 2, boostUntil: at(3) }, 'premium', 7, NOW)).toEqual({
      rank: 2,
      boostUntil: at(10),
    });
  });
  it('starts from now when the previous promotion has ended', () => {
    expect(approvedBoost({ rank: 2, boostUntil: at(-1) }, 'sponsored', 7, NOW)).toEqual({
      rank: 1,
      boostUntil: at(7),
    });
  });
  it('keeps the higher tier of the two, and an unlimited promotion unlimited', () => {
    expect(approvedBoost({ rank: 1, boostUntil: at(2) }, 'premium', 7, NOW).rank).toBe(2);
    expect(approvedBoost({ rank: 2, boostUntil: at(2) }, 'sponsored', 7, NOW)).toEqual({
      rank: 2,
      boostUntil: at(9),
    });
    expect(approvedBoost({ rank: 1, boostUntil: null }, 'premium', 7, NOW)).toEqual({
      rank: 2,
      boostUntil: null,
    });
  });
  it('uses the duration from the settings', () => {
    expect(approvedBoost({ rank: 0, boostUntil: null }, 'premium', 10, NOW).boostUntil).toEqual(at(10));
  });
  it('computes a promotion granted by hand', () => {
    expect(promotionUntil(14, NOW)).toEqual(at(14));
    expect(promotionUntil(null, NOW)).toBeNull();
  });
});

describe('strikes (SPEC § 10)', () => {
  it('adds one strike per removal and bans publication at the 5th', () => {
    let s = { strikes: 0, publishBanned: false };
    for (let i = 1; i < STRIKES_BAN_THRESHOLD; i++) {
      s = strikeAfterRemoval(s);
      expect(s).toEqual({ strikes: i, publishBanned: false });
    }
    expect(strikeAfterRemoval(s)).toEqual({ strikes: 5, publishBanned: true });
  });
  it('keeps a ban set by the super-admin, and bans again past 5 after an unban', () => {
    expect(strikeAfterRemoval({ strikes: 0, publishBanned: true }).publishBanned).toBe(true);
    expect(strikeAfterRemoval({ strikes: 5, publishBanned: false })).toEqual({
      strikes: 6,
      publishBanned: true,
    });
  });
  it('requires a reason of 3 to 300 characters', () => {
    expect(reasonError('  ')).toBe(fr.admin.reasonRequired);
    expect(reasonError('ab')).toBe(fr.admin.reasonRequired);
    expect(reasonError('Photos volées')).toBeNull();
    expect(reasonError('x'.repeat(301))).toBe(fr.admin.reasonTooLong(300));
  });
});

describe('report queue', () => {
  const listing = (id: string, over: Partial<QueueListing> = {}): QueueListing => ({
    id,
    hidden: false,
    status: 'active',
    reportsCount: 1,
    reportsClearedAt: null,
    ...over,
  });
  const report = (
    listingId: string,
    reason: QueueReport['reason'],
    note = '',
    day = 0,
    counted = true,
  ): QueueReport => ({
    listingId,
    reason,
    note,
    createdAt: at(day),
    counted,
  });

  it('puts hidden listings first, then « seems underage », then the most reported', () => {
    const q = reportQueue(
      [
        listing('many', { reportsCount: 6 }),
        listing('minor', { reportsCount: 1 }),
        listing('hidden', { hidden: true, reportsCount: 10 }),
        listing('few', { reportsCount: 2 }),
      ],
      [
        report('many', 'scam'),
        report('minor', 'minor'),
        report('hidden', 'fake_profile'),
        report('few', 'other'),
      ],
    );
    expect(q.map((e) => e.listing.id)).toEqual(['hidden', 'minor', 'many', 'few']);
    expect(q[1]?.minor).toBe(true);
  });
  it('leaves out removed listings and reports older than the last decision', () => {
    const q = reportQueue(
      [
        listing('removed', { status: 'removed' }),
        listing('dismissed', { reportsCount: 0, reportsClearedAt: at(1) }),
        listing('open'),
      ],
      [report('removed', 'scam'), report('dismissed', 'scam', '', 0), report('open', 'scam')],
    );
    expect(q.map((e) => e.listing.id)).toEqual(['open']);
  });

  it('anonymous reports (owner, 3 Oct 2026): shown in the queue, counted apart, never hide', () => {
    const q = reportQueue(
      [listing('anon', { reportsCount: 0 }), listing('mixed', { reportsCount: 1 })],
      [
        report('anon', 'fake_profile', '', 0, false),
        report('anon', 'scam', '', 0, false),
        report('mixed', 'minor', '', 0, true),
        report('mixed', 'minor', '', 0, false),
      ],
    );
    expect(q.find((e) => e.listing.id === 'anon')).toMatchObject({ uncounted: 2 });
    expect(q.find((e) => e.listing.id === 'mixed')).toMatchObject({ uncounted: 1 });
    // A newer anonymous report after a dismissal brings the listing back.
    const back = reportQueue(
      [listing('d', { reportsCount: 0, reportsClearedAt: at(1) })],
      [report('d', 'scam', '', 0), report('d', 'other', '', 2, false)],
    );
    expect(back[0]).toMatchObject({ uncounted: 1, reasons: [{ reason: 'other', count: 1 }] });
  });
  it('counts the reasons in the official order and keeps the visitors’ notes', () => {
    const [e] = reportQueue(
      [listing('a', { reportsCount: 3 })],
      [report('a', 'scam', 'Demande de l’argent'), report('a', 'minor'), report('a', 'scam', '  ')],
    );
    expect(e?.reasons).toEqual([
      { reason: 'minor', count: 1 },
      { reason: 'scam', count: 2 },
    ]);
    expect(e?.notes).toEqual(['Demande de l’argent']);
  });
  it('cleans a search key', () => {
    expect(searchKey('  @Alice ')).toBe('Alice');
  });
});

describe('settings form', () => {
  const base = settingsToInput(DEMO_SETTINGS);

  it('round-trips the stored settings', () => {
    const r = validateSettings(base);
    expect(r).toEqual({ ok: true, value: DEMO_SETTINGS });
  });
  it('normalises the payee numbers and takes the terms version of the form', () => {
    const r = validateSettings({
      ...base,
      mtnNumber: '6 77 12 34 56',
      orangeNumber: '00237 690 00 00 00',
      termsVersion: ' v9 ',
    });
    expect(r.ok && r.value.payment.mtn.number).toBe('+237677123456');
    expect(r.ok && r.value.payment.orange.number).toBe('+237690000000');
    expect(r.ok && r.value.termsVersion).toBe('v9');
  });
  it('accepts an operator left empty (number and name), refuses half of one', () => {
    const empty = validateSettings({ ...base, orangeNumber: '', orangeName: '' });
    expect(empty.ok && empty.value.payment.orange).toEqual({ number: '', name: '' });
    const noName = validateSettings({ ...base, orangeName: ' ' });
    expect(!noName.ok && noName.errors.orangeName).toBe(fr.admin.settings.nameRequired);
    const noNumber = validateSettings({ ...base, mtnNumber: '' });
    expect(!noNumber.ok && noNumber.errors.mtnNumber).toBe(fr.admin.settings.numberRequired);
  });
  it('refuses an empty or malformed terms version', () => {
    for (const termsVersion of ['', ' ', 'version 2', 'é-2026', '-2026', 'x'.repeat(21)]) {
      const r = validateSettings({ ...base, termsVersion });
      expect(!r.ok && r.errors.termsVersion).toBe(fr.admin.settings.termsVersionInvalid);
    }
    expect(validateSettings({ ...base, termsVersion: '2027-01_1.b' }).ok).toBe(true);
  });
  it('refuses values outside the bounds of the rules', () => {
    const r = validateSettings({
      ...base,
      premium: '0',
      sponsored: '5OO',
      premiumDays: '91',
      sponsoredDays: '0',
      maxActiveListings: '21',
      reportsHideThreshold: '1',
      supportWhatsApp: '12345',
      mtnNumber: '+33612345678',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(
      [
        'premiumDays',
        'sponsoredDays',
        'maxActiveListings',
        'mtnNumber',
        'premium',
        'reportsHideThreshold',
        'sponsored',
        'supportWhatsApp',
      ].sort(),
    );
  });
  it('starts a missing document from the specification values, without any payee', () => {
    expect(DEFAULT_SETTINGS.prices).toEqual({ premium: 2000, sponsored: 500 });
    expect(DEFAULT_SETTINGS.payment).toEqual({
      mtn: { number: '', name: '' },
      orange: { number: '', name: '' },
    });
    expect(DEMO_SETTINGS.prices).toEqual(DEFAULT_SETTINGS.prices);
  });
});

describe('journal and health', () => {
  it('summarises a change', () => {
    expect(changeSummary({ rank: 0, boostUntil: null }, { rank: 2, boostUntil: null })).toBe('rank : 0 → 2');
    expect(changeSummary(null, { role: 'moderator' })).toBe('role : moderator');
    expect(changeSummary({ hidden: true }, { hidden: true })).toBe('');
  });
  it('labels every action written by the admin', () => {
    expect(actionLabel('boost.approve')).toBe('Paiement validé');
    expect(actionLabel('unknown.action')).toBe('unknown.action');
  });
  it('estimates home loads per day from the Spark read quota', () => {
    expect(homeLoadsPerDay(20)).toBe(2500);
  });
});

describe('payment proof reused (security audit of 3 Oct 2026)', () => {
  const r = (id: string, txRef: string | null, screenshot: string | null = null, operator = 'mtn') => ({
    id,
    operator,
    txRef,
    screenshot,
  });

  it('flags a reference already used by another request, written differently, same operator only', () => {
    const pending = [r('a', 'TX 123-45', 'shot1'), r('b', 'tx12345', 'shot2'), r('c', 'TX999'), r('d', null)];
    const earlier = [r('old', 'TX999'), r('om', 'TX12345', null, 'orange')];
    const out = proofReuse(pending, earlier);
    expect(out.get('a')).toEqual({ sameRef: 1, sameShot: false });
    expect(out.get('b')).toEqual({ sameRef: 1, sameShot: false });
    expect(out.get('c')).toEqual({ sameRef: 1, sameShot: false });
    expect(out.get('d')).toEqual({ sameRef: 0, sameShot: false });
    expect(normalizeTxRef(' Tx-12 34 ')).toBe('tx1234');
  });

  it('flags the very same screenshot sent for two pending requests', () => {
    const out = proofReuse([r('a', null, 'same'), r('b', null, 'same'), r('c', null, 'other')], []);
    expect(out.get('a')?.sameShot).toBe(true);
    expect(out.get('c')?.sameShot).toBe(false);
  });

  it('does not count a request twice when it is both pending and found again by the query', () => {
    const out = proofReuse([r('a', 'X1')], [r('a', 'X1')]);
    expect(out.get('a')).toEqual({ sameRef: 0, sameShot: false });
  });
});
