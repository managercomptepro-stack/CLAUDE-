/**
 * Phase 4 — profile photo (sign-up and « Mon compte »), Cloudinary intercepted.
 */
import { expect, test } from '@playwright/test';
import { expectCleanJpeg, fillSignUp, mockCloudinary, newMember, PHOTO_FIXTURE, verify } from './helpers';

test.describe('profile photo', () => {
  test.describe.configure({ timeout: 60_000 });

  test('chosen at sign-up: compressed, EXIF/GPS removed, shown in « Mon compte »', async ({ page }) => {
    const cloud = await mockCloudinary(page);
    const m = newMember();
    await fillSignUp(page, m);
    await page.locator('input[type="file"]').setInputFiles(PHOTO_FIXTURE);
    const preview = page.locator('.avatar-picker img');
    await expect(preview).toHaveAttribute('src', /\/f_auto,q_auto,w_160\/v1790960020\/e2eavatar1/);
    expect(cloud.uploads).toHaveLength(1);
    expectCleanJpeg(cloud.uploads[0]!);
    expect(cloud.uploads[0]!.toString('latin1')).toContain('nioxxer_avatar');

    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page).toHaveURL(/\/verifier-email/, { timeout: 15_000 });
    await verify(page, m);
    await expect(page.locator('.profile-head img.avatar')).toHaveAttribute('src', /e2eavatar1/);
  });

  test('added, changed and removed in « Mon compte », kept after reload', async ({ page }) => {
    await mockCloudinary(page);
    const m = newMember();
    await fillSignUp(page, m);
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page).toHaveURL(/\/verifier-email/, { timeout: 15_000 });
    await verify(page, m);

    await expect(page.locator('.profile-head .avatar--empty')).toHaveText('T');
    await page.locator('input[type="file"]:not([data-badge-input])').setInputFiles(PHOTO_FIXTURE);
    await expect(page.getByText('Photo de profil enregistrée.')).toBeVisible();
    await expect(page.locator('.profile-head img.avatar')).toHaveAttribute('src', /e2eavatar1/);

    await page.getByRole('button', { name: 'Changer la photo' }).click();
    await page.locator('input[type="file"]:not([data-badge-input])').setInputFiles(PHOTO_FIXTURE);
    await expect(page.locator('.profile-head img.avatar')).toHaveAttribute('src', /e2eavatar2/);
    await page.reload();
    await expect(page.locator('.profile-head img.avatar')).toHaveAttribute('src', /e2eavatar2/);

    await page.getByRole('button', { name: 'Supprimer la photo' }).click();
    await expect(page.getByText('Photo de profil supprimée.')).toBeVisible();
    await expect(page.locator('.profile-head img.avatar')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.profile-head .avatar--empty')).toBeVisible();
  });

  test('a failed upload explains in French and can be retried', async ({ page }) => {
    const cloud = await mockCloudinary(page);
    cloud.failNext(1);
    const m = newMember();
    await fillSignUp(page, m);
    await page.locator('input[type="file"]').setInputFiles(PHOTO_FIXTURE);
    await expect(page.getByRole('alert')).toHaveText(
      'L’envoi de la photo a échoué. Vérifiez votre connexion et réessayez.',
    );
    await page.getByRole('button', { name: 'Réessayer l’envoi' }).click();
    await expect(page.locator('.avatar-picker img')).toHaveAttribute('src', /e2eavatar1/);
    expect(cloud.uploads).toHaveLength(2);
  });
});
