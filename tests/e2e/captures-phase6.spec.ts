/**
 * Phase 6 screenshots (docs/captures/phase-6/), on demand only (CAPTURES=1, inside
 * `firebase emulators:exec`): every step of a boost request, the bell and the notifications.
 */
import { expect, test, type Page } from '@playwright/test';
import { demoListing, listingId } from '../../scripts/demo-data.ts';
import { uidOf, writeDoc } from '../../scripts/emulator.ts';
import { mockCloudinary, PHOTO_FIXTURE, verifiedMember } from './helpers';

test.skip(!process.env['CAPTURES'], 'set CAPTURES=1 to regenerate docs/captures');

const THEMES = ['dark', 'light'] as const;
const DAY = 86_400_000;

async function useTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('nx-theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
}

for (const theme of THEMES) {
  test(`boost steps, bell and notifications, ${theme} theme`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const size = testInfo.project.name.replace('mobile-', '');
    const shot = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/captures/phase-6/${name}-${theme}-${size}.png` });
    };
    await useTheme(page, theme);
    await mockCloudinary(page);
    const m = await verifiedMember(page);
    const uid = await uidOf(m.email, m.password);
    const id = listingId(uid, 1);
    await writeDoc(
      `listings/${id}`,
      demoListing({ uid, pseudo: m.pseudo, title: 'Soirée détente à Bonapriso' }),
    );
    // Second listing: Premium ending in a few hours, expiring in 5 days (computed reminders).
    await writeDoc(
      `listings/${listingId(uid, 2)}`,
      demoListing({
        uid,
        slot: 2,
        pseudo: m.pseudo,
        title: 'Balade à Kribi ce week-end',
        rank: 2,
        boostDays: 0.25,
        createdAt: new Date(Date.now() - 175 * DAY),
      }),
    );
    await writeDoc(`users/${uid}/notifications/n1`, {
      type: 'boost_rejected',
      title: 'Mise en avant refusée',
      body: 'Motif : la capture d’écran ne montre pas le montant.',
      read: false,
      createdAt: new Date(),
    });

    await page.goto(`/booster?id=${id}`);
    await expect(page.getByText('Étape 1 sur 3')).toBeVisible();
    await expect(page.locator('header [data-bell-count]')).toHaveText('1');
    await shot('booster-1-formule');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText('Étape 2 sur 3')).toBeVisible();
    await shot('booster-2-operateur');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText('Étape 3 sur 3')).toBeVisible();
    await shot('booster-3-paiement');
    await page.locator('[data-screenshot-input]').setInputFiles(PHOTO_FIXTURE);
    await expect(page.getByRole('img', { name: 'Capture d’écran choisie' })).toBeVisible();
    await page.getByLabel('Référence de la transaction (facultative)').fill('MP261002.1234');
    await page.getByRole('button', { name: 'Envoyer ma demande' }).scrollIntoViewIfNeeded();
    await shot('booster-3-capture');
    await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
    await expect(page.getByRole('heading', { name: 'Demande envoyée' })).toBeVisible();
    await shot('booster-4-envoyee');

    await page.goto(`/booster?id=${id}`);
    await expect(page.getByRole('heading', { name: 'En attente de vérification' })).toBeVisible();
    await shot('booster-deja-en-attente');

    await page.goto('/');
    await expect(page.locator('header [data-bell]')).toBeVisible();
    await page.locator('header [data-bell]').click();
    await expect(page.locator('#notifications [data-notification="n1"]')).toBeVisible();
    await expect(page.locator('#notifications [data-reminder="boostEnding"]')).toBeVisible();
    await shot('compte-notifications');
    await page.locator(`[data-listing="${id}"]`).scrollIntoViewIfNeeded();
    await expect(page.getByText('Mise en avant : demande en attente de vérification')).toBeVisible();
    await shot('compte-mes-annonces');
  });
}
