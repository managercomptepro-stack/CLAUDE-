/**
 * Phase 7: super-admin actions on shared state (settings, team, journal, « Nettoyage »). Run by
 * the « admin-global » project, after all the other tests (playwright.config.ts): a cleanup
 * would otherwise delete the expired listings other tests rely on.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { demoContact, demoListing, listingId } from '../../scripts/demo-data.ts';
import { readDoc, uidOf, writeDoc } from '../../scripts/emulator.ts';
import { DEMO_SETTINGS, SETTINGS_PATH } from '../../src/data/settings.ts';
import { adminMember, otherPage } from './admin-fixtures';
import { PHOTO_FIXTURE, verifiedMember } from './helpers';

const DAY = 86_400_000;

test('settings: validated, saved with their audit entry; team: add and remove a moderator; journal', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const { uid } = await adminMember(page, 'super');
  try {
    await page.goto('/admin#reglages');
    // Premium and Sponsorisé apart, each with its price and its days (owner, 3 Oct 2026).
    const premiumBox = page.getByRole('group', { name: 'Premium' });
    const sponsoredBox = page.getByRole('group', { name: 'Sponsorisé' });
    const premium = premiumBox.getByLabel('Prix (F CFA)');
    await expect(premium).toHaveValue('2000');
    await expect(premiumBox.getByLabel('Durée (jours)')).toHaveValue('7');
    await premium.fill('0');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Nombre entier de 1 à 1000000.')).toBeVisible();
    await premium.fill('2000');
    await sponsoredBox.getByLabel('Durée (jours)').fill('3');
    const orangeName = page.getByLabel('Nom du bénéficiaire').nth(1);
    await orangeName.fill('Bénéficiaire Orange e2e');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Réglages enregistrés.')).toBeVisible();
    const saved = await readDoc(SETTINGS_PATH);
    expect(saved?.['payment']).toMatchObject({ orange: { name: 'Bénéficiaire Orange e2e' } });
    expect(saved?.['prices']).toEqual(DEMO_SETTINGS.prices);
    expect(saved?.['boostDays']).toEqual({ premium: 7, sponsored: 3 });
    expect(await readDoc(`auditLog/${String(saved?.['auditId'])}`)).toMatchObject({
      action: 'settings.update',
      actorUid: uid,
      targetType: 'settings',
      targetId: 'public',
    });
  } finally {
    await writeDoc(SETTINGS_PATH, { ...DEMO_SETTINGS });
  }

  // Team: unknown account refused; a member added by e-mail, then removed (role « none »).
  const other = await otherPage(browser, info);
  const x = await verifiedMember(other);
  const xUid = await uidOf(x.email, x.password);
  await page.goto('/admin#equipe');
  const who = page.getByLabel('E-mail ou identifiant du membre');
  await who.fill('personne@exemple.cm');
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText('Aucun compte avec cet e-mail ou cet identifiant.')).toBeVisible();
  await who.fill(x.email.toUpperCase());
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText('Modérateur ajouté.')).toBeVisible();
  const row = page.locator(`[data-team="${xUid}"]`);
  await expect(row).toContainText(x.pseudo);
  expect(await readDoc(`admins/${xUid}`)).toMatchObject({ role: 'moderator', addedBy: uid });

  // The new moderator really has the moderator view.
  await other.goto('/admin');
  await expect(other.locator('.adm-tabs__tab')).toHaveCount(4);

  await row.getByRole('button', { name: 'Retirer' }).click();
  await expect(page.getByText('Modérateur retiré.')).toBeVisible();
  expect((await readDoc(`admins/${xUid}`))?.['role']).toBe('none');
  await other.goto('/admin');
  await expect(other.getByRole('heading', { name: 'Accès réservé à l’équipe' })).toBeVisible();

  // Journal: newest first, with readable labels.
  await page.goto('/admin#journal');
  await expect(page.locator('[data-audit="admin.remove"]').first()).toContainText('Modérateur retiré');
  await expect(page.locator('[data-audit="settings.update"]').first()).toContainText(
    'Bénéficiaire Orange e2e',
  );
  await other.context().close();
});

test('« Nettoyage »: expired listing erased, expired boost reset, old screenshot erased', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const expired = listingId(`clean${stamp}a`, 1);
  const boosted = listingId(`clean${stamp}b`, 1);
  const old = new Date(Date.now() - 200 * DAY);
  await writeDoc(
    `listings/${expired}`,
    demoListing({ uid: `clean${stamp}a`, createdAt: old, renewedAt: old }),
  );
  await writeDoc(`listings/${expired}/private/contact`, demoContact('+237690000000'));
  await writeDoc(`listings/${boosted}`, demoListing({ uid: `clean${stamp}b`, rank: 2, boostDays: -1 }));
  const requestId = `cleanreq${stamp}`;
  const fortyDaysAgo = new Date(Date.now() - 40 * DAY);
  await writeDoc(`boostRequests/${requestId}`, {
    listingId: boosted,
    ownerUid: `clean${stamp}b`,
    tier: 'premium',
    operator: 'mtn',
    amount: 2000,
    txRef: null,
    screenshot: `data:image/jpeg;base64,${readFileSync(PHOTO_FIXTURE).toString('base64')}`,
    status: 'approved',
    rejectReason: null,
    createdAt: fortyDaysAgo,
    handledBy: 'someone',
    handledAt: fortyDaysAgo,
  });

  const { uid } = await adminMember(page, 'super');
  await page.goto('/admin#nettoyage');
  await page.getByRole('button', { name: 'Analyser' }).click();
  const plan = page.locator('[data-cleanup-plan]');
  await expect(plan).toContainText(/\d+ annonces? expirées?/);
  await expect(plan).not.toContainText('0 annonce expirée');
  await expect(plan).not.toContainText('0 mise en avant expirée');
  await expect(plan).not.toContainText('0 capture');
  await page.getByRole('button', { name: 'Lancer le nettoyage' }).click();
  await expect(page.getByText(/Nettoyage terminé : \d+ éléments traités\./)).toBeVisible({ timeout: 30_000 });

  expect(await readDoc(`listings/${expired}`)).toBeNull();
  expect(await readDoc(`listings/${expired}/private/contact`)).toBeNull();
  expect(await readDoc(`listings/${boosted}`)).toMatchObject({ rank: 0, boostUntil: null });
  expect(
    await readDoc(`auditLog/${String((await readDoc(`listings/${boosted}`))?.['auditId'])}`),
  ).toMatchObject({
    action: 'listing.boost_expire',
    actorUid: uid,
  });
  expect((await readDoc(`boostRequests/${requestId}`))?.['screenshot']).toBeNull();
});

test('new terms version: accepted again before any account page; /aide follows the support number', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const m = await verifiedMember(page);
  const uid = await uidOf(m.email, m.password);
  expect(await readDoc(`users/${uid}`)).toMatchObject({ termsVersion: DEMO_SETTINGS.termsVersion });
  try {
    await writeDoc(SETTINGS_PATH, {
      ...DEMO_SETTINGS,
      termsVersion: '2099-01-1',
      supportWhatsApp: '+237699887766',
    });

    await page.goto('/aide');
    const link = page.locator('[data-support-link]');
    await expect(link).toHaveAttribute('href', /^https:\/\/wa\.me\/237699887766\?text=/);
    await expect(page.locator('[data-support-number]')).toHaveText('6 99 88 77 66');

    await page.goto('/compte');
    await expect(page.getByRole('heading', { name: 'Nos conditions ont changé' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Accepter et continuer' }).click();
    await expect(
      page.getByText('Vous devez accepter les Conditions d’utilisation et la Politique de confidentialité.'),
    ).toBeVisible();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Accepter et continuer' }).click();
    await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
    const user = await readDoc(`users/${uid}`);
    expect(user?.['termsVersion']).toBe('2099-01-1');
    expect(Date.now() - new Date(String(user?.['termsAcceptedAt'])).getTime()).toBeLessThan(120_000);

    await page.goto('/publier');
    await expect(page.getByRole('heading', { name: 'Nos conditions ont changé' })).toHaveCount(0);
  } finally {
    await writeDoc(SETTINGS_PATH, { ...DEMO_SETTINGS });
  }
});
