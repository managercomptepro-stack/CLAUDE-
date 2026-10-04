/**
 * Phase 5 screenshots (docs/captures/phase-5/), on demand only (CAPTURES=1, inside
 * `firebase emulators:exec`).
 */
import { expect, test, type Page } from '@playwright/test';
import { seedDocs } from '../../scripts/demo-data.ts';
import { writeDoc } from '../../scripts/emulator.ts';
import { mockCloudinary, verifiedMember } from './helpers';

test.skip(!process.env['CAPTURES'], 'set CAPTURES=1 to regenerate docs/captures');

const THEMES = ['dark', 'light'] as const;

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
  // Owner's phone test (2 Oct 2026): content showed through the header while scrolling.
  test(`header stays opaque while scrolling, ${theme} theme`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const size = testInfo.project.name.replace('mobile-', '');
    await useTheme(page, theme);
    await mockCloudinary(page);
    await verifiedMember(page);
    for (const [path, name] of [
      ['/compte', 'entete-defilement-compte'],
      ['/publier', 'entete-defilement-publier'],
    ] as const) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.wheel(0, 260);
      await page.waitForFunction(() => window.scrollY > 100);
      const bg = await page.locator('header.topbar').evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toMatch(/^rgb\(/);
      await page.screenshot({ path: `docs/captures/phase-5/${name}-${theme}-${size}.png` });
    }
  });
}

test.describe('public pages', () => {
  test.beforeAll(async () => {
    // Demo data of `npm run seed` (emulator only); writing it twice is harmless.
    for (const d of seedDocs()) await writeDoc(d.path, d.data);
  });

  for (const theme of THEMES) {
    test(`feed, search, listing, member, ${theme} theme`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const size = testInfo.project.name.replace('mobile-', '');
      await useTheme(page, theme);
      const shot = async (name: string) => {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState('networkidle').catch(() => undefined);
        await page.screenshot({ path: `docs/captures/phase-5/${name}-${theme}-${size}.png` });
      };
      // Banner frozen for a stable picture.
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await page.goto('/');
      await expect(page.locator('.lcard--premium').first()).toBeVisible();
      await shot('accueil');
      await page
        .locator('.lcard:not(.lcard--premium):not(.lcard--skeleton)')
        .first()
        .scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, 200);
      await shot('accueil-fil');

      await page.getByRole('button', { name: /^Ville : Douala/ }).click();
      await expect(page.locator('.city-list__count').first()).toBeVisible();
      await shot('selecteur-ville');
      await page.keyboard.press('Escape');

      await page.goto('/recherche?ville=douala&profil=femme,couple&age=20-40');
      await expect(page.locator('.feed__grid li[data-listing]').first()).toBeVisible();
      await shot('recherche');

      await page.goto('/ville/kribi');
      await expect(page.locator('.feed__grid li[data-listing]').first()).toBeVisible();
      await shot('ville-kribi');

      const id = await page.locator('.feed__grid li[data-listing]').first().getAttribute('data-listing');
      await page.goto(`/annonce?id=${id ?? ''}`);
      await expect(page.getByRole('button', { name: 'Contacter sur WhatsApp' })).toBeVisible();
      await shot('annonce');
      await page.mouse.wheel(0, 500);
      await shot('annonce-bas');
      await page.getByRole('button', { name: 'Signaler' }).click();
      await expect(page.getByRole('dialog', { name: 'Signaler cette annonce' })).toBeVisible();
      await shot('signaler');
      await page.keyboard.press('Escape');

      await page.getByRole('link', { name: /Voir son profil/ }).click();
      await expect(page.locator('h1')).toBeVisible();
      await shot('membre');

      await page.goto('/ville/loum');
      await expect(page.getByRole('heading', { name: /Pas encore d’annonce à Loum/ })).toBeVisible();
      await shot('ville-vide');
    });
  }
});
