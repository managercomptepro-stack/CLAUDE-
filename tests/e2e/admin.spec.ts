/**
 * Phase 7 (PLAN): administration. Moderator vs super-admin tabs, payment validated → listing on
 * top + banner + notification, rejection with a reason, 5 removals → publication blocked, badge,
 * « Rétablir ». Runs against the emulators; the tests touching shared state (settings, cleanup)
 * are in admin-global.spec.ts, run after all the others.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { demoListing, listingId, type DemoListingInput } from '../../scripts/demo-data.ts';
import { readDoc, uidOf, writeDoc } from '../../scripts/emulator.ts';
import { adminMember, otherPage } from './admin-fixtures';
import { cityFor, hoursAgo, seedListing } from './feed-fixtures';
import {
  expectNoRawFirebaseText,
  mockCloudinary,
  PHOTO_FIXTURE,
  verifiedMember,
  type Member,
} from './helpers';

const DAY = 86_400_000;
const PHOTO_DATA_URL = `data:image/jpeg;base64,${readFileSync(PHOTO_FIXTURE).toString('base64')}`;

async function memberWithListings(page: Page, count: number, extra: Partial<DemoListingInput> = {}) {
  await mockCloudinary(page);
  const m = await verifiedMember(page);
  const uid = await uidOf(m.email, m.password);
  const ids: string[] = [];
  for (let slot = 1; slot <= count; slot++) {
    const id = listingId(uid, slot);
    await writeDoc(
      `listings/${id}`,
      demoListing({ uid, slot, pseudo: m.pseudo, title: `Annonce ${slot} de ${m.pseudo}`, ...extra }),
    );
    ids.push(id);
  }
  return { m, uid, ids };
}

async function auditOf(path: string) {
  const d = await readDoc(path);
  return readDoc(`auditLog/${String(d?.['auditId'])}`);
}

async function tabNames(page: Page): Promise<string[]> {
  return page.locator('.adm-tabs__tab').allInnerTexts();
}

test('access: refused without a role; a moderator sees only his tabs, restores, cannot decide a badge', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await mockCloudinary(page);
  const m: Member = await verifiedMember(page);
  const uid = await uidOf(m.email, m.password);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Accès réservé à l’équipe' })).toBeVisible();
  await expect(page.locator('.adm-tabs')).toHaveCount(0);

  // Hidden listing (10 reports).
  const hidden = await seedListing({ hidden: true, reportsCount: 10, title: 'Annonce masquée e2e' });

  await writeDoc(`admins/${uid}`, { role: 'moderator', addedBy: 'console', addedAt: new Date() });
  await page.goto('/admin');
  await expect(page.getByText('Modérateur', { exact: true })).toBeVisible();
  // Badges (ID photos) for the super-admin only (owner's decision of 3 Oct 2026).
  expect(await tabNames(page)).toEqual(['Signalements', 'Récentes', 'Santé']);
  await expect(page.getByRole('link', { name: 'Badges' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Paiements' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Réglages' })).toHaveCount(0);

  // A super-admin tab typed in the address falls back to « Signalements ».
  await page.goto('/admin#reglages');
  await expect(page.getByRole('heading', { name: 'Signalements', level: 2 })).toBeVisible();

  // Hidden listings come first, with « Rétablir » (audited).
  const row = page.locator(`[data-listing="${hidden.id}"]`);
  await expect(row.getByText('Masquée (signalements)')).toBeVisible();
  await row.getByRole('button', { name: 'Rétablir' }).click();
  await expect(page.getByText('Annonce rétablie.')).toBeVisible();
  await expect(row).toHaveCount(0);
  const restored = await readDoc(`listings/${hidden.id}`);
  expect([restored?.['hidden'], restored?.['reportsCount']]).toEqual([false, 0]);
  expect(await auditOf(`listings/${hidden.id}`)).toMatchObject({
    action: 'listing.restore',
    actorUid: uid,
    targetType: 'listing',
    targetId: hidden.id,
  });

  // « Mettre en avant » in Récentes: super-admin only.
  await page.getByRole('link', { name: 'Récentes' }).click();
  await expect(page.locator('.adm-list [data-listing]').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mettre en avant' })).toHaveCount(0);

  await expectNoRawFirebaseText(page);

  // Santé: counts without the payments line (its console links name Firebase on purpose).
  await page.getByRole('link', { name: 'Santé' }).click();
  await expect(page.locator('[data-health]')).toContainText('Annonces actives');
  await expect(page.locator('[data-health]')).not.toContainText('Paiements à vérifier');
  await expect(page.getByText('50 000 lectures Firestore par jour')).toBeVisible();
});

test('payment validated by the super-admin → listing on top, Premium banner, notification', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const city = cityFor(info, 'admin');
  // Two newer free listings: the boosted one must jump above them.
  const [newer1, newer2] = await Promise.all([
    seedListing({ citySlug: city, createdAt: hoursAgo(1) }),
    seedListing({ citySlug: city, createdAt: hoursAgo(2) }),
  ]);
  const { uid, ids } = await memberWithListings(page, 1, { citySlug: city, createdAt: hoursAgo(30) });
  const id = ids[0] ?? '';

  // The member asks for Premium (UI of phase 6).
  await page.goto(`/booster?id=${id}`);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.locator('[data-screenshot-input]').setInputFiles(PHOTO_FIXTURE);
  await expect(page.getByRole('img', { name: 'Capture d’écran choisie' })).toBeVisible();
  await page.getByLabel('Référence de la transaction (facultative)').fill('MP261002.9999');
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(page.getByRole('heading', { name: 'Demande envoyée' })).toBeVisible();
  const requestId = String((await readDoc(`pendingBoosts/${id}`))?.['requestId']);

  // The super-admin checks and validates.
  const admin = await otherPage(browser, info);
  const { uid: adminUid } = await adminMember(admin, 'super');
  await admin.goto('/admin#paiements');
  const card = admin.locator(`[data-payment="${requestId}"]`);
  await expect(card).toContainText(/2\s000\sF\sCFA/);
  await expect(card).toContainText('MTN Mobile Money');
  await expect(card).toContainText('MP261002.9999');
  await expect(card.getByRole('img', { name: 'Capture d’écran du paiement' })).toBeVisible();
  await expect(card.getByText(/Si vous validez : mise en avant jusqu’au/)).toBeVisible();
  await card.getByRole('button', { name: 'Valider' }).click();
  await expect(admin.getByText('Paiement validé : la mise en avant est active.')).toBeVisible();
  await expect(card).toHaveCount(0);

  // One batch: listing promoted for 7 days, request handled, lock gone, audited.
  const listing = await readDoc(`listings/${id}`);
  expect(listing?.['rank']).toBe(2);
  const until = (listing?.['boostUntil'] as Date).getTime();
  expect(Math.abs(until - (Date.now() + 7 * DAY))).toBeLessThan(5 * 60_000);
  expect(await readDoc(`boostRequests/${requestId}`)).toMatchObject({
    status: 'approved',
    handledBy: adminUid,
    rejectReason: null,
  });
  expect(await readDoc(`pendingBoosts/${id}`)).toBeNull();
  expect(await auditOf(`listings/${id}`)).toMatchObject({ action: 'boost.approve', actorUid: adminUid });
  expect(await auditOf(`boostRequests/${requestId}`)).toMatchObject({
    action: 'boost.approve',
    targetType: 'boostRequest',
  });

  // Visitors: at the head of the feed, in the Premium banner.
  await page.addInitScript((c) => localStorage.setItem('nx-city', c), city);
  await page.goto('/');
  const feed = page.locator('.feed__grid > li[data-listing]');
  await expect(feed.first()).toHaveAttribute('data-listing', id);
  await expect(feed.nth(1)).toHaveAttribute('data-listing', newer1.id);
  await expect(feed.nth(2)).toHaveAttribute('data-listing', newer2.id);
  await expect(page.locator(`.feed__grid [data-listing="${id}"] .tag--premium`)).toHaveText('Premium');
  const banner = page.getByRole('region', { name: 'Annonces Premium' });
  await expect(banner.locator(`li:not([aria-hidden]) a[href*="${id}"]`).first()).toBeVisible();

  // The member's notification.
  await page.goto('/compte');
  await expect(page.getByText('Mise en avant Premium validée')).toBeVisible();
  expect(uid).toBe(id.split('_')[0]);
  await admin.context().close();
});

test('payment rejected with a mandatory reason → notification with the reason', async ({ page }) => {
  test.setTimeout(120_000);
  const owner = `pay${Date.now().toString(36)}`;
  const id = listingId(owner, 1);
  await writeDoc(`listings/${id}`, demoListing({ uid: owner, title: 'Annonce à refuser' }));
  const requestId = `req${Date.now().toString(36)}`;
  await writeDoc(`boostRequests/${requestId}`, {
    listingId: id,
    ownerUid: owner,
    tier: 'sponsored',
    operator: 'orange',
    amount: 500,
    txRef: null,
    screenshot: PHOTO_DATA_URL,
    status: 'pending',
    rejectReason: null,
    createdAt: new Date(),
    handledBy: null,
    handledAt: null,
  });
  await writeDoc(`pendingBoosts/${id}`, { requestId, createdAt: new Date() });

  await adminMember(page, 'super');
  await page.goto('/admin#paiements');
  const card = page.locator(`[data-payment="${requestId}"]`);
  await expect(card).toContainText('Orange Money');
  await expect(card).toContainText('aucune');
  await card.getByRole('button', { name: 'Rejeter' }).click();
  await card.locator('form').getByRole('button', { name: 'Rejeter' }).click();
  await expect(card.getByText('Indiquez un motif (3 caractères minimum).')).toBeVisible();
  await card.getByRole('button', { name: 'Montant incorrect' }).click();
  await card.locator('form').getByRole('button', { name: 'Rejeter' }).click();
  await expect(page.getByText('Paiement rejeté.')).toBeVisible();

  expect(await readDoc(`boostRequests/${requestId}`)).toMatchObject({
    status: 'rejected',
    rejectReason: 'Montant incorrect',
  });
  expect(await readDoc(`pendingBoosts/${id}`)).toBeNull();
  expect((await readDoc(`listings/${id}`))?.['rank']).toBe(0);
});

test('5 removals by a moderator → publication blocked; the super-admin lifts it', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(240_000);
  // Hidden by reports: they head the « Signalements » tab.
  const { m, uid, ids } = await memberWithListings(page, 5, { hidden: true, reportsCount: 10 });

  const mod = await otherPage(browser, info);
  const { uid: modUid } = await adminMember(mod, 'moderator');
  await mod.goto('/admin#signalements');
  for (const [i, id] of ids.entries()) {
    const row = mod.locator(`[data-listing="${id}"]`);
    await row.getByRole('button', { name: 'Supprimer' }).click();
    await row.getByRole('button', { name: 'Photos volées ou d’une autre personne' }).click();
    await row.locator('form').getByRole('button', { name: 'Supprimer' }).click();
    await expect(
      mod.getByText(i === 4 ? /5 strikes : publication bloquée/ : `Annonce supprimée. ${i + 1} strike`),
    ).toBeVisible();
    await expect(row).toHaveCount(0);
  }
  expect(await readDoc(`users/${uid}`)).toMatchObject({ strikes: 5, publishBanned: true });
  expect(await readDoc(`listings/${ids[0]}`)).toMatchObject({
    status: 'removed',
    removedReason: 'Photos volées ou d’une autre personne',
  });
  expect(await auditOf(`users/${uid}`)).toMatchObject({ action: 'user.strike', actorUid: modUid });

  // The member: notified (5 notifications: the 3 latest shown, « Voir les 5 » for the rest), and
  // blocked on /publier.
  await page.goto('/compte');
  await expect(page.locator('.note')).toHaveCount(3);
  await page.getByRole('button', { name: 'Voir les 5 notifications' }).click();
  await expect(page.getByText(/Annonce supprimée : « Annonce 1 de/)).toBeVisible();
  await page.goto('/publier');
  await expect(page.getByText(/La publication est bloquée sur ce compte/)).toBeVisible({ timeout: 15_000 });

  // The super-admin finds the member and lifts the ban.
  const boss = await otherPage(browser, info);
  await adminMember(boss, 'super');
  await boss.goto('/admin#utilisateurs');
  await boss.getByLabel('Pseudo ou identifiant du membre').fill(m.pseudo);
  await boss.getByRole('button', { name: 'Rechercher' }).click();
  const card = boss.locator(`[data-member-card="${uid}"]`);
  await expect(card.locator('[data-strikes]')).toHaveText('5');
  await expect(card.locator('[data-publication]')).toHaveText('Bloquée');
  await card.getByRole('button', { name: 'Débloquer la publication' }).click();
  await expect(card.locator('[data-publication]')).toHaveText('Autorisée');
  expect(await readDoc(`users/${uid}`)).toMatchObject({ strikes: 5, publishBanned: false });

  await page.goto('/publier');
  await expect(page.getByText(/La publication est bloquée sur ce compte/)).toHaveCount(0);
  await expectNoRawFirebaseText(page);
  await mod.context().close();
  await boss.context().close();
});

test('badge: the member sends an ID photo, the super-admin grants it (photo erased)', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const { uid, ids } = await memberWithListings(page, 1);
  await page.goto('/compte');
  // Inside the single profile block (owner's request of 3 Oct 2026): « Demander la vérification ».
  const block = page.locator('.card--profile [data-badge-block]');
  await block.getByRole('button', { name: 'Demander la vérification' }).click();
  await block.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(block.getByText('Ajoutez la photo de votre pièce d’identité.')).toBeVisible();
  await block.locator('[data-badge-input]').setInputFiles(PHOTO_FIXTURE);
  await expect(block.getByRole('img', { name: 'Pièce d’identité choisie' })).toBeVisible();
  await block.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(block.getByText(/en attente de vérification par la modération/)).toBeVisible();
  const sent = await readDoc(`verificationRequests/${uid}`);
  expect(sent?.['status']).toBe('pending');
  const jpeg = Buffer.from(String(sent?.['idImage']).split(',')[1] ?? '', 'base64').toString('latin1');
  expect(jpeg).not.toContain('EXIF-MARKER-SECRET');

  const admin = await otherPage(browser, info);
  await adminMember(admin, 'super');
  await admin.goto('/admin#badges');
  const card = admin.locator(`[data-badge="${uid}"]`);
  await expect(card.getByRole('img')).toBeVisible();
  await card.getByRole('button', { name: 'Accorder le badge' }).click();
  await expect(admin.getByText('Badge accordé. La photo de la pièce est effacée.')).toBeVisible();

  expect(await readDoc(`verificationRequests/${uid}`)).toMatchObject({ status: 'approved', idImage: null });
  expect((await readDoc(`publicProfiles/${uid}`))?.['verified']).toBe(true);
  await expect.poll(async () => (await readDoc(`listings/${ids[0]}`))?.['verified']).toBe(true);

  await page.goto('/compte');
  await expect(page.locator('.card--profile').getByText('Compte vérifié')).toBeVisible();
  await expect(page.locator('.card--profile [data-badge-block] button')).toHaveCount(0);
  await expect(page.getByText('Badge vérifié accordé')).toBeVisible();
  await admin.context().close();
});

test('promotion granted by hand, then withdrawn (super-admin)', async ({ page, browser }, info) => {
  test.setTimeout(180_000);
  const { uid, ids } = await memberWithListings(page, 1);
  const id = ids[0] ?? '';
  const admin = await otherPage(browser, info);
  await adminMember(admin, 'super');
  await admin.goto('/admin#mises-en-avant');
  await admin.getByLabel('Pseudo ou identifiant du membre').fill(uid);
  await admin.getByRole('button', { name: 'Rechercher' }).click();
  const row = admin.locator(`[data-member-card="${uid}"] [data-listing="${id}"]`);
  await row.getByLabel('Mise en avant').selectOption('1');
  await row.getByLabel('Durée').selectOption('none');
  await row.getByRole('button', { name: 'Appliquer' }).click();
  await expect(admin.getByText('Mise en avant enregistrée.')).toBeVisible();
  expect(await readDoc(`listings/${id}`)).toMatchObject({ rank: 1, boostUntil: null });

  // Listed in « Mises en avant en cours », withdrawn from there.
  const current = admin
    .locator('.card', { has: admin.locator('#promoted-title') })
    .locator(`[data-listing="${id}"]`);
  await expect(current.getByText('sans fin')).toBeVisible();
  await current.getByRole('button', { name: 'Retirer' }).click();
  await expect(admin.getByText('Mise en avant retirée.')).toBeVisible();
  expect(await readDoc(`listings/${id}`)).toMatchObject({ rank: 0, boostUntil: null });
  expect(await auditOf(`listings/${id}`)).toMatchObject({ action: 'listing.unpromote' });
  await admin.context().close();
});

test('deletion request: listed in Utilisateurs, erased by the super-admin, sign-in left to finish', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const { m, uid, ids } = await memberWithListings(page, 1);
  const id = ids[0] ?? '';
  // State written by the member's request (tests/e2e/accounts.spec.ts covers the request itself).
  const user = await readDoc(`users/${uid}`);
  await writeDoc(`users/${uid}`, { ...user, deletionRequestedAt: new Date(Date.now() - 3 * 86_400_000) });
  await writeDoc(`listings/${id}`, { ...(await readDoc(`listings/${id}`)), status: 'closed' });

  const admin = await otherPage(browser, info);
  await adminMember(admin, 'super');
  await admin.goto('/admin#utilisateurs');
  const requests = admin.getByRole('region', { name: /Demandes de suppression/ });
  const row = requests.locator(`[data-member-row="${uid}"]`);
  await expect(row).toContainText(m.pseudo);
  await expect(row).toContainText(/effacement automatique le/);
  // Every member, page by page, below.
  await expect(
    admin.getByRole('region', { name: 'Tous les membres' }).locator('[data-member-row]').first(),
  ).toBeVisible();

  await row.getByRole('button', { name: 'Ouvrir' }).click();
  const card = admin.locator(`[data-member-card="${uid}"]`);
  await expect(card.locator('[data-deletion]')).toContainText('Demandée le');
  // Still sanctionable while the deletion is pending (no escape from a ban).
  await expect(card.getByRole('button', { name: 'Bloquer la publication' })).toBeVisible();
  await card.getByRole('button', { name: 'Effacer définitivement' }).click();
  await card.getByLabel('Motif').fill('Demande du membre');
  await card.getByRole('button', { name: 'Effacer définitivement' }).click();
  await expect(admin.getByText('Compte effacé.')).toBeVisible();

  for (const path of [
    `users/${uid}`,
    `publicProfiles/${uid}`,
    `listings/${id}`,
    `usernames/${m.pseudo.toLowerCase()}`,
  ]) {
    expect(await readDoc(path), path).toBeNull();
  }
  const tomb = await readDoc(`deletedAccounts/${uid}`);
  expect(await readDoc(`auditLog/${String(tomb?.['auditId'])}`)).toMatchObject({
    action: 'user.erase',
    targetType: 'user',
    targetId: uid,
    reason: 'Demande du membre',
  });
  await expect(admin.locator(`[data-member-row="${uid}"]`)).toHaveCount(0);

  // The member, still signed in on their phone: asked to finish the deletion (sign-in account).
  await page.goto('/compte');
  await expect(page.locator('h1')).toHaveText('Suppression à terminer');
  await admin.context().close();
});

test('super-admin: scrolling tab bar, promote from Récentes, verified list, one toast per removal', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const listing = await seedListing({ title: 'Annonce récente à promouvoir', createdAt: new Date() });
  const verified = `ver${Date.now().toString(36)}`;
  await writeDoc(`publicProfiles/${verified}`, {
    pseudo: `Ver${verified.slice(-6)}`,
    photoUrl: null,
    memberSince: new Date(),
    verified: true,
  });
  await adminMember(page, 'super');

  // Tab bar: wider than the phone → faded edge and arrow on the right, then on the left.
  await page.goto('/admin#signalements');
  const wrap = page.locator('.adm-tabs-wrap');
  await expect(wrap).toHaveClass(/adm-tabs-wrap--after/);
  await expect(wrap).not.toHaveClass(/adm-tabs-wrap--before/);
  await page.getByRole('button', { name: 'Onglets suivants' }).click();
  await expect(wrap).toHaveClass(/adm-tabs-wrap--before/);
  expect(await page.locator('.adm-tabs').evaluate((n) => n.scrollLeft)).toBeGreaterThan(0);

  // Récentes: « Mettre en avant » (level and duration), audited.
  await page.goto('/admin#recentes');
  const row = page.locator(`[data-listing="${listing.id}"]`);
  await row.getByRole('button', { name: 'Mettre en avant' }).click();
  await row.getByLabel('Mise en avant').selectOption('2');
  await row.getByLabel('Durée').selectOption('7');
  await row.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.getByText('Mise en avant enregistrée.')).toBeVisible();
  await expect(row.locator('.tag--premium')).toHaveText('Premium');
  expect((await readDoc(`listings/${listing.id}`))?.['rank']).toBe(2);
  expect(await auditOf(`listings/${listing.id}`)).toMatchObject({ action: 'listing.promote' });

  // Mises en avant: a double tap on « Retirer » writes and announces once.
  await page.goto('/admin#mises-en-avant');
  const current = page
    .locator('.card', { has: page.locator('#promoted-title') })
    .locator(`[data-listing="${listing.id}"]`);
  await current.getByRole('button', { name: 'Retirer' }).dblclick();
  await expect(page.getByText('Mise en avant retirée.')).toHaveCount(1);
  expect((await readDoc(`listings/${listing.id}`))?.['rank']).toBe(0);

  // Badges: every verified member, badge removed from the list (audited).
  await page.goto('/admin#badges');
  const line = page.locator(`[data-verified="${verified}"]`);
  await line.getByRole('button', { name: 'Retirer le badge' }).click();
  await expect(page.getByText('Badge retiré.')).toBeVisible();
  await expect(line).toHaveCount(0);
  expect((await readDoc(`publicProfiles/${verified}`))?.['verified']).toBe(false);
});

test('per-account cap of active listings: set, used by « Mes annonces », back to the general one', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const { uid } = await memberWithListings(page, 1);
  const admin = await otherPage(browser, info);
  await adminMember(admin, 'super');
  await admin.goto('/admin#utilisateurs');
  await admin.getByLabel('Pseudo ou identifiant du membre').fill(uid);
  await admin.getByRole('button', { name: 'Rechercher' }).click();
  const card = admin.locator(`[data-member-card="${uid}"]`);
  const field = card.getByLabel('Annonces autorisées pour ce compte');
  await expect(card.getByText('Ce compte suit le réglage général.')).toBeVisible();
  await field.fill('99');
  await card.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(card.getByText('Nombre entier de 0 à 50.')).toBeVisible();
  await field.fill('12');
  await card.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(admin.getByText('Plafond du compte enregistré.')).toBeVisible();
  expect((await readDoc(`users/${uid}`))?.['maxListings']).toBe(12);
  expect(await auditOf(`users/${uid}`)).toMatchObject({ action: 'user.listing_cap', targetId: uid });

  // The member sees the new cap.
  await page.goto('/compte');
  await expect(page.locator('#annonces')).toContainText('1 / 12');

  await card.getByRole('button', { name: 'Revenir au réglage général' }).click();
  await expect(admin.getByText('Le compte suit de nouveau le réglage général.')).toBeVisible();
  expect((await readDoc(`users/${uid}`))?.['maxListings']).toBeNull();
  await admin.context().close();
});
