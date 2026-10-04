/**
 * Phase 4 screenshots (docs/captures/phase-4/), on demand only (CAPTURES=1, inside
 * `firebase emulators:exec`). Cloudinary is intercepted.
 */
import { expect, test } from '@playwright/test';
import { fillSignUp, mockCloudinary, newMember, PHOTO_FIXTURE, verifiedMember, verify } from './helpers';

test.skip(!process.env['CAPTURES'], 'set CAPTURES=1 to regenerate docs/captures');

for (const theme of ['dark', 'light'] as const) {
  test(`profile photo screens, ${theme} theme`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const size = testInfo.project.name.replace('mobile-', '');
    await page.addInitScript((t) => {
      try {
        localStorage.setItem('nx-theme', t);
      } catch {
        /* ignore */
      }
    }, theme);
    const shot = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/captures/phase-4/${name}-${theme}-${size}.png` });
    };
    await mockCloudinary(page);
    const m = newMember();
    await fillSignUp(page, m);
    const picker = page.locator('.avatar-picker');
    await picker.scrollIntoViewIfNeeded();
    await shot('inscription-photo-vide');
    await page.locator('input[type="file"]').setInputFiles(PHOTO_FIXTURE);
    await expect(picker.locator('img')).toBeVisible();
    await shot('inscription-photo');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page).toHaveURL(/\/verifier-email/, { timeout: 15_000 });
    await verify(page, m);
    await expect(page.locator('.profile-head img.avatar')).toBeVisible();
    await shot('compte-photo');
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`publish screens, ${theme} theme`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const size = testInfo.project.name.replace('mobile-', '');
    await page.addInitScript((t) => {
      try {
        localStorage.setItem('nx-theme', t);
      } catch {
        /* ignore */
      }
    }, theme);
    const shot = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/captures/phase-4/${name}-${theme}-${size}.png` });
    };
    await mockCloudinary(page);
    await verifiedMember(page);
    await page.goto('/publier');
    await expect(page.locator('h1')).toHaveText('Publier une annonce');
    await shot('publier-vide');
    await page.locator('input[type="file"]').setInputFiles([PHOTO_FIXTURE, PHOTO_FIXTURE, PHOTO_FIXTURE]);
    await expect(page.locator('.photo-tile__img')).toHaveCount(3);
    await page.getByLabel('Titre').fill('Lycéenne de Douala');
    await page.getByLabel('Ce que je propose').fill('Une nuit pour 20000 fcfa');
    await page.getByRole('button', { name: 'Publier mon annonce' }).click();
    await page.locator('.photo-grid').scrollIntoViewIfNeeded();
    await shot('publier-erreurs');
    await page.getByLabel('Titre').fill('Belle rencontre à Douala');
    await page.getByLabel('Description').fill('Rencontre simple et discrète, à discuter sur WhatsApp.');
    await page.getByLabel('Ce que je propose').fill('Un moment agréable, sans prise de tête.');
    await page.getByLabel('Quartier').fill('Bonapriso');
    await page.getByRole('button', { name: 'Publier mon annonce' }).scrollIntoViewIfNeeded();
    await shot('publier-rempli-bas');
    await page.getByRole('button', { name: 'Publier mon annonce' }).click();
    await expect(page.locator('h1')).toHaveText('Votre annonce est en ligne');
    await shot('publier-succes');
    await page.getByRole('link', { name: 'Voir mes annonces' }).click();
    const list = page.locator('.my-listings');
    await expect(list).toBeVisible();
    await list.scrollIntoViewIfNeeded();
    await shot('mes-annonces');
  });
}
