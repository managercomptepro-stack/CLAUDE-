/**
 * Premium rail (owner's decisions of 3 Oct 2026): at the very top of the home page, every Premium
 * then Sponsored listing of EVERY city, each group drawn at random on every load, 190 × 260 plates
 * with « district · city », endless automatic scroll at about 55 px/s that stops while hovered and
 * starts again 2 s later, still with « reduce motion ». No promotion: an invitation in the same space.
 */
import { expect, test, type Page } from '@playwright/test';
import { cityFor, hoursAgo, seedListing } from './feed-fixtures';

async function scrollAfter(page: Page, ms: number): Promise<[number, number]> {
  const rail = page.locator('.rail');
  const a = await rail.evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(ms);
  const b = await rail.evaluate((el) => el.scrollLeft);
  return [a, b];
}

async function railIds(page: Page): Promise<(string | null)[]> {
  return page
    .getByRole('region', { name: 'Annonces Premium' })
    .locator('li:not([aria-hidden]) a')
    .evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).searchParams.get('id')));
}

test('rail: top of the page, all cities, random order, plates, motion, pause, reduced motion', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const city = cityFor(info, 'rail');
  // Another city than the one shown (not reserved by another test): its promotions are in the rail too.
  const elsewhere = info.project.name === 'mobile-360' ? 'garoua' : 'yaounde';
  const s = (input: Parameters<typeof seedListing>[0]) => seedListing({ citySlug: city, ...input });
  const [prem1, prem2, prem3, spon1, spon2, far] = await Promise.all([
    s({
      rank: 2,
      createdAt: hoursAgo(1),
      pseudo: 'Nadia237',
      age: 26,
      district: 'Bonapriso',
      verified: true,
    }),
    s({ rank: 2, createdAt: hoursAgo(3) }),
    s({ rank: 2, createdAt: hoursAgo(6) }),
    s({ rank: 1, createdAt: hoursAgo(2) }),
    s({ rank: 1, createdAt: hoursAgo(4) }),
    seedListing({ citySlug: elsewhere, rank: 1, createdAt: hoursAgo(7) }),
    s({ createdAt: hoursAgo(0.5) }),
  ]);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript((c) => localStorage.setItem('nx-city', c), city);
  await page.goto('/');

  const rail = page.getByRole('region', { name: 'Annonces Premium' });
  await expect(rail.getByRole('heading', { name: 'Premium' })).toBeVisible();
  await expect(rail.locator(`a[href$="${prem1.id}"]`).first()).toBeVisible();
  // Above the page title, the city button and the profile shortcuts.
  const railBox = await rail.boundingBox();
  const titleBox = await page.locator('h1.page__title').boundingBox();
  expect(railBox!.y + railBox!.height).toBeLessThanOrEqual(titleBox!.y);

  // Every city; Premium (ours) before Sponsored (ours and the other city's).
  const ids = await railIds(page);
  const at = (id: string) => ids.indexOf(id);
  for (const x of [prem1, prem2, prem3, spon1, spon2, far]) expect(at(x.id)).toBeGreaterThanOrEqual(0);
  expect(Math.max(at(prem1.id), at(prem2.id), at(prem3.id))).toBeLessThan(
    Math.min(at(spon1.id), at(spon2.id), at(far.id)),
  );

  // Plate: 190 × 260, real 360 px photo, stamp, « pseudo, age », badge, « district · city », gold.
  const first = rail.locator(`a[href$="${prem1.id}"]`).first();
  // Layout size (the plate at the centre is scaled up by the depth effect).
  expect(
    await first.evaluate((el) => [(el as HTMLElement).offsetWidth, (el as HTMLElement).offsetHeight]),
  ).toEqual([190, 260]);
  // Depth: plates are scaled between 0.92 and 1.05 while the rail moves.
  const scales = await rail
    .locator('.plate-slot')
    .evaluateAll((els) =>
      els.map((e) => Number(/scale\(([\d.]+)\)/.exec((e as HTMLElement).style.transform)?.[1] ?? 1)),
    );
  expect(Math.max(...scales)).toBeGreaterThan(1);
  expect(Math.min(...scales)).toBeLessThan(1);
  await expect(first.locator('img')).toHaveAttribute('src', /res\.cloudinary\.com\/.*w_360/);
  await expect(first.locator('.stamp')).toHaveText('Premium');
  await expect(first.locator('.plate__name')).toHaveText('Nadia237,');
  await expect(first.locator('.plate__age')).toHaveText('26');
  await expect(first.getByRole('img', { name: 'Profil vérifié' })).toBeVisible();
  await expect(first.locator('.plate__where')).toHaveText(/^Bonapriso · \S/);
  await expect(first).toHaveClass(/plate--premium/);
  await expect(rail.locator(`a[href$="${spon1.id}"]`).first().locator('.stamp')).toHaveText('Sponsorisé');

  // Then the feed heading with the city count (all 6 of the city loaded: exact number).
  await expect(page.locator('.headline__title')).toHaveText('Annonces récentes');
  await expect(page.locator('.headline__tally')).toHaveText(/^6 à /);

  // Moves by itself at about 70 px/s.
  const [a, b] = await scrollAfter(page, 1500);
  expect(b - a).toBeGreaterThan(70);
  expect(b - a).toBeLessThan(160);

  // Hovered: still; left: starts again after 2 s.
  await page.locator('.rail').hover();
  const [c, d] = await scrollAfter(page, 800);
  expect(d).toBe(c);
  await page.mouse.move(5, 5);
  const [e, f] = await scrollAfter(page, 1200);
  expect(f).toBe(e);
  await page.waitForTimeout(1200);
  const [g, h] = await scrollAfter(page, 800);
  expect(h).toBeGreaterThan(g);

  // Drawn again on every load: the three Premium do not always come in the same order.
  const premiumOrder = async () =>
    (await railIds(page)).filter((id) => [prem1.id, prem2.id, prem3.id].includes(id ?? '')).join();
  const orders = new Set([await premiumOrder()]);
  for (let i = 0; i < 10 && orders.size < 2; i++) {
    await page.reload();
    await expect(rail.locator(`a[href$="${prem1.id}"]`).first()).toBeVisible();
    orders.add(await premiumOrder());
  }
  expect(orders.size).toBeGreaterThan(1);

  // Reduced motion: never moves by itself, no looping copy.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(rail.locator('.eyebrow__count')).not.toBeEmpty();
  const [i, j] = await scrollAfter(page, 1200);
  expect(j).toBe(i);
  await expect(rail.locator('li[aria-hidden="true"]').first()).toBeHidden();
});

test('rail: no promotion anywhere → invitation in the same space, nothing below moves', async ({ page }) => {
  // The emulator holds other tests' promotions: the rail query is answered empty.
  await page.route('**/*:runQuery*', async (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes('"rank"') && body.includes('GREATER_THAN')) {
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({ contentType: 'application/json', body: '[{"readTime":"2026-10-03T00:00:00Z"}]' });
    } else {
      await route.continue();
    }
  });
  // Positions are compared: no page slide-in under way.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const rail = page.getByRole('region', { name: 'Annonces Premium' });
  await expect(rail).toHaveAttribute('aria-busy', 'true');
  const titleBefore = (await page.locator('h1.page__title').boundingBox())!.y;
  const invite = rail.getByRole('link', { name: /Votre annonce ici/ });
  await expect(invite).toHaveAttribute('href', '/compte#annonces');
  await expect(rail.locator('.eyebrow__count')).toBeEmpty();
  // Same place (a fraction of a pixel may come from the web font swap).
  expect((await page.locator('h1.page__title').boundingBox())!.y).toBeCloseTo(titleBefore, 0);
});
