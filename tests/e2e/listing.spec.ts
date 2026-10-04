/** Phase 5: listing page (WhatsApp, Appeler, J'aime, Partager, Signaler, views) and member page. */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { readDoc, writeDoc } from '../../scripts/emulator.ts';
import { cityFor, seedListing } from './feed-fixtures';
import { mockCloudinary, verifiedMember } from './helpers';

const listingUrl = (id: string) => `/annonce?id=${encodeURIComponent(id)}`;

async function waitForField(path: string, field: string, value: unknown): Promise<void> {
  await expect.poll(async () => (await readDoc(path))?.[field], { timeout: 10_000 }).toEqual(value);
}

test('WhatsApp: number read only on tap, wa.me link with the prefilled message', async ({ page }, info) => {
  const city = cityFor(info, 'contact');
  const title = 'Sortie & discussion ?';
  const l = await seedListing({ citySlug: city, title, contactMode: 'call_message' });
  const digits = l.whatsapp.replace('+', '');
  let opened = '';
  await page.route('https://wa.me/**', async (route) => {
    opened = route.request().url();
    await route.fulfill({ contentType: 'text/html', body: '<p>wa.me</p>' });
  });
  const contactReads: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/private/contact') || r.postData()?.includes('private/contact'))
      contactReads.push(r.url());
  });

  await page.goto(listingUrl(l.id));
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  // Before the tap: no request for the contact, number nowhere in the page.
  expect(contactReads).toEqual([]);
  const html = await page.content();
  expect(html).not.toContain(digits.slice(3));
  // (The floating support button links to the support number, never to the author's.)
  expect(html).not.toContain(`wa.me/${digits}`);
  await expect(page.getByRole('button', { name: 'Appeler' })).toBeVisible();

  await page.getByRole('button', { name: 'Contacter sur WhatsApp' }).click();
  await expect.poll(() => opened).not.toBe('');
  const url = new URL(opened);
  expect(`${url.origin}${url.pathname}`).toBe(`https://wa.me/${digits}`);
  expect(url.searchParams.get('text')).toBe(
    `Bonjour, je vous contacte depuis NIOXXER au sujet de votre annonce « ${title} ».`,
  );
});

test('« Messages uniquement »: no Appeler button', async ({ page }, info) => {
  const l = await seedListing({ citySlug: cityFor(info, 'contact'), contactMode: 'message' });
  await page.goto(listingUrl(l.id));
  await expect(page.getByRole('button', { name: 'Contacter sur WhatsApp' })).toBeVisible();
  await expect(page.getByText('Messages WhatsApp uniquement')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Appeler' })).toHaveCount(0);
});

test('J’aime: one per visitor (anonymous session), undone by a second tap', async ({ page }, info) => {
  const l = await seedListing({ citySlug: cityFor(info, 'social'), likes: 0 });
  await page.goto(listingUrl(l.id));
  const like = page.getByRole('button', { name: /J’aime|Vous aimez/ });
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await expect(like.locator('.action__count')).toHaveText('1');
  await waitForField(`listings/${l.id}`, 'likes', 1);

  // Same visitor after a reload: still liked, still 1 (no second like).
  await page.reload();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await waitForField(`listings/${l.id}`, 'likes', 0);

  // Even if the browser forgot it, the stored like decides (a tap never counts twice).
  await like.click();
  await waitForField(`listings/${l.id}`, 'likes', 1);
  await page.evaluate(() => localStorage.removeItem('nx-liked'));
  await page.reload();
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await like.click();
  await waitForField(`listings/${l.id}`, 'likes', 0);
});

test('views: counted once per browser and per day', async ({ page, browser }, info) => {
  const l = await seedListing({ citySlug: cityFor(info, 'social'), views: 0 });
  await page.goto(listingUrl(l.id));
  await waitForField(`listings/${l.id}`, 'views', 1);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(1000);
  expect((await readDoc(`listings/${l.id}`))?.['views']).toBe(1);
  const other = await browser.newPage();
  await other.goto(listingUrl(l.id));
  await waitForField(`listings/${l.id}`, 'views', 2);
  await other.close();
});

test('Partager: without the share sheet, the link is copied', async ({ browser }, info) => {
  const l = await seedListing({ citySlug: cityFor(info, 'social') });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
  });
  await page.goto(listingUrl(l.id));
  await page.getByRole('button', { name: 'Partager' }).click();
  await expect(page.getByText('Lien copié.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${new URL(page.url()).origin}/annonce?id=${encodeURIComponent(l.id)}`,
  );
  await context.close();
});

