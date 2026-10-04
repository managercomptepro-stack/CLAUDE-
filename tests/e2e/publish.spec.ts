/**
 * Phase 4 — publish, edit, republish, delete (PLAN phase 4), against the emulators with
 * Cloudinary intercepted (no real upload).
 */
import { expect, test, type Page } from '@playwright/test';
import { readDoc, uidOf, writeDoc } from '../../scripts/emulator.ts';
import { expectCleanJpeg, mockCloudinary, PHOTO_FIXTURE, verifiedMember, type Member } from './helpers';

async function fillListing(page: Page, title: string): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles([PHOTO_FIXTURE, PHOTO_FIXTURE]);
  await expect(page.locator('.photo-tile__img')).toHaveCount(2);
  await page.getByLabel('Titre').fill(title);
  await page.getByLabel('Description').fill('Rencontre simple et discrète, à discuter sur WhatsApp.');
  await page.getByLabel('Quartier').fill('Bonapriso');
}

async function uid(m: Member): Promise<string> {
  return uidOf(m.email, m.password);
}

test.describe('publish', () => {
  test.describe.configure({ timeout: 90_000 });

  test('publish, edit, republish, delete', async ({ page }) => {
    const cloud = await mockCloudinary(page);
    const m = await verifiedMember(page);
    const id = `${await uid(m)}_1`;

    // Publish: genre, city and WhatsApp are prefilled from the account.
    await page.goto('/publier');
    await expect(page.getByLabel('Profil')).toHaveValue('femme');
    await expect(page.getByLabel('Ville')).toHaveValue('douala');
    await expect(page.getByLabel('Numéro WhatsApp de l’annonce')).toHaveValue('6 99 00 11 22');
    await fillListing(page, 'Belle rencontre à Douala');
    await expect(page.getByText('24 / 60')).toBeVisible();
    await page.getByLabel('Appels et messages').check();
    await page.getByRole('button', { name: 'Publier mon annonce' }).click();
    await expect(page.locator('h1')).toHaveText('Votre annonce est en ligne');

    // Uploads: listing preset, EXIF/GPS removed.
    expect(cloud.uploads).toHaveLength(2);
    for (const body of cloud.uploads) {
      expectCleanJpeg(body);
      expect(body.toString('latin1')).toContain('nioxxer_listing');
    }
    // The public document never holds the WhatsApp number; the private contact does.
    const listing = await readDoc(`listings/${id}`);
    expect(listing).toMatchObject({
      title: 'Belle rencontre à Douala',
      status: 'active',
      contactMode: 'call_message',
      rank: 0,
      views: 0,
    });
    expect(listing?.['photos']).toEqual([
      expect.stringMatching(/^e2ephoto\w+:1600x1200$/),
      expect.any(String),
    ]);
    expect(JSON.stringify(listing)).not.toContain('699001122');
    expect(await readDoc(`listings/${id}/private/contact`)).toEqual({
      whatsapp: '+237699001122',
      callAllowed: true,
    });

    // « Mes annonces ».
    await page.getByRole('link', { name: 'Voir mes annonces' }).click();
    const row = page.locator(`[data-listing="${id}"]`);
    await expect(row.locator('.my-listing__title')).toHaveText('Belle rencontre à Douala');
    await expect(row).toContainText('En ligne jusqu’au');
    await expect(page.getByText('1 / 7 annonces')).toBeVisible();

    // Edit: new title, second photo becomes the main one.
    const photosBefore = listing?.['photos'] as string[];
    await row.getByRole('link', { name: 'Modifier' }).click();
    await expect(page.locator('h1')).toHaveText('Modifier mon annonce');
    await expect(page.getByLabel('Titre')).toHaveValue('Belle rencontre à Douala');
    await page.getByLabel('Titre').fill('Rencontre à Bonapriso');
    await page.getByRole('button', { name: 'Déplacer la photo 2 vers la gauche' }).click();
    await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(page.locator('h1')).toHaveText('Modifications enregistrées');
    const edited = await readDoc(`listings/${id}`);
    expect(edited?.['title']).toBe('Rencontre à Bonapriso');
    expect(edited?.['photos']).toEqual([photosBefore[1], photosBefore[0]]);

    // Republish: renewedAt moves to now.
    await page.goto('/compte');
    await row.getByRole('button', { name: 'Republier' }).click();
    await expect(page.getByText('Annonce republiée pour 6 mois.')).toBeVisible();
    const republished = await readDoc(`listings/${id}`);
    expect((republished?.['renewedAt'] as Date).getTime()).toBeGreaterThan(
      (edited?.['renewedAt'] as Date).getTime(),
    );

    // Delete (with confirmation): listing and private contact gone, slot free.
    await row.getByRole('button', { name: 'Supprimer' }).click();
    await expect(row).toContainText('Supprimer définitivement l’annonce « Rencontre à Bonapriso » ?');
    await row.getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.getByText('Annonce supprimée.')).toBeVisible();
    await expect(page.getByText('Vous n’avez pas encore d’annonce.')).toBeVisible();
    expect(await readDoc(`listings/${id}`)).toBeNull();
    expect(await readDoc(`listings/${id}/private/contact`)).toBeNull();
  });

  test('forbidden texts are refused before sending, in the owner’s words', async ({ page }) => {
    await mockCloudinary(page);
    await verifiedMember(page);
    await page.goto('/publier');
    await fillListing(page, 'Lycéenne de Douala');
    await page.getByLabel('Ce que je propose').fill('Une nuit pour 20000 fcfa');
    await page.getByRole('button', { name: 'Publier mon annonce' }).click();
    await expect(
      page.getByText('Ce texte contient un terme interdit (mineurs).', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText('Les prix ne sont pas autorisés dans l’annonce : vous en parlerez sur WhatsApp.'),
    ).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Publier une annonce');
  });

  test('without photo the listing is refused', async ({ page }) => {
    await verifiedMember(page);
    await page.goto('/publier');
    await page.getByLabel('Titre').fill('Rencontre à Yaoundé');
    await page.getByRole('button', { name: 'Publier mon annonce' }).click();
    await expect(page.getByText('Ajoutez de 1 à 5 photos.')).toBeVisible();
  });

  test('the cap of 7 listings is shown and enforced', async ({ page }) => {
    const m = await verifiedMember(page);
    const owner = await uid(m);
    for (let n = 1; n <= 7; n++) {
      await writeDoc(`listings/${owner}_${n}`, {
        ownerUid: owner,
        title: `Annonce ${n}`,
        photos: ['e2ephoto:1600x1200'],
        contactMode: 'message',
        rank: 0,
        boostUntil: null,
        views: 0,
        likes: 0,
        hidden: false,
        status: 'active',
        removedReason: null,
        createdAt: new Date(Date.now() - n * 1000),
        renewedAt: new Date(),
      });
    }
    await page.reload();
    await expect(page.getByText('7 / 7 annonces')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Publier une annonce' })).toHaveCount(0);
    await page.goto('/publier');
    await expect(page.locator('h1')).toHaveText('Plafond d’annonces atteint');
  });

  test('a new profile photo is copied onto the listings', async ({ page }) => {
    await mockCloudinary(page);
    const m = await verifiedMember(page);
    const id = `${await uid(m)}_1`;
    await page.goto('/publier');
    await fillListing(page, 'Rencontre à Kribi');
    await page.getByRole('button', { name: 'Publier mon annonce' }).click();
    await expect(page.locator('h1')).toHaveText('Votre annonce est en ligne');
    expect((await readDoc(`listings/${id}`))?.['profilePhotoUrl']).toBeNull();

    await page.goto('/compte');
    await page
      .locator('.avatar-picker input[type="file"], input[type="file"]')
      .first()
      .setInputFiles(PHOTO_FIXTURE);
    await expect(page.getByText('Photo de profil enregistrée.')).toBeVisible();
    await expect
      .poll(async () => (await readDoc(`listings/${id}`))?.['profilePhotoUrl'])
      .toMatch(/^https:\/\/res\.cloudinary\.com\/bcxiwwkh\/image\/upload\/v\d+\/e2eavatar\w+\.jpg$/);
  });
});
