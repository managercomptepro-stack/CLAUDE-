/**
 * Phase 6 (PLAN): boost request with manual Mobile Money payment, one pending request per
 * listing, notification bell and computed reminders. Runs against the emulators.
 */
import { expect, test, type Page } from '@playwright/test';
import { demoListing, listingId, type DemoListingInput } from '../../scripts/demo-data.ts';
import { readDoc, uidOf, writeDoc } from '../../scripts/emulator.ts';
import { DATA_URL_MAX_CHARS } from '../../src/data/limits.ts';
import { DEMO_SETTINGS } from '../../src/data/settings.ts';
import { expectNoRawFirebaseText, mockCloudinary, PHOTO_FIXTURE, verifiedMember } from './helpers';

const DAY = 86_400_000;

/** Verified member (on /compte) with one listing in slot 1, written with the rules bypassed. */
async function memberWithListing(page: Page, extra: Partial<DemoListingInput> = {}) {
  await mockCloudinary(page);
  const m = await verifiedMember(page);
  const uid = await uidOf(m.email, m.password);
  const id = listingId(uid, 1);
  await writeDoc(
    `listings/${id}`,
    demoListing({ uid, pseudo: m.pseudo, title: 'Annonce à booster', ...extra }),
  );
  return { m, uid, id };
}

async function pollDoc(path: string, check: (d: Record<string, unknown> | null) => boolean) {
  await expect.poll(async () => check(await readDoc(path)), { timeout: 10_000 }).toBe(true);
}