async function reportAs(browser: Browser, id: string, reason: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(listingUrl(id));
  await page.getByRole('button', { name: 'Signaler' }).click();
  const dialog = page.getByRole('dialog', { name: 'Signaler cette annonce' });
  await dialog.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Choisissez un motif.');
  await dialog.getByRole('radio', { name: reason, exact: true }).check();
  await dialog.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(page.getByText('Merci. Le signalement a été transmis à la modération.')).toBeVisible();
  return page;
}

test('reports: anonymous ones are stored but never hide; the 10th from a verified account hides', async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const city = cityFor(info, 'reports');
  // 9 reports of verified accounts already counted (owner's decision of 3 Oct 2026).
  const l = await seedListing({ citySlug: city, reportsCount: 9 });
  const anon = await reportAs(browser, l.id, 'La personne semble mineure');
  // The same visitor cannot report twice (browser memory, then the rules).
  await anon.getByRole('button', { name: 'Signaler' }).click();
  await expect(anon.getByText('Vous avez déjà signalé cette annonce.')).toBeVisible();
  await anon.evaluate(() => localStorage.removeItem('nx-reported'));
  await anon.getByRole('button', { name: 'Signaler' }).click();
  const dialog = anon.getByRole('dialog', { name: 'Signaler cette annonce' });
  await dialog.getByRole('radio', { name: 'Autre', exact: true }).check();
  await dialog.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(anon.getByText('Vous avez déjà signalé cette annonce.').last()).toBeVisible();
  await anon.close();
  // Stored for the moderation, not counted: still 9, still visible.
  expect(await readDoc(`listings/${l.id}`)).toMatchObject({ reportsCount: 9, hidden: false });

  // A verified member: counted, 10 → hidden.
  const memberPage = await browser.newPage();
  await mockCloudinary(memberPage);
  await verifiedMember(memberPage);
  await memberPage.goto(listingUrl(l.id));
  await memberPage.getByRole('button', { name: 'Signaler' }).click();
  const d2 = memberPage.getByRole('dialog', { name: 'Signaler cette annonce' });
  await d2.getByRole('radio', { name: 'Faux profil', exact: true }).check();
  await d2.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(memberPage.getByText('Merci. Le signalement a été transmis à la modération.')).toBeVisible();
  await memberPage.close();
  expect(await readDoc(`listings/${l.id}`)).toMatchObject({ reportsCount: 10, hidden: true });

  const visitor = await browser.newPage();
  await visitor.goto(listingUrl(l.id));
  await expect(visitor.getByRole('heading', { name: 'Cette annonce n’est plus disponible' })).toBeVisible();
  await visitor.close();
});

test('member page: profile and shown listings only', async ({ page }, info) => {
  const city = cityFor(info, 'member');
  const uid = `member${Date.now().toString(36)}${info.project.name.slice(-3)}`;
  const a = await seedListing({ uid, slot: 1, citySlug: city, pseudo: 'Aurore237', verified: true, rank: 1 });
  const b = await seedListing({ uid, slot: 2, citySlug: city, pseudo: 'Aurore237', verified: true });
  const hidden = await seedListing({
    uid,
    slot: 3,
    citySlug: city,
    pseudo: 'Aurore237',
    verified: true,
    hidden: true,
  });
  await writeDoc(`publicProfiles/${uid}`, {
    pseudo: 'Aurore237',
    photoUrl: null,
    memberSince: new Date(Date.now() - 40 * 86_400_000),
    verified: true,
  });
  await page.goto(listingUrl(b.id));
  await page.getByRole('link', { name: /Voir son profil et ses annonces/ }).click();
  await expect(page).toHaveURL(`/membre?u=${uid}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Aurore237');
  await expect(page.getByRole('img', { name: 'Profil vérifié' }).first()).toBeVisible();
  await expect(page.getByText('membre depuis 1 mois')).toBeVisible();
  const ids = await page
    .locator('li[data-listing]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-listing')));
  expect(ids).toEqual([a.id, b.id]); // sponsored first, hidden one absent
  expect(ids).not.toContain(hidden.id);
});

test('unknown listing and unknown member: honest message', async ({ page }) => {
  await page.goto('/annonce?id=inconnu_1');
  await expect(page.getByRole('heading', { name: 'Cette annonce n’est plus disponible' })).toBeVisible();
  await page.goto('/membre?u=inconnu');
  await expect(page.getByRole('heading', { name: 'Ce profil n’existe pas ou plus' })).toBeVisible();
});
