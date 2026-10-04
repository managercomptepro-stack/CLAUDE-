/** Phase 5: home feed, order, pagination, filters, city picker, city pages, banner. */
import { expect, test, type Page } from '@playwright/test';
import { readDoc } from '../../scripts/emulator.ts';
import { cityFor, hoursAgo, seedListing } from './feed-fixtures';

/** Opens the home page on `city` (remembered city, as after a previous choice). */
async function openHome(page: Page, city: string): Promise<void> {
  await page.addInitScript((c) => localStorage.setItem('nx-city', c), city);
  await page.goto('/');
}

async function feedIds(page: Page): Promise<string[]> {
  return page
    .locator('.feed__grid > li[data-listing]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-listing') ?? ''));
}

test('order: Premium, then Sponsored, then free, newest first in each group', async ({ page }, info) => {
  const city = cityFor(info, 'order');
  const s = (input: Parameters<typeof seedListing>[0]) => seedListing({ citySlug: city, ...input });
  const [freeNew, freeOld, sponNew, sponOld, premOld, premNew, ended, expired] = await Promise.all([
    s({ createdAt: hoursAgo(1) }),
    s({ createdAt: hoursAgo(5) }),
    s({ rank: 1, createdAt: hoursAgo(3) }),
    s({ rank: 1, createdAt: hoursAgo(10) }),
    s({ rank: 2, createdAt: hoursAgo(20) }),
    s({ rank: 2, createdAt: hoursAgo(2) }),
    // Premium whose end has passed: shown as free, at its free place (decision 2: reset).
    s({ rank: 2, boostDays: -1, createdAt: hoursAgo(0.5) }),
    // Older than 6 months, not yet removed by the maintenance job: never shown.
    s({ createdAt: hoursAgo(24 * 200) }),
  ]);
  await openHome(page, city);
  await expect(page.locator('.feed__status', { hasText: 'Vous avez vu toutes les annonces.' })).toBeVisible();
  expect(await feedIds(page)).toEqual(
    [premNew, premOld, sponNew, sponOld, ended, freeNew, freeOld].map((x) => x.id),
  );
  expect(await feedIds(page)).not.toContain(expired.id);
  await expect(page.locator(`[data-listing="${premNew.id}"] .tag--premium`)).toHaveText('Premium');
  await expect(page.locator(`[data-listing="${sponNew.id}"] .tag--sponsored`)).toHaveText('Sponsorisé');
  await expect(page.locator(`[data-listing="${ended.id}"] .tag`)).toHaveCount(0);
  await expect(page.locator(`[data-listing="${freeNew.id}"] .tag`)).toHaveCount(0);
  const healed = await readDoc(`listings/${ended.id}`);
  expect([healed?.['rank'], healed?.['boostUntil']]).toEqual([0, null]);

  // Premium rail (all cities, drawn at random): ours are there, Premium before Sponsored, not the ended one.
  const banner = page.getByRole('region', { name: 'Annonces Premium' });
  await expect(banner.locator(`a[href$="${premNew.id}"]`).first()).toBeVisible();
  const bannerLinks = await banner
    .locator('li:not([aria-hidden]) a')
    .evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).searchParams.get('id')));
  const at = (id: string) => bannerLinks.indexOf(id);
  for (const x of [premNew, premOld, sponNew, sponOld]) expect(at(x.id)).toBeGreaterThanOrEqual(0);
  expect(Math.max(at(premNew.id), at(premOld.id))).toBeLessThan(Math.min(at(sponNew.id), at(sponOld.id)));
  expect(bannerLinks).not.toContain(ended.id);
  // « Annonces récentes · N à … »: everything loaded, the exact number shown.
  await expect(page.locator('.headline__tally')).toHaveText(new RegExp(`^7 à `));
});

