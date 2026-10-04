/**
 * Phase 3 — accounts, end to end against the Auth + Firestore emulators (npm run test:e2e).
 * E-mail links are taken from the Auth emulator API (oobCodes) instead of a real mailbox.
 */
import { expect, test } from '@playwright/test';
import {
  applyPasswordReset,
  createAuthUser,
  deleteDocument,
  docExists,
  readDoc,
  uidOf,
  writeDoc,
} from '../../scripts/emulator.ts';
import { demoContact, demoListing, listingId } from '../../scripts/demo-data.ts';
import {
  birthYearsAgo,
  expectNoRawFirebaseText,
  fillSignUp,
  logIn,
  newMember,
  signUp,
  verify,
} from './helpers';

test.describe('accounts', () => {
  // Multi-page flows through the emulators; the first one also pays Vite's cold compile.
  test.describe.configure({ timeout: 60_000 });

  test('sign-up → verification link → account; publishing waits for the verification', async ({ page }) => {
    const m = newMember();
    await signUp(page, m);
    expect(await docExists(`usernames/${m.pseudo.toLowerCase()}`)).toBe(true);

    // Not verified yet: /publier sends to /verifier-email, /compte works with a notice.
    await page.goto('/publier');
    await expect(page).toHaveURL('/verifier-email?next=%2Fpublier');
    await page.getByRole('button', { name: 'J’ai vérifié mon e-mail' }).click();
    await expect(page.getByRole('alert')).toHaveText(/pas encore vérifié/);
    await page.goto('/compte');
    await expect(page.getByText('Votre e-mail n’est pas vérifié')).toBeVisible();

    await page.goto('/verifier-email');
    await verify(page, m);
    await expect(page.locator('#profile-name')).toHaveText(m.pseudo);
    await expect(page.getByText('25 ans')).toBeVisible();
    await expect(page.getByText('Votre e-mail n’est pas vérifié')).toHaveCount(0);
    await page.goto('/publier');
    await expect(page).toHaveURL('/publier');
    await expect(page.locator('h1')).toHaveText('Publier une annonce');
  });

  test('sign-up refuses a minor, missing terms and a disposable e-mail, in French', async ({ page }) => {
    const m = newMember();
    await fillSignUp(page, m, birthYearsAgo(18, -1));
    await page.getByRole('checkbox').uncheck();
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByText('NIOXXER est réservé aux personnes de 18 ans et plus.')).toBeVisible();
    await expect(page.getByText(/Vous devez accepter les Conditions/)).toBeVisible();
    await expect(page).toHaveURL(/\/connexion/);

    await page.getByLabel('Date de naissance').fill(birthYearsAgo(30));
    await page.getByRole('checkbox').check();
    await page.getByLabel('E-mail').fill(`e2e-${Date.now()}@yopmail.com`);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(
      page.getByText('Les adresses e-mail temporaires ne sont pas acceptées.', { exact: false }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/connexion/);
    await expectNoRawFirebaseText(page);
  });

  test('a pseudo already taken is refused, whatever its case', async ({ page }) => {
    const first = newMember();
    await signUp(page, first);
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL('/');

    const second = { ...newMember(), pseudo: first.pseudo.toUpperCase() };
    await fillSignUp(page, second);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByText('Ce pseudo est déjà pris. Choisissez-en un autre.')).toBeVisible();
    await expect(page).toHaveURL(/\/connexion/);
  });

  test('log in, wrong password in French, log out', async ({ page }) => {
    const m = newMember();
    await signUp(page, m);
    await verify(page, m);
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL('/');

    await logIn(page, m.email, 'mauvais-mot-de-passe');
    await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect.');
    await expectNoRawFirebaseText(page);

    await logIn(page, m.email, m.password);
    await expect(page).toHaveURL('/compte');
    await expect(page.locator('#profile-name')).toHaveText(m.pseudo);
  });

  test('forgotten password: reset link, then log in with the new password', async ({ page }) => {
    const m = newMember();
    await signUp(page, m);
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/connexion?tab=login');
    await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
    await expect(page.locator('h1')).toHaveText('Mot de passe oublié');
    await page.getByLabel('E-mail').fill(m.email);
    await page.getByRole('button', { name: 'Envoyer le lien' }).click();
    await expect(page.getByRole('status')).toContainText('Si un compte existe pour cette adresse');

    await applyPasswordReset(m.email, 'nouveau-mot-de-passe');
    await logIn(page, m.email, m.password);
    await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect.');
    await logIn(page, m.email, 'nouveau-mot-de-passe');
    // The reset link proves the address belongs to the user: Firebase marks it verified.
    await expect(page).toHaveURL('/compte');
    await expect(page.locator('#profile-name')).toHaveText(m.pseudo);
  });

  test('an account without profile (e.g. after Google) must fill the profile step', async ({ page }) => {
    const m = newMember();
    await createAuthUser(m.email, m.password);
    await logIn(page, m.email, m.password);
    await expect(page.locator('h1')).toHaveText('Complétez votre profil');
    await page.goto('/compte');
    await expect(page).toHaveURL('/connexion?step=profil&next=%2Fcompte');
    await expect(page.locator('h1')).toHaveText('Complétez votre profil');

    await page.getByLabel('Pseudo').fill(m.pseudo);
    await page.getByLabel('Date de naissance').fill(birthYearsAgo(40));
    await page.getByLabel('Profil').selectOption('couple');
    await page.getByLabel('Ville').selectOption('yaounde');
    await page.getByLabel('Numéro WhatsApp').fill('+237 677 00 11 22');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Enregistrer mon profil' }).click();
    await expect(page).toHaveURL(/\/verifier-email\?next=%2Fcompte/);
    await verify(page, m);
    await expect(page.locator('#profile-name')).toHaveText(m.pseudo);
  });

  test('city and WhatsApp are edited in « Mon compte » and kept after reload', async ({ page }) => {
    const m = newMember();
    await signUp(page, m);
    await verify(page, m);

    await page.getByLabel('Ville').selectOption('kribi');
    await page.getByLabel('Numéro WhatsApp').fill('abc');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Entrez un numéro WhatsApp camerounais valide')).toBeVisible();

    await page.getByLabel('Numéro WhatsApp').fill('655443322');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Coordonnées enregistrées.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Ville')).toHaveValue('kribi');
    await expect(page.getByLabel('Numéro WhatsApp')).toHaveValue('6 55 44 33 22');
  });

  test('deletion request: password confirmation, account frozen, listings off the site', async ({ page }) => {
    const m = newMember();
    await signUp(page, m);
    await verify(page, m);
    const uid = await uidOf(m.email, m.password);
    const id = listingId(uid, 1);
    await writeDoc(`listings/${id}`, demoListing({ uid, pseudo: m.pseudo, title: 'Annonce à fermer' }));
    await writeDoc(`listings/${id}/private/contact`, demoContact('+237699001122', 'message'));
    await page.reload();

    await page.getByRole('button', { name: 'Supprimer mon compte', exact: true }).click();
    await expect(page.getByText('Vos données sont gardées 60 jours au plus')).toBeVisible();
    await page.getByLabel('Confirmez avec votre mot de passe').fill('pas-le-bon');
    await page.getByRole('button', { name: 'Demander la suppression' }).click();
    await expect(page.getByText('E-mail ou mot de passe incorrect.')).toBeVisible();
    await expectNoRawFirebaseText(page);

    await page.getByLabel('Confirmez avec votre mot de passe').fill(m.password);
    await page.getByRole('button', { name: 'Demander la suppression' }).click();
    await expect(page.locator('h1')).toHaveText('Suppression demandée');
    await expect(page.getByText(/sera effacé définitivement au plus tard le/)).toBeVisible();

    // Frozen: request stored at server time, listing closed (gone for visitors), pseudo kept.
    const user = await readDoc(`users/${uid}`);
    expect(user?.['deletionRequestedAt']).toBeTruthy();
    expect((await readDoc(`listings/${id}`))?.['status']).toBe('closed');
    expect(await docExists(`usernames/${m.pseudo.toLowerCase()}`)).toBe(true);
    await page.goto('/publier');
    await expect(page.locator('h1')).toHaveText('Suppression demandée');
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL('/');
    await page.goto(`/annonce?id=${id}`);
    await expect(page.getByRole('heading', { name: 'Cette annonce n’est plus disponible' })).toBeVisible();
  });

  test('an interrupted deletion (sanctioned account) is finished at the next login', async ({ page }) => {
    const m = newMember();
    await signUp(page, m);
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL('/');
    // State left by a deletion cut after its Firestore batch: profile and pseudo gone, private
    // record kept (strikes > 0), Auth account still there.
    const uid = await uidOf(m.email, m.password);
    await writeDoc(`users/${uid}`, {
      email: m.email,
      birthDate: new Date(Date.UTC(1990, 0, 1)),
      genre: 'femme',
      city: 'douala',
      whatsapp: '+237699001122',
      termsVersion: '2026-10-1',
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      strikes: 1,
      publishBanned: false,
    });
    await deleteDocument(`publicProfiles/${uid}`);
    await deleteDocument(`usernames/${m.pseudo.toLowerCase()}`);

    await logIn(page, m.email, m.password);
    await expect(page.locator('h1')).toHaveText('Suppression à terminer');
    await page.getByLabel('Confirmez avec votre mot de passe').fill(m.password);
    await page.getByRole('button', { name: 'Terminer la suppression' }).click();
    await expect(page.locator('h1')).toHaveText('Votre compte a été supprimé');
    await logIn(page, m.email, m.password);
    await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect.');
  });

  test('protected pages send a visitor without session to /connexion', async ({ page }) => {
    for (const path of ['/compte', '/publier', '/booster', '/admin', '/verifier-email']) {
      await page.goto(path);
      await expect(page).toHaveURL(`/connexion?next=${encodeURIComponent(path)}`);
      await expect(page.locator('h1')).toHaveText('Connexion');
    }
  });
});
