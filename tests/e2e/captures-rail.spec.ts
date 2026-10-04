/**
 * Premium rail screenshots (docs/captures/ruban/), on demand only (CAPTURES=1, inside
 * `firebase emulators:exec`): home with the rail, then « Annonces récentes », both themes.
 */
import { expect, test, type Page } from '@playwright/test';
import { DEMO_PHOTOS } from '../../scripts/demo-data.ts';
import { hoursAgo, seedListing } from './feed-fixtures';

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
  test(`home with the Premium rail, ${theme} theme`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const size = testInfo.project.name.replace('mobile-', '');
    const city = theme === 'dark' ? 'yaounde' : 'garoua';
    const people: [string, number, string, 0 | 1 | 2, boolean][] = [
      ['Nadia237', 26, 'Bonapriso', 2, true],
      ['Laure_Dla', 31, 'Akwa', 2, false],
      ['Junior237', 29, 'Makepe', 2, true],
      ['Mireille', 34, 'Bonamoussadi', 1, false],
      ['Kevin_cm', 27, 'Deido', 1, true],
      ['Sandra', 24, 'Bali', 0, false],
      ['Arnaud', 38, 'Logpom', 0, false],
    ];
    await Promise.all(
      people.map(([pseudo, age, district, rank, verified], i) =>
        seedListing({
          citySlug: city,
          pseudo: `${pseudo}${size}${theme[0]}`.slice(0, 20),
          age,
          district,
          rank,
          verified,
          createdAt: hoursAgo(i + 1),
          photos: [DEMO_PHOTOS[i % DEMO_PHOTOS.length] ?? ''],
        }),
      ),
    );
    await useTheme(page, theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((c) => localStorage.setItem('nx-city', c), city);
    await page.goto('/');
    await expect(page.locator('.headline__tally')).toHaveText(/à/);
    await page.evaluate(async () => {
      await document.fonts.ready;
      // Only the photos on screen: lazy ones further down never load without scrolling.
      const onScreen = [...document.querySelectorAll<HTMLImageElement>('.plate__img, .lcard__img')].filter(
        (img) => !img.complete && img.getBoundingClientRect().top < innerHeight,
      );
      const loaded = Promise.all(
        onScreen.map((img) => new Promise((r) => img.addEventListener('load', r, { once: true }))),
      );
      await Promise.race([loaded, new Promise((r) => setTimeout(r, 10_000))]);
    });
    await page.screenshot({ path: `docs/captures/ruban/accueil-ruban-${theme}-${size}.png` });

    // Moving: the rail after a few seconds of automatic scroll.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    await expect(page.locator('.headline__tally')).toHaveText(/à/);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `docs/captures/ruban/accueil-ruban-defile-${theme}-${size}.png` });
  });
}