test('pagination by 20: no duplicate and no gap down to the end', async ({ page }, info) => {
  test.setTimeout(90_000);
  const city = cityFor(info, 'pagination');
  const seeded = await Promise.all(
    Array.from({ length: 45 }, (_, i) => seedListing({ citySlug: city, createdAt: hoursAgo(i + 1) })),
  );
  const expected = seeded.map((x) => x.id); // newest first
  await openHome(page, city);
  await expect(page.locator('.feed__grid > li[data-listing]')).toHaveCount(20);
  const end = page.locator('.feed__status', { hasText: 'Vous avez vu toutes les annonces.' });
  for (let i = 0; i < 10 && !(await end.isVisible()); i++) {
    await page.locator('.feed__sentinel').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await expect(end).toBeVisible();
  const ids = await feedIds(page);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual(expected);
});

test('search filters: several profiles, age range, kept in the address', async ({ page }, info) => {
  const city = cityFor(info, 'filters');
  const s = (genre: string, age: number) => seedListing({ citySlug: city, genre, age });
  const [femme25, homme30, couple40, femme45, trans22] = await Promise.all([
    s('femme', 25),
    s('homme', 30),
    s('couple', 40),
    s('femme', 45),
    s('trans', 22),
  ]);
  await page.goto(`/recherche?ville=${city}&profil=femme,couple&age=24-41`);
  await expect(page.locator('.feed__status', { hasText: 'Vous avez vu toutes les annonces.' })).toBeVisible();
  expect((await feedIds(page)).sort()).toEqual([femme25.id, couple40.id].sort());
  // One result per line (owner's request of 3 Oct 2026): as wide as the list, with the title.
  const grid = (await page.locator('.feed__grid').boundingBox())!;
  const card = page.locator(`[data-listing="${femme25.id}"]`);
  // Layout width (boundingBox would include the entrance animation's scale).
  expect(await card.evaluate((el) => (el as HTMLElement).offsetWidth)).toBeCloseTo(grid.width, 0);
  await expect(card.locator('.lcard__title')).not.toBeEmpty();

  // One more profile, by tapping its chip: the address follows.
  await page.getByRole('checkbox', { name: 'Homme' }).click();
  await expect(page).toHaveURL(new RegExp(`profil=femme,homme,couple&age=24-41`));
  await expect(page.locator(`[data-listing="${homme30.id}"]`)).toBeVisible();
  expect((await feedIds(page)).sort()).toEqual([femme25.id, homme30.id, couple40.id].sort());

  // Keyboard on the age slider: maximum to the end (70 et +), then minimum down to 18.
  const max = page.getByRole('slider', { name: 'Âge maximum' });
  await max.focus();
  await page.keyboard.press('End');
  await expect(page.locator('.age-range__value')).toHaveText('24 à 70 ans et +');
  await expect(page.locator(`[data-listing="${femme45.id}"]`)).toBeVisible();
  const min = page.getByRole('slider', { name: 'Âge minimum' });
  await min.focus();
  await page.keyboard.press('Home');
  await expect(page).toHaveURL(new RegExp(`/recherche\\?ville=${city}&profil=femme,homme,couple$`));
  await expect(page.locator('.feed__grid > li[data-listing]')).toHaveCount(4);
  expect(await feedIds(page)).not.toContain(trans22.id);

  // A reload keeps the filters.
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Homme' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Trans' })).not.toBeChecked();
});

test('empty city: honest message and Publier button, no fake content', async ({ page }, info) => {
  const city = cityFor(info, 'empty');
  await openHome(page, city);
  const name = city === 'kumba' ? 'Kumba' : 'Loum';
  await expect(page.getByRole('heading', { name: `Pas encore d’annonce à ${name}` })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Publier une annonce' })).toHaveAttribute('href', '/publier');
  // No card of this city (the Premium rail above shows every city: owner's decision of 3 Oct 2026).
  await expect(page.locator('.feed__grid')).toHaveCount(0);
});

test('city picker: search, choice remembered after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Ville : Douala/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Choisir une ville' });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Rechercher une ville').fill('yaou');
  await expect(dialog.locator('.city-list__item')).toHaveCount(1);
  await dialog.getByRole('button', { name: /Yaoundé/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /^Ville : Yaoundé/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /^Ville : Yaoundé/ })).toBeVisible();
});

test('« Autour de moi » picks the nearest city', async ({ browser }) => {
  const context = await browser.newContext({
    geolocation: { latitude: 2.94, longitude: 9.91 }, // Kribi
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: /^Ville : Douala/ }).click();
  await page.getByRole('button', { name: 'Autour de moi' }).click();
  await expect(page.getByRole('button', { name: /^Ville : Kribi/ })).toBeVisible();
  await context.close();
});

test('city page: own title, description, canonical and the same feed', async ({ page }, info) => {
  const city = cityFor(info, 'cityPage');
  const name = city === 'nkongsamba' ? 'Nkongsamba' : 'Edéa';
  const one = await seedListing({ citySlug: city });
  const response = await page.goto(`/ville/${city}`);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(`Rencontres à ${name} — NIOXXER`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `https://nioxxer.com/ville/${city}`,
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    new RegExp(`à ${name}\\.`),
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Annonces à ${name}`);
  await expect(page.locator(`[data-listing="${one.id}"]`)).toBeVisible();
  // Another city from the picker opens that city's page.
  await page.getByRole('button', { name: new RegExp(`^Ville : ${name}`) }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Garoua/ })
    .click();
  await expect(page).toHaveURL('/ville/garoua');
});

test('returning visitor: last first page shown at once, then refreshed', async ({ page }, info) => {
  const city = cityFor(info, 'cache');
  const old = await seedListing({ citySlug: city, createdAt: hoursAgo(2) });
  await openHome(page, city);
  await expect(page.locator(`[data-listing="${old.id}"]`)).toBeVisible();
  const fresh = await seedListing({ citySlug: city, createdAt: hoursAgo(1) });

  // Network to the database held back: the cached page is on screen, without any request done.
  let release: () => void = () => undefined;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/documents:runQuery*', async (route) => {
    await held;
    await route.continue();
  });
  await page.reload();
  await expect(page.locator(`[data-listing="${old.id}"]`)).toBeVisible();
  await expect(page.locator(`[data-listing="${fresh.id}"]`)).toHaveCount(0);
  release();
  await expect(page.locator(`[data-listing="${fresh.id}"]`)).toBeVisible();
  expect(await feedIds(page)).toEqual([fresh.id, old.id]);
});