test('boost request → shown as pending; a second request is impossible', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { uid, id } = await memberWithListing(page);

  // « Mes annonces » → Booster.
  await page.goto('/compte');
  const row = page.locator(`[data-listing="${id}"]`);
  await row.getByRole('link', { name: 'Booster' }).click();
  await expect(page).toHaveURL(`/booster?id=${id}`);

  // Step 1: tier, prices from settings.
  await expect(page.getByText('Étape 1 sur 3')).toBeVisible();
  const premium = page.getByRole('radio', { name: /Premium/ });
  await expect(premium).toBeChecked();
  await expect(page.locator('.offer--premium')).toContainText(/2\s000\sF\sCFA/);
  await expect(page.locator('.offer--sponsored')).toContainText(/500\sF\sCFA/);
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Step 2: operator.
  await expect(page.getByText('Étape 2 sur 3')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'MTN Mobile Money' })).toBeChecked();
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Step 3: payee set by the admin, exact amount, copy button.
  await expect(page.getByText('Étape 3 sur 3')).toBeVisible();
  const box = page.locator('.pay-box');
  await expect(box).toContainText('600 00 00 01');
  await expect(box).toContainText(DEMO_SETTINGS.payment.mtn.name);
  await expect(box).toContainText(/2\s000\sF\sCFA/);
  await page.getByRole('button', { name: 'Copier' }).click();
  await expect(page.getByText('Numéro copié.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('600000001');

  // The screenshot is required.
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();
  await expect(page.getByText('Ajoutez la capture d’écran du paiement.')).toBeVisible();
  await page.locator('[data-screenshot-input]').setInputFiles(PHOTO_FIXTURE);
  await expect(page.getByRole('img', { name: 'Capture d’écran choisie' })).toBeVisible();
  await page.getByLabel('Référence de la transaction (facultative)').fill('  MP261002.1234  ');
  await page.getByRole('button', { name: 'Envoyer ma demande' }).click();

  await expect(page.getByRole('heading', { name: 'Demande envoyée' })).toBeVisible();
  await expect(page.getByText('En attente de vérification')).toBeVisible();
  await expectNoRawFirebaseText(page);

  // Stored as the rules require: exact price, compressed JPEG without EXIF (GPS), lock set.
  const lock = await readDoc(`pendingBoosts/${id}`);
  expect(lock).not.toBeNull();
  const request = await readDoc(`boostRequests/${String(lock?.['requestId'])}`);
  expect(request).toMatchObject({
    listingId: id,
    ownerUid: uid,
    tier: 'premium',
    operator: 'mtn',
    amount: DEMO_SETTINGS.prices.premium,
    txRef: 'MP261002.1234',
    status: 'pending',
    rejectReason: null,
    handledBy: null,
  });
  const shot = String(request?.['screenshot']);
  expect(shot.startsWith('data:image/jpeg;base64,')).toBe(true);
  expect(shot.length).toBeLessThanOrEqual(DATA_URL_MAX_CHARS);
  const jpeg = Buffer.from(shot.split(',')[1] ?? '', 'base64').toString('latin1');
  expect(jpeg).not.toContain('Exif\x00\x00');
  expect(jpeg).not.toContain('EXIF-MARKER-SECRET');

  // « Mes annonces »: pending line, no second Booster button.
  await page.goto('/compte');
  await expect(row.getByText('Mise en avant : demande en attente de vérification')).toBeVisible();
  await expect(row.getByRole('link', { name: 'Booster' })).toHaveCount(0);

  // Coming back to /booster: the waiting screen, no form.
  await page.goto(`/booster?id=${id}`);
  await expect(page.getByRole('heading', { name: 'En attente de vérification' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer' })).toHaveCount(0);
});

test('boost refused for a listing that is not mine, expired or removed', async ({ page }) => {
  test.setTimeout(90_000);
  const { m, uid } = await memberWithListing(page, {
    renewedAt: new Date(Date.now() - 181 * DAY),
    createdAt: new Date(Date.now() - 181 * DAY),
  });
  await writeDoc(
    `listings/${listingId(uid, 2)}`,
    demoListing({ uid, slot: 2, pseudo: m.pseudo, title: 'Annonce retirée', status: 'removed' }),
  );

  await page.goto('/compte');
  await expect(page.locator('[data-listing]')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Booster' })).toHaveCount(0);

  await page.goto(`/booster?id=${listingId(uid, 1)}`);
  await expect(
    page.getByText('Cette annonce a expiré. Republiez-la avant de la mettre en avant.'),
  ).toBeVisible();
  await page.goto(`/booster?id=${listingId(uid, 2)}`);
  await expect(
    page.getByText(/supprimée par la modération : elle ne peut pas être mise en avant/),
  ).toBeVisible();
  await page.goto('/booster?id=someoneelse_1');
  await expect(page.getByText('Cette annonce est introuvable ou ne vous appartient pas.')).toBeVisible();
  await page.goto('/booster');
  await expect(page.getByText('Cette annonce est introuvable ou ne vous appartient pas.')).toBeVisible();
  await expectNoRawFirebaseText(page);
});

const badge = (page: Page) => page.locator('header [data-bell-count]');

test('bell: unread count on every page, list and reminders in /compte, gone after logout', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.locator('header [data-bell]')).toBeHidden();

  // Expires in ~5 days, Premium ending in 12 hours.
  const { uid, id } = await memberWithListing(page, {
    renewedAt: new Date(Date.now() - 175 * DAY),
    createdAt: new Date(Date.now() - 175 * DAY),
    rank: 2,
    boostDays: 0.5,
  });
  await writeDoc(`users/${uid}/notifications/n1`, {
    type: 'boost_rejected',
    title: 'Mise en avant refusée',
    body: 'Motif : capture illisible.',
    read: false,
    createdAt: new Date(),
  });

  // An account page recounts; a public page shows the stored count before any network call.
  await page.goto('/publier');
  await expect(badge(page)).toHaveText('1');
  await page.goto('/');
  await expect(page.locator('header [data-bell]')).toBeVisible();
  await expect(badge(page)).toHaveText('1');
  await expect(page.locator('header [data-bell]')).toHaveAttribute('aria-label', 'Notifications, 1 non lue');

  await page.locator('header [data-bell]').click();
  await expect(page).toHaveURL('/compte#notifications');
  const section = page.locator('#notifications');
  await expect(section.locator('[data-notification="n1"]')).toContainText('Mise en avant refusée');
  await expect(section.locator('[data-notification="n1"]')).toContainText('Nouveau');
  await expect(section.locator('[data-reminder="expiry"]')).toContainText(/expire dans [56] jours/);
  await expect(section.locator('[data-reminder="boostEnding"]')).toContainText(
    /Premium sur « Annonce à booster » se termine (aujourd’hui|demain) à \d\d:\d\d/,
  );
  await expect(page.locator(`[data-listing="${id}"]`)).toContainText(
    /Premium : fin (aujourd’hui|demain) à \d\d:\d\d/,
  );

  // Shown = read; the badge empties.
  await pollDoc(`users/${uid}/notifications/n1`, (d) => d?.['read'] === true);
  await expect(badge(page)).toBeHidden();
  await page.goto('/');
  await expect(page.locator('header [data-bell]')).toBeVisible();
  await expect(badge(page)).toBeHidden();

  await page.goto('/compte');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('header [data-bell]')).toBeHidden();
});

test('a large phone screenshot is compressed under the Firestore limit (≤ 300 KB JPEG)', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async (max) => {
    // 1440×3120 « screenshot »: coloured bands, text-like strokes and grain (worse than a real one).
    const canvas = document.createElement('canvas');
    canvas.width = 1440;
    canvas.height = 3120;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < canvas.height; y += 120) {
      ctx.fillStyle = `hsl(${(y / 7) % 360} 60% ${y % 240 ? 92 : 35}%)`;
      ctx.fillRect(0, y, canvas.width, 120);
      ctx.fillStyle = '#222';
      for (let x = 40; x < canvas.width - 60; x += 18 + rand() * 30)
        ctx.fillRect(x, y + 40, 6 + rand() * 14, 34);
    }
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) img.data[i] = (img.data[i] ?? 0) ^ (rand() * 24);
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('no-blob');
    // Served by the Vite dev server (a variable path: resolved in the browser, not by TypeScript).
    const path = '/src/lib/image-compress.ts';
    const mod = (await import(path)) as typeof import('../../src/lib/image-compress');
    const url = await mod.compressToDataUrl(blob, max);
    return { input: blob.size, length: url.length, jpeg: url.startsWith('data:image/jpeg;base64,') };
  }, DATA_URL_MAX_CHARS);
  expect(result).toMatchObject({ jpeg: true });
  expect(result.input).toBeGreaterThan(1_000_000);
  expect(result.length).toBeLessThanOrEqual(DATA_URL_MAX_CHARS);
});
